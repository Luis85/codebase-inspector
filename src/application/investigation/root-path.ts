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

/** The POSIX path of `absolute` relative to `root`, or `null` when `absolute` is not inside
 *  `root` (`isContained`). `''` when `absolute` names the root itself. */
export function relativeInside(root: string, absolute: string): string | null {
  if (!isContained(root, absolute)) return null;
  const rootSegments = root.replace(/\\/g, '/').split('/').filter((s) => s !== '' && s !== '.');
  const absoluteSegments = absolute.replace(/\\/g, '/').split('/').filter((s) => s !== '' && s !== '.');
  return absoluteSegments.slice(rootSegments.length).join('/');
}

/** True when `a` and `b` name the same root: each contains the other. */
export function sameRoot(a: string, b: string): boolean {
  return isContained(a, b) && isContained(b, a);
}
