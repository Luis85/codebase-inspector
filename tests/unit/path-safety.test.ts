import { describe, expect, it } from 'vitest';
import { isContained, normalizeAbsolutePath, normalizeRelativePath } from '../../src/domain/path-safety';

describe('normalizeRelativePath', () => {
  it('normalises Windows relative separators', () => {
    expect(normalizeRelativePath('src\\domain\\test.ts')).toBe('src/domain/test.ts');
  });

  it('preserves Unicode path segments', () => {
    expect(normalizeRelativePath('src/énergie/Öffnung.ts')).toBe('src/énergie/Öffnung.ts');
  });

  it('rejects absolute paths, drive letters, traversal and empty segments', () => {
    for (const p of ['/etc/a.ts', 'C:\\a.ts', 'C:/a.ts', 'src/../a.ts', 'src//a.ts', './a.ts', '..']) {
      expect(() => normalizeRelativePath(p), p).toThrow();
    }
  });

  it('rejects control characters, empty strings and over-long paths', () => {
    expect(() => normalizeRelativePath('')).toThrow();
    expect(() => normalizeRelativePath('a\u0000b.ts')).toThrow();
    expect(() => normalizeRelativePath('a\u001fb.ts')).toThrow();
    expect(() => normalizeRelativePath('x'.repeat(1025))).toThrow();
  });
});

describe('isContained', () => {
  it('accepts a real descendant', () => {
    expect(isContained('C:\\Projects\\app', 'C:\\Projects\\app\\src\\a.ts')).toBe(true);
  });

  it('rejects a sibling sharing a prefix', () => {
    // The classic prefix collision: a string prefix test says yes, path.relative says no.
    expect(isContained('C:\\Projects\\app', 'C:\\Projects\\app-evil\\a.ts')).toBe(false);
  });

  it('rejects traversal out of the root', () => {
    expect(isContained('C:\\Projects\\app', 'C:\\Projects\\app\\..\\other\\a.ts')).toBe(false);
  });

  it('treats the root itself as contained', () => {
    expect(isContained('C:\\Projects\\app', 'C:\\Projects\\app')).toBe(true);
  });

  // Ruling M20: isContained's default (no options) must be UNCHANGED case-insensitive
  // behaviour, so every test above stays green without modification.
  it('defaults to case-insensitive, unchanged from before the option existed', () => {
    expect(isContained('/root/foo', '/root/Foo/x')).toBe(true);
  });

  it('POSIX-style case-sensitive: a differently-cased segment is NOT contained', () => {
    expect(isContained('/root/foo', '/root/Foo/x', { caseSensitive: true })).toBe(false);
  });

  it('Windows-style case-insensitive: a differently-cased drive and segment IS contained', () => {
    expect(isContained('C:\\Root\\Foo', 'c:\\root\\foo\\x', { caseSensitive: false })).toBe(true);
  });

  // Fix wave item 3 (I2, Important). The case-insensitive branch used to compare with
  // `localeCompare(other, undefined, { sensitivity: 'accent' })`, a full Unicode
  // collation -- not the ordinal case fold `path.relative` performs on Windows, which
  // this function's own doc claimed equivalence to. Default-ignorable code points
  // collate AWAY under that comparison, so a path OUTSIDE the approved root read as
  // INSIDE it: the wrong failure direction for a containment boundary. It was also
  // locale-dependent (a Turkish-locale host answers the opposite for I/i) and cost
  // 949 ms / 2,090 ms per 40,000 entries against 83 ms for toLowerCase, paid
  // synchronously on the renderer thread before any read.
  it('a default-ignorable code point does not collate away: SHY makes a DIFFERENT directory', () => {
    // 'C:\app\u00AD' is a genuinely different directory from 'C:\app' on Windows.
    expect(isContained('C:\\app', 'C:\\app\u00AD\\secret')).toBe(false);
    expect(isContained('C:\\app', 'C:\\app\u00AD\\secret', { caseSensitive: false })).toBe(false);
    expect(isContained('C:\\app', 'C:\\app\u00AD\\secret', { caseSensitive: true })).toBe(false);
  });

  it('a zero-width space does not collate away either', () => {
    expect(isContained('/root/a', '/root/a\u200B/x')).toBe(false);
    expect(isContained('/root/a', '/root/a\u200B/x', { caseSensitive: false })).toBe(false);
    expect(isContained('/root/a', '/root/a\u200B/x', { caseSensitive: true })).toBe(false);
  });

  it('still contains the genuinely identical segment under both modes', () => {
    expect(isContained('C:\\app\u00AD', 'C:\\app\u00AD\\secret', { caseSensitive: false })).toBe(true);
    expect(isContained('C:\\app\u00AD', 'C:\\app\u00AD\\secret', { caseSensitive: true })).toBe(true);
  });

  it('prefix collision is rejected under BOTH case modes', () => {
    expect(isContained('C:\\Projects\\app', 'C:\\Projects\\app-evil\\a.ts', { caseSensitive: true })).toBe(false);
    expect(isContained('C:\\Projects\\app', 'C:\\Projects\\app-evil\\a.ts', { caseSensitive: false })).toBe(false);
  });
});

// Task 12, carried finding 1 (task-12-context.md §2.1): `source-modal.ts`'s external
// mode accepted and DISPLAYED an unnormalised path as the consent root -- the walk
// itself is correctly contained (verified independently, twice), so this is a
// consent-DISPLAY defect: the screen named a directory that is not the one that would
// be read. Normalising here, in the domain, is what lets the modal show the root it
// will actually walk.
describe('normalizeAbsolutePath', () => {
  it('collapses .. so the displayed root is the one that will be walked', () => {
    expect(normalizeAbsolutePath('C:\\Projects\\..\\Windows\\System32')).toBe('C:\\Windows\\System32');
    expect(normalizeAbsolutePath('/home/user/../root/secret')).toBe('/home/root/secret');
  });

  it('collapses . segments and duplicate separators', () => {
    expect(normalizeAbsolutePath('C:\\Projects\\.\\app\\\\src')).toBe('C:\\Projects\\app\\src');
    expect(normalizeAbsolutePath('/home//user/./project')).toBe('/home/user/project');
  });

  it('keeps the input separator style, so a Windows path stays a Windows path', () => {
    expect(normalizeAbsolutePath('C:/Projects/app')).toBe('C:\\Projects\\app');
    expect(normalizeAbsolutePath('C:\\Projects\\app')).toBe('C:\\Projects\\app');
    expect(normalizeAbsolutePath('/home/user')).toBe('/home/user');
  });

  it('returns a bare drive root and a bare POSIX root unchanged', () => {
    expect(normalizeAbsolutePath('C:\\')).toBe('C:\\');
    expect(normalizeAbsolutePath('/')).toBe('/');
  });

  it('preserves a UNC prefix', () => {
    expect(normalizeAbsolutePath('\\\\server\\share\\a\\..\\b')).toBe('\\\\server\\share\\b');
  });

  it('rejects a relative path -- this mode is documented as absolute', () => {
    expect(() => normalizeAbsolutePath('Projects/app')).toThrow(/absolute/i);
    expect(() => normalizeAbsolutePath('')).toThrow();
  });

  it('rejects a .. that would escape above the root, rather than silently clamping', () => {
    expect(() => normalizeAbsolutePath('C:\\..\\elsewhere')).toThrow(/above the root/i);
    expect(() => normalizeAbsolutePath('/../etc')).toThrow(/above the root/i);
  });

  it('rejects control characters and over-long input, exactly as the relative form does', () => {
    expect(() => normalizeAbsolutePath('/home/user/a\u0000b')).toThrow(/control characters/i);
    expect(() => normalizeAbsolutePath(`/${'x'.repeat(1100)}`)).toThrow(/1024/);
  });
});
