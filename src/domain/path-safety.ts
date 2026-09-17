const MAX_PATH_LENGTH = 1024;
// eslint-disable-next-line no-control-regex -- detecting control characters is the point.
const CONTROL_CHARS = /[\u0000-\u001f\u007f]/;

/**
 * POSIX, root-relative, safe. This is NOT Obsidian's normalizePath(), which is
 * vault-relative only: it strips leading slashes and does not remove `..`, so it
 * offers no path safety at all (spec 4.4).
 */
export function normalizeRelativePath(value: string): string {
  if (typeof value !== 'string' || value.length === 0 || value.length > MAX_PATH_LENGTH) {
    throw new Error(`A relative path must be a non-empty string of at most ${MAX_PATH_LENGTH} characters.`);
  }
  if (CONTROL_CHARS.test(value)) {
    throw new Error('A relative path must not contain control characters.');
  }
  const path = value.replace(/\\/g, '/');
  if (/^(\/|[A-Za-z]:)/.test(path)) {
    throw new Error('A relative path must not be absolute or carry a drive letter.');
  }
  if (path.split('/').some((seg) => seg === '' || seg === '.' || seg === '..')) {
    throw new Error('A relative path must have no empty segments and no . or .. segments.');
  }
  return path;
}

/** Resolves a Windows or POSIX path string into its normalised segments, dropping
 *  empty and `.` segments and flagging a `..` that would escape above the root. */
function segments(p: string): string[] {
  const out: string[] = [];
  for (const part of p.replace(/\\/g, '/').split('/')) {
    if (part === '' || part === '.') continue;
    if (part === '..') { if (out.length === 0) return ['\u0000INVALID']; out.pop(); continue; }
    out.push(part);
  }
  return out;
}

/** Case-insensitive on Windows drive letters; segment-wise, so C:\app-evil is not
 *  inside C:\app. Equivalent to path.resolve + a path.relative sign check (spec 4.4). */
export function isContained(root: string, candidate: string): boolean {
  const r = segments(root);
  const c = segments(candidate);
  if (r[0] === '\u0000INVALID' || c[0] === '\u0000INVALID') return false;
  if (c.length < r.length) return false;
  return r.every((part, i) => part.localeCompare(c[i]!, undefined, { sensitivity: 'accent' }) === 0);
}
