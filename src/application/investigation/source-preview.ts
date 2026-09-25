// WP-04 IN7–IN9, IN11, IN13 (IP14, IP15, IP16, IP39): a bounded, read-only preview of one
// finding's anchor file, over the existing SourceFileSystemPort. The service never writes
// (the port has no write method); it stats every path segment before it ever reads, and it
// binds only to the codebase's LIVE root on this device, and only when that root still equals
// the snapshot's own scope.rootPath (IP14) — a reconnected or unbound codebase is `no-binding`,
// never a read of the wrong folder's files under the old path.
import { normalizeRelativePath, isContained } from '../../domain/path-safety';
import { countPhysicalLines } from '../../domain/metrics';
import type { Clock } from '../ports/clock';
import type { SourceFileSystemPort } from '../ports/source-filesystem-port';
import { joinRootPath, sameRoot } from './root-path';

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

// IPF1: module-private — Task 10's wiring passes a plain object literal, never names this type.
interface SourcePreviewDeps {
  readonly getFilesystem: () => SourceFileSystemPort | null;
  readonly resolveRoot: (codebaseId: string) => Promise<string | null>;
  readonly clock: Clock;
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
// note-text.ts's INVISIBLE regex strips from a note, shown here as literal `\uXXXX` text
// instead (a preview is a verbatim window onto the file, never a rewrite of its bytes).
// eslint-disable-next-line no-control-regex -- detecting control characters is the point.
const CONTROL_ESCAPE = /[\u0000-\u0008\u000B-\u001F\u007F-\u009F‎‏‪-‮⁦-⁩]/g;
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
 *  first 41 for no line. */
function lineRange(count: number, line: number | null): readonly [number, number] {
  if (count === 0) return [1, 0];
  if (line === null) return [1, Math.min(count, PREVIEW_CONTEXT * 2 + 1)];
  if (line < 1 || line > count) return [Math.max(1, count - PREVIEW_CONTEXT * 2), count];
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

export function createSourcePreview(deps: SourcePreviewDeps): SourcePreview {
  async function read(request: PreviewRequest): Promise<PreviewResult> {
    const fs = deps.getFilesystem();
    if (fs === null) return unavailable('no-filesystem');
    const root = await deps.resolveRoot(request.codebaseId);
    if (root === null || !sameRoot(root, request.expectedRoot)) return unavailable('no-binding');
    let rel: string;
    try { rel = normalizeRelativePath(request.relativePath); } catch { return unavailable('outside-root'); }
    const abs = joinRootPath(root, rel);
    if (!isContained(root, abs)) return unavailable('outside-root');
    // IP15: every parent folder below the root, stat'd and checked for a symlink/junction
    // BEFORE the file itself — nothing is read until every path segment has passed.
    const segments = rel.split('/');
    for (let i = 1; i < segments.length; i += 1) {
      const dir = await fs.stat(joinRootPath(root, segments.slice(0, i).join('/')));
      if (!dir.exists) return unavailable('missing');
      if (dir.isSymbolicLink) return unavailable('outside-root');
    }
    const st = await fs.stat(abs);
    if (!st.exists) return unavailable('missing');
    if (st.isSymbolicLink) return unavailable('outside-root');
    if (!st.isFile) return unavailable('not-a-file');
    const limit = Math.min(request.maxFileBytes, PREVIEW_MAX_BYTES);
    if (st.size > limit) return unavailable('too-large');
    const result = await fs.readText(abs, limit);
    if (result.status === 'unavailable') return unavailable(classify(result.reason));
    return {
      status: 'ok',
      text: {
        ...windowOf(result.text, request.line),
        size: result.bytes.byteLength,
        mtimeMs: st.mtimeMs,
        readAt: deps.clock.nowIso(),
      },
    };
  }
  return { read };
}
