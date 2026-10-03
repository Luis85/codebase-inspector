import { describe, expect, it } from 'vitest';
import { makeEntityId, parseEntityId } from '../../src/domain/entity-id';

describe('makeEntityId', () => {
  it('is repository id, entity kind and POSIX root-relative path, NUL-joined', () => {
    expect(makeEntityId('repo-1', 'file', 'src/a.ts')).toBe('repo-1\0file\0src/a.ts');
  });

  it('is stable across rescans and carries no hash', () => {
    expect(makeEntityId('repo-1', 'file', 'src/a.ts')).toBe(makeEntityId('repo-1', 'file', 'src/a.ts'));
    expect(makeEntityId('repo-1', 'file', 'src/a.ts')).not.toMatch(/[0-9a-f]{16}/);
  });

  it('distinguishes a directory from a file at the same path', () => {
    expect(makeEntityId('r', 'directory', 'src')).not.toBe(makeEntityId('r', 'file', 'src'));
  });

  it('round-trips', () => {
    expect(parseEntityId(makeEntityId('r', 'file', 'src/a.ts')))
      .toEqual({ repositoryId: 'r', kind: 'file', path: 'src/a.ts' });
  });

  it('rejects a component containing NUL', () => {
    expect(() => makeEntityId('r\0x', 'file', 'a.ts')).toThrow();
    expect(() => makeEntityId('r', 'file', 'a\0b.ts')).toThrow();
  });
});
