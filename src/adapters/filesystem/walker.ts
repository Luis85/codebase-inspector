// The bounded async walk (spec 3.1 / task-5 brief step 5). Deliberately generic over a
// `WalkerDeps` abstraction rather than importing node-access.ts directly: this same
// generator is what BOTH node-source-filesystem.ts (real fs) and
// tests/fixtures/fake-source-filesystem.ts (in-memory) drive, so the traversal,
// exclusion, containment, depth/entry bounding and cancellation logic exists in exactly
// one place and cannot drift between the fake and the real adapter — the concern the
// shared contract suite exists to police (spec 6), reinforced here at the algorithm
// level, not only at the test level.
import { isContained, normalizeRelativePath } from '../../domain/path-safety';
import type { CancellationToken } from '../../application/ports/cancellation-token';
import type { WalkEntry, WalkOptions } from '../../application/ports/source-filesystem-port';

export interface WalkerStats {
  size: number;
  isDirectory(): boolean;
  isFile(): boolean;
  isSymbolicLink(): boolean;
}

// `bytes` (fix round 3, ruling M45) travels alongside `text` so the walk's own
// already-done read can be carried forward on the 'file' WalkEntry it produces, instead
// of collectInventory calling readText() a second time for the same file.
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

/** Explicit stack, not recursion (task-5 brief step 5, non-negotiable rule) — an
 *  arbitrarily deep real tree must never grow the JS call stack. Cancellation is checked
 *  at every directory boundary (popping a frame, the brief's own non-negotiable minimum)
 *  AND before every single entry within a directory — the entry-level check is stricter
 *  than the brief's stated minimum, added because "stops promptly" (acceptance
 *  criterion 6) means within one entry of a cancel, not within up to `YIELD_EVERY`. */
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
      // visible skip instead (never dropped silently, per spec 7).
      if (frame.relPath === '') throw e;
      // wasDirectory: true (fix-round-1 finding 7) — this path was already yielded once
      // as a 'directory' WalkEntry when it was first discovered as its parent's child;
      // this second, later entry is a DIFFERENT fact ("its contents could not be
      // enumerated"), not a restatement of the first, so it is not suppressed. What
      // changes is that the collector can now tell it apart from a skipped FILE and stop
      // building a `kind: 'file'` entity for a directory.
      yield { kind: 'skipped', relativePath: frame.relPath, reason: `directory is unreadable: ${message(e)}`, wasDirectory: true };
      continue;
    }
    names.sort();

    for (const name of names) {
      // Checked before EVERY entry, not only at directory boundaries and per-tick
      // yields: "stops promptly" (acceptance criterion 6) means within one entry of a
      // cancel, not within up to YIELD_EVERY of one — throwIfCancelled() itself is a
      // cheap boolean read (src/application/ports/cancellation-token.ts), so checking
      // this often costs nothing measurable.
      token.throwIfCancelled();
      entryCount += 1;
      const relPath = frame.relPath ? `${frame.relPath}/${name}` : name;
      if (entryCount > maxEntries) {
        yield { kind: 'skipped', relativePath: relPath, reason: `entry limit of ${maxEntries} exceeded` };
        return;
      }

      sinceTick += 1;
      if (sinceTick >= YIELD_EVERY) {
        sinceTick = 0;
        await tick();
        token.throwIfCancelled();
      }

      const absPath = deps.joinPath(frame.absPath, name);
      yield* classifyEntry(root, relPath, absPath, frame.depth, maxDepth, opts, deps, stack);
    }
  }
}

/** One directory entry's full classification pipeline: path safety, containment,
 *  exclusion (rule: applied before opening anything), symlink, size, content. Split out
 *  of walkTree to keep both functions under the 400-line file limit and each single
 *  responsibility readable on its own. Always yields exactly one WalkEntry, except for
 *  an excluded path (yields nothing at all — pruned, never even logged) and a kept
 *  directory (yields the directory entry, then possibly a second "too deep" skip). */
async function* classifyEntry(
  root: string, relPath: string, absPath: string, depth: number, maxDepth: number,
  opts: WalkOptions, deps: WalkerDeps, stack: StackFrame[],
): AsyncGenerator<WalkEntry> {
  try {
    normalizeRelativePath(relPath);
  } catch (e) {
    yield { kind: 'skipped', relativePath: relPath, reason: `unsafe path: ${message(e)}` };
    return;
  }
  // Containment is checked on every entry, before any read (non-negotiable rule).
  if (!isContained(root, absPath, { caseSensitive: deps.caseSensitive })) {
    yield { kind: 'skipped', relativePath: relPath, reason: 'resolves outside the approved root' };
    return;
  }
  // Exclusions are applied before opening anything: no onOpen call above this line for
  // `absPath` itself, so an excluded path never appears in readLog() (proved by
  // tests/integration/read-log.test.ts).
  if (isExcluded(relPath, opts.exclusions, deps.caseSensitive)) return;

  let stat: WalkerStats;
  try {
    deps.onOpen(absPath);
    stat = await deps.lstat(absPath);
  } catch (e) {
    yield { kind: 'skipped', relativePath: relPath, reason: `unreadable: ${message(e)}` };
    return;
  }

  if (stat.isSymbolicLink()) {
    yield { kind: 'skipped', relativePath: relPath, reason: 'symlink: not followed (followSymlinks is false)' };
    return;
  }
  if (stat.isDirectory()) {
    // Fix-round-1 finding 7: this used to yield BOTH a 'directory' entry AND a
    // 'skipped' entry for the exact same relativePath, back to back in the same call —
    // a genuine duplicate (unlike the unreadable-directory case above, these two facts
    // are discovered at the same instant, not at different times), and the collector
    // built a mislabelled `kind: 'file'` entity from the second one. At the depth
    // limit, yield ONLY the 'skipped' entry (marked wasDirectory), never the
    // 'directory' one — a directory the walk refuses to descend into contributes
    // nothing else a consumer could use the 'directory' entry for anyway.
    if (depth + 1 > maxDepth) {
      yield { kind: 'skipped', relativePath: relPath, reason: `exceeds the maximum depth of ${maxDepth}`, wasDirectory: true };
      return;
    }
    yield { kind: 'directory', absolutePath: absPath, relativePath: relPath, byteSize: 0 };
    stack.push({ absPath, relPath, depth: depth + 1 });
    return;
  }
  if (!stat.isFile()) {
    yield { kind: 'skipped', relativePath: relPath, reason: 'not a regular file or directory' };
    return;
  }
  if (stat.size > opts.maxFileBytes) {
    yield { kind: 'skipped', relativePath: relPath, reason: `exceeds the maximum file size of ${opts.maxFileBytes} bytes` };
    return;
  }

  const read = await deps.readAsText(absPath);
  if (!read.ok) {
    yield { kind: 'skipped', relativePath: relPath, reason: read.reason };
    return;
  }
  // Fix round 3, ruling M45: carries the read this call already did forward on the
  // entry itself, so collectInventory never opens and re-reads the same file again.
  yield {
    kind: 'file', absolutePath: absPath, relativePath: relPath, byteSize: stat.size,
    text: read.text, bytes: read.bytes,
  };
}
