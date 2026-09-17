import { describe, expect, it } from 'vitest';
import { isContained, normalizeRelativePath } from '../../src/domain/path-safety';

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
});
