import { describe, expect, it } from 'vitest';
import { libuvAtLeast } from '../../scripts/native-node-guard.mjs';

describe('native Node guard (GRD1 step 7, GCN7)', () => {
  it('refuses the libuv shipped with Node 24.15.0 (1.51.0)', () => {
    expect(libuvAtLeast('1.51.0', '1.52.0')).toBe(false);
  });

  it('accepts the libuv shipped with Node 24.16.0 and newer (1.52.1)', () => {
    expect(libuvAtLeast('1.52.1', '1.52.0')).toBe(true);
  });

  it('accepts the exact minimum', () => {
    expect(libuvAtLeast('1.52.0', '1.52.0')).toBe(true);
  });

  it('compares numerically, not as text (1.100.0 is newer than 1.52.0)', () => {
    expect(libuvAtLeast('1.100.0', '1.52.0')).toBe(true);
    expect(libuvAtLeast('1.9.0', '1.52.0')).toBe(false);
  });

  it('lets a newer major pass and an older major fail', () => {
    expect(libuvAtLeast('2.0.0', '1.52.0')).toBe(true);
    expect(libuvAtLeast('0.99.99', '1.52.0')).toBe(false);
  });

  it('ignores a vendor suffix such as 1.52.1-dev', () => {
    expect(libuvAtLeast('1.52.1-dev', '1.52.0')).toBe(true);
    expect(libuvAtLeast('1.51.0-dev', '1.52.0')).toBe(false);
  });

  it('treats an unparsable version as too old', () => {
    expect(libuvAtLeast('', '1.52.0')).toBe(false);
    expect(libuvAtLeast('unknown', '1.52.0')).toBe(false);
  });
});
