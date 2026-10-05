// Fix round 1 (review minors 3 and 4): direct coverage for root-path.ts, which previously
// had none of its own — only the indirect exercise `source-preview.ts`'s tests gave it.
import { describe, expect, it } from 'vitest';
import { joinRootPath, relativeInside, sameRoot } from '../../src/application/investigation/root-path';

describe('joinRootPath', () => {
  it('uses backslash for a drive-letter root and trims trailing separators', () => {
    expect(joinRootPath('C:\\app\\', 'a/b')).toBe('C:\\app\\a\\b');
  });

  it('uses backslash when the root already holds one, even without a drive letter', () => {
    expect(joinRootPath('\\\\srv\\share', 'a/b')).toBe('\\\\srv\\share\\a\\b');
  });

  it('uses forward slash for a POSIX root', () => {
    expect(joinRootPath('/home/project/', 'src/a.ts')).toBe('/home/project/src/a.ts');
  });

  it('the empty relative path joins to just the trimmed root', () => {
    expect(joinRootPath('/home/project/', '')).toBe('/home/project');
  });
});

describe('relativeInside', () => {
  it('the POSIX path of an absolute path inside the root', () => {
    expect(relativeInside('/home/project', '/home/project/src/a.ts')).toBe('src/a.ts');
  });

  it('is the empty string when absolute names the root itself', () => {
    expect(relativeInside('/home/project', '/home/project')).toBe('');
  });

  it('is null outside the root', () => {
    expect(relativeInside('/home/project', '/home/other')).toBeNull();
    expect(relativeInside('/home/project', '/home/project-evil')).toBeNull();
  });

  // Fix round 1, review minor 4: a `..` earlier in the path must be RESOLVED (the way
  // path-safety.ts's own `segments()` resolves it), never carried through literally into
  // the projected relative path.
  it('resolves an internal .. instead of carrying it into the result', () => {
    expect(relativeInside('C:\\app', 'C:\\app\\..\\app\\x')).toBe('x');
  });

  it('resolves . and mixed separators', () => {
    expect(relativeInside('/home/project', '/home/./project/src/../src/a.ts')).toBe('src/a.ts');
  });
});

describe('sameRoot', () => {
  it('is true for identical roots', () => {
    expect(sameRoot('/home/project', '/home/project')).toBe(true);
  });

  it('is false for a different or nested path', () => {
    expect(sameRoot('/home/project', '/home/project/sub')).toBe(false);
    expect(sameRoot('/home/project', '/home/other')).toBe(false);
  });

  // Fix round 1, review minor 3.
  it('is case-insensitive by default', () => {
    expect(sameRoot('/home/Project', '/home/project')).toBe(true);
  });

  it('is case-sensitive when asked', () => {
    expect(sameRoot('/home/Project', '/home/project', { caseSensitive: true })).toBe(false);
    expect(sameRoot('/home/project', '/home/project', { caseSensitive: true })).toBe(true);
  });
});
