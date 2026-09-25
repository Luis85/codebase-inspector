// WP-04 IN7–IN9, IN11, IN13 (IP14, IP15, IP16, IP39): a bounded, read-only preview of one
// finding's anchor file, over the existing SourceFileSystemPort. The service never writes
// (the port has no write method); it stats every path segment before it ever reads, and it
// binds only to the codebase's LIVE root on this device, and only when that root still equals
// the snapshot's own scope.rootPath (IP14) — a reconnected codebase is `no-binding`, never a
// read of the wrong folder's files under the old path. WP-04 E25: a codebase with no binding
// at all reads under the snapshot's own root, the root this session's scan was approved for.
import { normalizeRelativePath, isContained } from '../../domain/path-safety';
import { countPhysicalLines } from '../../domain/metrics';
import type { Clock } from '../ports/clock';
import type { SourceFileSystemPort, StatResult } from '../ports/source-filesystem-port';
import { joinRootPath, sameRoot } from './root-path';
import { INVISIBLE_CONTROLS } from './note-text';

// IPF1: module-private — no consumer outside this file needs these as numbers; tests use
// literals such as `512 * 1024`.
const PREVIEW_MAX_BYTES = 512 * 1024;
const PREVIEW_CONTEXT = 20;
const PREVIEW_LINE_MAX = 400;

export type PreviewUnavailable =
  | 'no-binding' | 'no-filesystem' | 'outside-root' | 'not-a-file' | 'too-large' | 'binary' | 'not-utf8' | 'missing' | 'read-error';

export interface PreviewRequest {
  readonly codebaseId: string; readonly expectedRoot: string; readonly relativePath: string;
  readonly maxFileBytes: number; readonly line: number | null;
}

export interface PreviewLine { readonly number: number; readonly text: string; readonly cut: boolean }

export interface PreviewText {
  readonly lines: readonly PreviewLine[]; readonly lineCount: number; readonly size: number;
  readonly mtimeMs: number; readonly readAt: string;
}

export type PreviewResult =
  | { readonly status: 'ok'; readonly text: PreviewText }
  | { readonly status: 'unavailable'; readonly reason: PreviewUnavailable };

/** WP-04 E25 (amends IP14): what the host knows of a codebase's root on this device — its live
 *  binding root; `{ unbound: true }` when its profile has no binding at all (a profile
 *  scan-codebase created, bindingId null), so the preview reads under the snapshot's own
 *  approved root; null when there is no profile, or a binding whose record is gone. */
type ResolvedRoot = string | null | { readonly unbound: true };

// IPF1: module-private — Task 10's wiring passes a plain object literal, never names this type.
// Fix round 1, review minor 3: `caseSensitive` (default false) is the host adapter's own
// platform knowledge (the same signal `node-source-filesystem.ts` derives from `path.sep`,
// M20) — this module never reads the platform itself.
interface SourcePreviewDeps {
  readonly getFilesystem: () => SourceFileSystemPort | null;
  readonly resolveRoot: (codebaseId: string) => Promise<ResolvedRoot>;
  readonly clock: Clock;
  readonly caseSensitive?: boolean;
}

export interface SourcePreview { read(request: PreviewRequest): Promise<PreviewResult> }

// IN9: the adapter's `readText` carries only a free-text reason; classified by its own
// message PREFIX (IP15), pinned against the real Node adapter by an integration test —
// an adapter wording change turns a precise state into `read-error` and that test fails first.
const REASONS: readonly (readonly [prefix: string, reason: PreviewUnavailable])[] = [
  ['file exceeds the maximum size', 'too-large'],
  ['file appears to contain binary content', 'binary'],
  ['file is not valid UTF-8', 'not-utf8'],
];
const classify = (reason: string): PreviewUnavailable => REASONS.find(([p]) => reason.startsWith(p))?.[1] ?? 'read-error';
const unavailable = (reason: PreviewUnavailable): PreviewResult => ({ status: 'unavailable', reason });

// IP16: every C0 control except tab, DEL, C1 and the bidi/format controls — the same set
// note-text.ts's INVISIBLE regex strips from a note (INVISIBLE_CONTROLS, its ONE shared
// export — fix round 1, review item 1), shown here as literal `\uXXXX` text instead (a
// preview is a verbatim window onto the file, never a rewrite of its bytes). Dynamically
// built, so no-control-regex (which only sees a literal /…/ pattern) needs no disable here.
const CONTROL_ESCAPE = new RegExp(`[\\u0000-\\u0008\\u000B-\\u001F\\u007F-\\u009F${INVISIBLE_CONTROLS}]`, 'g');
const escapeControls = (value: string): string => value.replace(
  CONTROL_ESCAPE,
  (ch) => `\\u${ch.codePointAt(0)!.toString(16).toUpperCase().padStart(4, '0')}`,
);

/** Cuts at PREVIEW_LINE_MAX code points (never shifted or ellipsised — `cut` is the signal),
 *  then escapes controls in the (possibly cut) result. */
function renderLine(raw: string): { text: string; cut: boolean } {
  const points = Array.from(raw);
  const cut = points.length > PREVIEW_LINE_MAX;
  const kept = cut ? points.slice(0, PREVIEW_LINE_MAX).join('') : raw;
  return { text: escapeControls(kept), cut };
}

function dropFinalLineEnding(text: string): string {
  if (text.endsWith('\r\n')) return text.slice(0, -2);
  if (text.endsWith('\n')) return text.slice(0, -1);
  return text;
}

/** [start, end] (1-based, inclusive): 20 lines either side of `line`, clipped at the file's
 *  edges and never shifted to fill 41 (IP16); the last 41 lines for a line past the end; the
 *  first 41 for no line OR a non-positive line (fix round 1, review minor 5: a line ≤ 0 is
 *  not "past the end" — it names no real line at all, same as `null`). */
function lineRange(count: number, line: number | null): readonly [number, number] {
  if (count === 0) return [1, 0];
  if (line === null || line < 1) return [1, Math.min(count, PREVIEW_CONTEXT * 2 + 1)];
  if (line > count) return [Math.max(1, count - PREVIEW_CONTEXT * 2), count];
  return [Math.max(1, line - PREVIEW_CONTEXT), Math.min(count, line + PREVIEW_CONTEXT)];
}

/** Module-private: the read line count uses the scan's own `countPhysicalLines`, so IN10's
 *  line check compares against the same definition the scan used. */
function windowOf(text: string, line: number | null): Pick<PreviewText, 'lines' | 'lineCount'> {
  const lineCount = countPhysicalLines(text);
  const rawLines = lineCount === 0 ? [] : dropFinalLineEnding(text).split(/\r?\n/);
  const [start, end] = lineRange(lineCount, line);
  const lines: PreviewLine[] = [];
  for (let n = start; n <= end; n += 1) {
    const { text: rendered, cut } = renderLine(rawLines[n - 1] ?? '');
    lines.push({ number: n, text: rendered, cut });
  }
  return { lines, lineCount };
}

// Fix round 1, review minor 2: the file can change between the pre-read stat and the read
// itself. `attemptOnce` stats every ancestor and the file, reads, then (when `verify` is
// true) re-stats the SAME paths: a newly-symlinked ancestor or file is `outside-root`
// outright (a link is a link, retrying will not un-link it); a changed size or mtime means
// the bytes just read may not be the bytes now on disk, so the caller re-runs the whole
// attempt once, this time without verifying again (bounded to exactly one retry — never an
// exact-looking result built from two different moments in time, and never an infinite
// chase of a file that keeps changing). The POST-read stat's mtimeMs is what the result
// reports, never the pre-read one.
type Attempt = { readonly race: true } | { readonly race: false; readonly result: PreviewResult };

async function checkAncestors(
  fs: SourceFileSystemPort, root: string, segments: readonly string[],
): Promise<PreviewResult | null> {
  for (let i = 1; i < segments.length; i += 1) {
    const dir = await fs.stat(joinRootPath(root, segments.slice(0, i).join('/')));
    if (!dir.exists) return unavailable('missing');
    if (dir.isSymbolicLink) return unavailable('outside-root');
  }
  return null;
}

async function attemptOnce(
  fs: SourceFileSystemPort, root: string, abs: string, segments: readonly string[],
  request: PreviewRequest, clock: Clock, verify: boolean,
): Promise<Attempt> {
  const ancestorProblem = await checkAncestors(fs, root, segments);
  if (ancestorProblem !== null) return { race: false, result: ancestorProblem };
  const preStat = await fs.stat(abs);
  if (!preStat.exists) return { race: false, result: unavailable('missing') };
  if (preStat.isSymbolicLink) return { race: false, result: unavailable('outside-root') };
  if (!preStat.isFile) return { race: false, result: unavailable('not-a-file') };
  const limit = Math.min(request.maxFileBytes, PREVIEW_MAX_BYTES);
  if (preStat.size > limit) return { race: false, result: unavailable('too-large') };
  const readResult = await fs.readText(abs, limit);
  if (readResult.status === 'unavailable') return { race: false, result: unavailable(classify(readResult.reason)) };
  let mtimeMs = preStat.mtimeMs;
  if (verify) {
    const postAncestorProblem = await checkAncestors(fs, root, segments);
    if (postAncestorProblem !== null) return { race: false, result: postAncestorProblem };
    const postStat: StatResult = await fs.stat(abs);
    if (!postStat.exists) return { race: false, result: unavailable('missing') };
    if (postStat.isSymbolicLink) return { race: false, result: unavailable('outside-root') };
    if (postStat.size !== preStat.size || postStat.mtimeMs !== preStat.mtimeMs) return { race: true };
    mtimeMs = postStat.mtimeMs;
  }
  return {
    race: false,
    result: {
      status: 'ok',
      text: { ...windowOf(readResult.text, request.line), size: readResult.bytes.byteLength, mtimeMs, readAt: clock.nowIso() },
    },
  };
}

export function createSourcePreview(deps: SourcePreviewDeps): SourcePreview {
  async function read(request: PreviewRequest): Promise<PreviewResult> {
    const fs = deps.getFilesystem();
    if (fs === null) return unavailable('no-filesystem');
    let resolved: ResolvedRoot;
    try {
      // Fix round 1, review minor 7: a rejected resolveRoot (a store lookup that throws, a
      // profile removed mid-flight) is a binding failure, not an unhandled rejection.
      resolved = await deps.resolveRoot(request.codebaseId);
    } catch {
      return unavailable('no-binding');
    }
    // WP-04 E25: an unbound codebase reads under the snapshot's own approved root; with no
    // snapshot root there is nothing to read.
    const root = typeof resolved === 'object' && resolved !== null ? request.expectedRoot : resolved;
    const options = { caseSensitive: deps.caseSensitive ?? false };
    if (root === null || root === '' || !sameRoot(root, request.expectedRoot, options)) return unavailable('no-binding');
    let rel: string;
    try { rel = normalizeRelativePath(request.relativePath); } catch { return unavailable('outside-root'); }
    const abs = joinRootPath(root, rel);
    if (!isContained(root, abs, options)) return unavailable('outside-root');
    const segments = rel.split('/');
    const first = await attemptOnce(fs, root, abs, segments, request, deps.clock, true);
    if (!first.race) return first.result;
    const second = await attemptOnce(fs, root, abs, segments, request, deps.clock, false);
    return second.race ? unavailable('read-error') : second.result;
  }
  return { read };
}
