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

/** The ABSOLUTE counterpart of `normalizeRelativePath`, for the one place a user types
 *  an absolute path: the source modal's external mode (task-12-context.md §2, carried
 *  finding 1). `C:\\Projects\\..\\Windows\\System32` was accepted AND DISPLAYED as the
 *  root being approved, while the walk -- correctly contained, verified independently
 *  twice -- would read `C:\\Windows\\System32`. That is a consent-display defect: the
 *  screen named a directory that is not the one that gets read, which is the one thing
 *  a consent artefact may never do.
 *
 *  Pure and syntactic: it resolves `.` and `..` textually and touches no filesystem
 *  (src/domain may not), so it says what the path MEANS, never whether it exists --
 *  that remains the single `stat()` the modal already performs afterwards. A `..` that
 *  would climb above the root THROWS rather than being clamped away: clamping would
 *  quietly turn one path into a different, valid-looking one, which is the same class
 *  of lie this function exists to stop. The input's own separator style is preserved,
 *  so a Windows path stays a Windows path in `data.json` and on screen (the same
 *  reasoning as `joinVaultPath`'s in source-modal.ts). */
export function normalizeAbsolutePath(value: string): string {
  if (typeof value !== 'string' || value.length === 0 || value.length > MAX_PATH_LENGTH) {
    throw new Error(`An absolute path must be a non-empty string of at most ${MAX_PATH_LENGTH} characters.`);
  }
  if (CONTROL_CHARS.test(value)) {
    throw new Error('An absolute path must not contain control characters.');
  }
  const posix = value.replace(/\\/g, '/');
  const unc = /^(?:\\\\|\/\/)/.test(value);
  const drive = /^[A-Za-z]:/.exec(posix)?.[0] ?? null;
  // A drive letter makes it a Windows path whatever separator was typed: emitting
  // `C:/Projects/app` would persist exactly the MIXED-separator root `joinVaultPath`
  // (source-modal.ts, fix round 6) already had to be fixed for once.
  const sep = drive !== null || value.includes('\\') ? '\\' : '/';
  const rooted = drive !== null || posix.startsWith('/');
  if (!rooted) {
    throw new Error('That path must be absolute — a path relative to something else cannot be read reliably.');
  }
  const body = drive !== null ? posix.slice(drive.length) : posix;
  const resolved: string[] = [];
  for (const part of body.split('/')) {
    if (part === '' || part === '.') continue;
    if (part === '..') {
      if (resolved.length === 0) throw new Error('That path climbs above the root: it names nothing readable.');
      resolved.pop();
      continue;
    }
    resolved.push(part);
  }
  const tail = resolved.join(sep);
  if (drive !== null) return `${drive}${sep}${tail}`;
  return `${unc ? sep + sep : sep}${tail}`;
}

/** One EXCLUSION line, which is a relative path and nothing more (fix wave item 1, M1).
 *
 *  Deliberately stricter than `normalizeRelativePath` alone, and deliberately NOT folded
 *  into it: an entity path in a snapshot legitimately describes a real file, and a real
 *  file may be named `a*.ts` on a POSIX filesystem. An EXCLUSION, by contrast, is matched
 *  by `walker.ts`'s `isExcluded`, which does exact segment/prefix comparison and has no
 *  glob support whatsoever — so a `*` or `?` here is silently inert: accepted, persisted,
 *  redisplayed on the consent screen as an approved exclusion, and excluding nothing.
 *  Spec §1 forbids a rendered control for unimplemented behaviour; refusing the input is
 *  the honest answer until a walker exists that can honour it. */
export function normalizeExclusion(value: string): string {
  if (typeof value === 'string' && /[*?]/.test(value)) {
    throw new Error('An exclusion is a plain relative path: * and ? are not supported.');
  }
  return normalizeRelativePath(value);
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

/** Segment-wise, so C:\app-evil is not inside C:\app. Equivalent to path.resolve plus a
 *  path.relative sign check (spec 4.4), whose case behaviour is platform-dependent:
 *  case-insensitive on Windows, case-sensitive on POSIX. `options.caseSensitive` selects
 *  which; it defaults to `false` (case-insensitive), preserving this function's original
 *  behaviour so every caller written before this option existed keeps working unchanged.
 *  `src/domain/**` may not read the platform (it is forbidden from importing Node or any
 *  host API), so it cannot decide this itself — ruling M20: the ADAPTER layer decides,
 *  based on the platform it is actually running on, and passes the decision in here on
 *  every call.
 *
 *  Comparison is ORDINAL in both modes: `===`, or `toLowerCase()` on both sides. Fix
 *  wave item 3 (I2): the insensitive branch used to be
 *  `localeCompare(other, undefined, { sensitivity: 'accent' })`, which is a full Unicode
 *  collation and NOT what `path.relative` does — Windows folds case ordinally. Three
 *  consequences, all measured: (1) default-ignorable code points collate away, so
 *  `isContained('C:\app', 'C:\app\u00AD\secret')` answered TRUE for a genuinely
 *  different directory — "outside reads as inside", the wrong failure direction for a
 *  containment boundary; (2) the answer depended on the host's locale (a Turkish-locale
 *  host inverts I/i); (3) it cost 949 ms for a 3-segment root and 2,090 ms for a
 *  7-segment one over 40,000 entries, against 83 ms for `toLowerCase`, paid
 *  synchronously on the Obsidian renderer thread by `classifyEntry` on every entry
 *  before any read. `String.prototype.toLowerCase` is locale-INDEPENDENT (unlike
 *  `toLocaleLowerCase`), which is what makes this deterministic — and it is the exact
 *  comparison `walker.ts`'s `isExcluded` already used thirty lines away, so the codebase
 *  no longer holds two different definitions of "case-insensitive". */
export function isContained(root: string, candidate: string, options?: { caseSensitive?: boolean }): boolean {
  const caseSensitive = options?.caseSensitive ?? false;
  const r = segments(root);
  const c = segments(candidate);
  if (r[0] === '\u0000INVALID' || c[0] === '\u0000INVALID') return false;
  if (c.length < r.length) return false;
  return r.every((part, i) => {
    const other = c[i]!;
    return caseSensitive ? part === other : part.toLowerCase() === other.toLowerCase();
  });
}
