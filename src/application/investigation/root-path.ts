// WP-04 IN7 (IP14): joining and comparing the preview's root against a POSIX-relative path,
// without touching a filesystem or Node module (src/application may not). `isContained` already
// does the segment-wise, case-aware containment check (domain/path-safety.ts); this module only
// adds the root's own separator style and the POSIX-relative projection the preview UI shows.
import { isContained } from '../../domain/path-safety';

/** Joins `relativePath` (POSIX, from `normalizeRelativePath`) onto `root` using the root's OWN
 *  separator: `\` when the root carries a drive letter or already uses `\`, else `/`. The root's
 *  trailing separators are trimmed first, so `joinRootPath('C:\\app\\', 'a/b')` is
 *  `C:\app\a\b`, never `C:\app\\a\b`. */
export function joinRootPath(root: string, relativePath: string): string {
  const sep = /^[A-Za-z]:/.test(root) || root.includes('\\') ? '\\' : '/';
  const trimmedRoot = root.replace(/[/\\]+$/, '');
  const segments = relativePath === '' ? [] : relativePath.split('/');
  return [trimmedRoot, ...segments].join(sep);
}

/** Resolves `.`/`..` textually, the same way `domain/path-safety.ts`'s own (unexported)
 *  `segments()` does — a `..` pops the previous segment rather than being kept as a literal
 *  segment. Duplicated here rather than imported: `path-safety.ts` does not export it, and
 *  this task's own files are the only ones this fix round may touch. */
function resolvedSegments(p: string): string[] {
  const out: string[] = [];
  for (const part of p.replace(/\\/g, '/').split('/')) {
    if (part === '' || part === '.') continue;
    if (part === '..') { if (out.length > 0) out.pop(); continue; }
    out.push(part);
  }
  return out;
}

/** The POSIX path of `absolute` relative to `root`, or `null` when `absolute` is not inside
 *  `root` (`isContained`). `''` when `absolute` names the root itself. Fix round 1, review
 *  minor 4: both sides are resolved (not merely split) first, so
 *  `relativeInside('C:\\app', 'C:\\app\\..\\app\\x')` is `'x'`, never `'../app/x'` — an
 *  unresolved `..` earlier in `absolute` must not survive into the projected relative path. */
export function relativeInside(root: string, absolute: string, options?: { caseSensitive?: boolean }): string | null {
  if (!isContained(root, absolute, options)) return null;
  const rootSegments = resolvedSegments(root);
  const absoluteSegments = resolvedSegments(absolute);
  return absoluteSegments.slice(rootSegments.length).join('/');
}

/** True when `a` and `b` name the same root: each contains the other. Fix round 1, review
 *  minor 3: `caseSensitive` (default false, `isContained`'s own default) is the caller's own
 *  platform knowledge — this module never reads the platform itself. */
export function sameRoot(a: string, b: string, options?: { caseSensitive?: boolean }): boolean {
  return isContained(a, b, options) && isContained(b, a, options);
}
