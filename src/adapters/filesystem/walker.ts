// The bounded async walk (spec 3.1 / task-5 brief step 5). Deliberately generic over a
// `WalkerDeps` abstraction rather than importing node-access.ts directly: this same
// generator is what BOTH node-source-filesystem.ts (real fs) and
// tests/fixtures/fake-source-filesystem.ts (in-memory) drive, so the traversal,
// exclusion, containment, depth/entry bounding and cancellation logic exists in exactly
// one place and cannot drift between the fake and the real adapter — the concern the
// shared contract suite exists to police (spec 6), reinforced here at the algorithm
// level, not only at the test level.
import { isContained, normalizeRelativePath } from '../../domain/path-safety';
import { byteSize, countPhysicalLines } from '../../domain/metrics';
import { RootUnreadableError } from '../../application/root-unreadable';
import type { CancellationToken } from '../../application/ports/cancellation-token';
import type { WalkEntry, WalkOptions } from '../../application/ports/source-filesystem-port';

export interface WalkerStats {
  size: number;
  isDirectory(): boolean;
  isFile(): boolean;
  isSymbolicLink(): boolean;
}

// `bytes` travels alongside `text` here because both are needed a moment later, inside
// `settle`, to compute `lineCount`/`byteLength` (task 2's own metric functions,
// fix round 4). Neither `text` nor `bytes` themselves leave this module: only the two
// resulting numbers are carried forward onto the 'file' WalkEntry -- see that type's own
// comment (source-filesystem-port.ts) for why round 3's original text/bytes-carrying
// shape was replaced.
export type ReadTextOutcome = { ok: true; text: string; bytes: Uint8Array } | { ok: false; reason: string };

/** The minimal filesystem surface the walk algorithm needs. Both implementations log
 *  every path they open themselves (via `onOpen`) rather than the walker doing it, so
 *  the log reflects real opens even for calls the walker never makes (readText() called
 *  directly by the collector, outside a walk). */
export interface WalkerDeps {
  caseSensitive: boolean;
  onOpen(absPath: string): void;
  joinPath(base: string, name: string): string;
  readdirNames(absPath: string): Promise<string[]>;
  lstat(absPath: string): Promise<WalkerStats>;
  /** Reads and decodes a file ALREADY known to be within the size limit (the walker
   *  checks `maxFileBytes` against a stat it already has before calling this) — binary
   *  and undecodable content are still detected here, and reported the same way readText
   *  would report them, because both call the same underlying classification. */
  readAsText(absPath: string): Promise<ReadTextOutcome>;
}

// Bounded walk (task-5 brief step 5, non-negotiable rule): a maximum depth and a maximum
// entry count, both design decisions the brief leaves to the implementer (not part of
// any frozen §4 contract). 128 is far beyond "deep nesting beyond 20 levels" (acceptance
// criterion 1) while still being finite; 200,000 matches validateSnapshot's own payload
// limit (src/domain/validator.ts's PAYLOAD_LIMIT) as an order-of-magnitude anchor, though
// the two are independent numbers checked at different layers.
const DEFAULT_MAX_DEPTH = 128;
const DEFAULT_MAX_ENTRIES = 200_000;
// Per-tick yield (task-5 brief step 5, non-negotiable rule): control is handed back to
// the event loop every 64 entries so a very large directory can never block the main
// thread for the whole walk. A macrotask (setTimeout), not a microtask, is used
// deliberately — a microtask alone would never let already-queued UI work run.
const YIELD_EVERY = 64;

// Fix-round-1 MINOR finding 6: exclusion matching now applies the SAME case-sensitivity
// decision containment already uses (ruling M20), rather than always comparing
// case-sensitively regardless of platform. Before this fix, on Windows an exclusion of
// '.obsidian' would not prune an on-disk '.Obsidian' — "the one place where an exclusion
// miss would put plugin output back into scope" (the reviewer's own words), since
// containment had already been made platform-aware but exclusion had not.
function isExcluded(relativePath: string, exclusions: readonly string[], caseSensitive: boolean): boolean {
  const normalize = (s: string): string => (caseSensitive ? s : s.toLowerCase());
  const normalizedPath = normalize(relativePath);
  for (const excl of exclusions) {
    if (excl.length === 0) continue;
    const normalizedExcl = normalize(excl);
    if (normalizedExcl.includes('/')) {
      if (normalizedPath === normalizedExcl || normalizedPath.startsWith(`${normalizedExcl}/`)) return true;
    } else if (normalizedPath.split('/').includes(normalizedExcl)) {
      return true;
    }
  }
  return false;
}

// Captured once, as a plain value (not a call and not a `globalThis`/`global` reference):
// this generator runs inside plain Node under Vitest's 'node' project (tests/contracts,
// tests/integration have no DOM at all), so a bare window.setTimeout call would throw
// "window is not defined" there, and globalThis.setTimeout would (correctly) trip
// obsidianmd/no-global-this — that rule exists for popout-window colour/DOM reads
// (tests/mocks/obsidian.ts's own scoped disable makes the same point), not for scheduling
// a microtask-adjacent yield in filesystem code that never touches a window. Binding the
// global function to a local name sidesteps both rules on their own terms: neither one
// matches a plain read of the ambient `setTimeout` identifier, only a CALL to it
// (obsidianmd/prefer-window-timers) or a reference to the literal name `globalThis`/
// `global` (obsidianmd/no-global-this) — so no rule is disabled, weakened or overridden.
const scheduleTimeout = setTimeout;

function tick(): Promise<void> {
  return new Promise((resolve) => { scheduleTimeout(resolve, 0); });
}

function message(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

interface StackFrame { absPath: string; relPath: string; depth: number }

// Gap closure GRB2 (ruling M108, GCO8): within one directory, up to SCAN_WINDOW upcoming
// entries are PREPARED at once (lstat, plus readAsText for a regular file within the size
// cap), always the next ones in index order. Everything observable is still decided one
// entry at a time, in index order: the emitted entries, the directory pushes onto the
// stack and the `maxEntries` accounting are exactly what the sequential walk produced
// (tests/integration/walker-concurrency.test.ts pins them under reversed I/O timing). Only
// the ORDER of the read log becomes completion-dependent; its contents do not (GCN5).
const SCAN_WINDOW = 8;

/** What an entry's preparation found. It never rejects: an lstat or read failure is
 *  carried as `failed` and becomes that entry's own `unreadable` skip, so one bad entry
 *  cannot drop or reorder the others in its window. */
type Prepared =
  | { kind: 'failed'; reason: string }
  | { kind: 'stat'; stat: WalkerStats; read?: ReadTextOutcome };

/** One dispatched entry. `early` is decided BEFORE anything is opened: a path-safety or
 *  containment skip, or 'excluded' (yields nothing, opens nothing, logs nothing). */
interface Slot { relPath: string; absPath: string; early: WalkEntry | 'excluded' | null; prep: Promise<Prepared> | null }

/** Explicit stack, not recursion (task-5 brief step 5, non-negotiable rule) — an
 *  arbitrarily deep real tree must never grow the JS call stack. Cancellation (GCO8):
 *  `throwIfCancelled()` runs before EVERY dispatch, so nothing new is opened once a cancel
 *  is observed; it also runs at every directory boundary and before every entry is
 *  consumed ("stops promptly", acceptance criterion 6). Preparations already in flight
 *  are drained in `finally` before the cancel propagates, so the run reports cancelled
 *  only after its reads have stopped (spec §7: the UI never claims work stopped before
 *  the collector confirms it). */
export async function* walkTree(
  root: string,
  opts: WalkOptions,
  token: CancellationToken,
  deps: WalkerDeps,
): AsyncGenerator<WalkEntry> {
  const maxDepth = opts.maxDepth ?? DEFAULT_MAX_DEPTH;
  const maxEntries = opts.maxEntries ?? DEFAULT_MAX_ENTRIES;
  const stack: StackFrame[] = [{ absPath: root, relPath: '', depth: 0 }];
  let entryCount = 0;
  let sinceTick = 0;

  while (stack.length > 0) {
    token.throwIfCancelled();
    const frame = stack.pop()!;

    let names: string[];
    try {
      deps.onOpen(frame.absPath);
      names = await deps.readdirNames(frame.absPath);
    } catch (e) {
      // The root itself failing to list is a real error the caller should see, not a
      // silently-produced empty snapshot; every OTHER directory that fails becomes a
      // visible skip instead (never dropped silently, per spec 7). GCQ9: typed, so the
      // coordinator reports the root as unavailable with the code (the raw error rides along).
      if (frame.relPath === '') throw new RootUnreadableError(e);
      // wasDirectory: true (fix-round-1 finding 7) — this path was already yielded once
      // as a 'directory' WalkEntry when it was first discovered as its parent's child;
      // this second, later entry is a DIFFERENT fact ("its contents could not be
      // enumerated"), not a restatement of the first, so it is not suppressed.
      yield { kind: 'skipped', relativePath: frame.relPath, reason: `directory is unreadable: ${message(e)}`, wasDirectory: true };
      continue;
    }
    names.sort();

    // Entry i of this directory is the walk's (base + i + 1)-th entry: only this
    // directory's own entries move the count while it is being consumed, so whether an
    // entry is within `maxEntries` is known before it is dispatched — and once the cap is
    // reached, nothing further is dispatched at all.
    const base = entryCount;
    const withinCap = (i: number): boolean => i < names.length && base + i + 1 <= maxEntries;
    const queue: Slot[] = [];
    let dispatched = 0;
    try {
      for (let i = 0; i < names.length; i += 1) {
        while (dispatched < i + SCAN_WINDOW && withinCap(dispatched)) {
          token.throwIfCancelled();   // the dispatch guard: never open anything after a cancel
          queue.push(dispatch(root, frame, names[dispatched]!, opts, deps, token));
          dispatched += 1;
        }
        token.throwIfCancelled();
        entryCount += 1;
        if (entryCount > maxEntries) {
          const relPath = frame.relPath ? `${frame.relPath}/${names[i]!}` : names[i]!;
          yield { kind: 'skipped', relativePath: relPath, reason: `entry limit of ${maxEntries} exceeded` };
          return;
        }

        sinceTick += 1;
        if (sinceTick >= YIELD_EVERY) {
          sinceTick = 0;
          await tick();
          token.throwIfCancelled();
        }

        // Strictly the oldest slot, which is entry i: results are CONSUMED in index order
        // however their preparations happened to complete. It leaves the queue only once
        // settled, so `finally` drains it too if anything throws while it is awaited.
        const slot = queue[0]!;
        const prepared = slot.prep ? await slot.prep : null;
        queue.shift();
        // A cancel that landed while this entry was being prepared is honoured before
        // anything the preparation produced is emitted.
        token.throwIfCancelled();
        const settled = settle(slot, prepared, frame.depth, maxDepth, opts);
        if (settled.entry) yield settled.entry;
        if (settled.descend) stack.push(settled.descend);
      }
    } finally {
      // Drain: a cancel (or a consumer that stops early) propagates only once every
      // preparation already in flight has settled — none of them is left reading behind
      // a run that has already reported itself stopped.
      await Promise.allSettled(queue.flatMap((slot) => (slot.prep ? [slot.prep] : [])));
    }
  }
}

function dispatch(
  root: string, frame: StackFrame, name: string, opts: WalkOptions, deps: WalkerDeps, token: CancellationToken,
): Slot {
  const relPath = frame.relPath ? `${frame.relPath}/${name}` : name;
  const absPath = deps.joinPath(frame.absPath, name);
  const early = precheck(root, relPath, absPath, opts, deps);
  if (early !== null) return { relPath, absPath, early, prep: null };
  return { relPath, absPath, early: null, prep: prepare(absPath, opts, deps, token) };
}

/** Path safety, containment and exclusion, in that order — all decided before anything is
 *  opened for `absPath` (non-negotiable rule): an excluded path never reaches `onOpen`, so
 *  it never appears in readLog() (tests/integration/read-log.test.ts). */
function precheck(
  root: string, relPath: string, absPath: string, opts: WalkOptions, deps: WalkerDeps,
): WalkEntry | 'excluded' | null {
  try {
    normalizeRelativePath(relPath);
  } catch (e) {
    return { kind: 'skipped', relativePath: relPath, reason: `unsafe path: ${message(e)}` };
  }
  if (!isContained(root, absPath, { caseSensitive: deps.caseSensitive })) {
    return { kind: 'skipped', relativePath: relPath, reason: 'resolves outside the approved root' };
  }
  if (isExcluded(relPath, opts.exclusions, deps.caseSensitive)) return 'excluded';
  return null;
}

/** The I/O for one entry: one lstat, then — only for a regular file within the size cap —
 *  one readAsText. A cancel observed between the two starts no read: the preparation
 *  settles at once and walkTree's own check throws before its result is ever used. */
async function prepare(absPath: string, opts: WalkOptions, deps: WalkerDeps, token: CancellationToken): Promise<Prepared> {
  let stat: WalkerStats;
  try {
    deps.onOpen(absPath);
    stat = await deps.lstat(absPath);
  } catch (e) {
    return { kind: 'failed', reason: `unreadable: ${message(e)}` };
  }
  if (stat.isSymbolicLink() || !stat.isFile() || stat.size > opts.maxFileBytes) return { kind: 'stat', stat };
  if (token.cancelled) return { kind: 'stat', stat, read: { ok: false, reason: 'not read: the scan was cancelled' } };
  try {
    return { kind: 'stat', stat, read: await deps.readAsText(absPath) };
  } catch (e) {
    return { kind: 'failed', reason: `unreadable: ${message(e)}` };
  }
}

/** One entry's classification from what was found, in the sequential walk's exact order:
 *  symlink, directory (depth), non-file, size, content. Yields exactly one entry, except
 *  an excluded path (nothing at all — pruned, never even logged). A kept directory is
 *  returned as `descend`, pushed by walkTree after its entry is yielded. */
function settle(
  slot: Slot, prepared: Prepared | null, depth: number, maxDepth: number, opts: WalkOptions,
): { entry: WalkEntry | null; descend: StackFrame | null } {
  const { relPath, absPath } = slot;
  const skip = (reason: string): { entry: WalkEntry; descend: null } =>
    ({ entry: { kind: 'skipped', relativePath: relPath, reason }, descend: null });
  if (slot.early === 'excluded') return { entry: null, descend: null };
  if (slot.early !== null) return { entry: slot.early, descend: null };
  if (prepared === null) throw new Error(`walker: ${relPath} was opened without a preparation`);
  if (prepared.kind === 'failed') return skip(prepared.reason);
  const { stat, read } = prepared;
  if (stat.isSymbolicLink()) return skip('symlink: not followed (followSymlinks is false)');
  if (stat.isDirectory()) {
    // Fix-round-1 finding 7: at the depth limit, ONLY the 'skipped' entry (marked
    // wasDirectory), never ALSO a 'directory' entry for the same path.
    if (depth + 1 > maxDepth) {
      return { entry: { kind: 'skipped', relativePath: relPath, reason: `exceeds the maximum depth of ${maxDepth}`, wasDirectory: true }, descend: null };
    }
    return {
      entry: { kind: 'directory', absolutePath: absPath, relativePath: relPath, byteSize: 0 },
      descend: { absPath, relPath, depth: depth + 1 },
    };
  }
  if (!stat.isFile()) return skip('not a regular file or directory');
  if (stat.size > opts.maxFileBytes) return skip(`exceeds the maximum file size of ${opts.maxFileBytes} bytes`);
  if (read === undefined) throw new Error(`walker: ${relPath} was prepared without its read`);
  if (!read.ok) return skip(read.reason);
  // Fix round 3 (ruling M45), revised fix round 4: carries the MEASUREMENTS forward on
  // the entry itself -- never the text or bytes -- so collectInventory never re-reads the
  // file, without pinning the codebase's decoded content in memory for the walk.
  return {
    entry: {
      kind: 'file', absolutePath: absPath, relativePath: relPath, byteSize: stat.size,
      lineCount: countPhysicalLines(read.text), byteLength: byteSize(read.bytes),
    },
    descend: null,
  };
}
