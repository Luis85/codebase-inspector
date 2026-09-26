// Part 7 Z6/Z7: trust is a fingerprint of exactly what was reviewed, never a boolean. Any
// change to what it covers makes it stale, and the run's time limit is not one of them.
import { describe, expect, it } from 'vitest';
import { fingerprintTrust, isTrustCurrent, type TrustSubject } from '../../src/application/analysis/analyzer-trust';
import { FALLOW_RUN_ARGS } from '../../src/application/analysis/fallow-invocation';
import type { ExecutableFacts } from '../../src/application/ports/executable-inspector';

const FACTS: ExecutableFacts = {
  executablePath: 'C:\\Tools\\fallow\\fallow.exe', realPath: 'C:\\Tools\\fallow\\fallow.exe',
  size: 12_400_000, mtimeMs: 1_758_600_000_123.75, format: 'pe', insideRoot: false,
};
function subject(overrides: Partial<TrustSubject> = {}, facts: Partial<ExecutableFacts> = {}): TrustSubject {
  return { profileId: 'p1', machineId: 'm1', rootPath: 'C:\\repo', args: FALLOW_RUN_ARGS('C:\\repo'), facts: { ...FACTS, ...facts }, ...overrides };
}
const BASE = fingerprintTrust(subject(), '3.27.0');

describe('fingerprintTrust (Z6)', () => {
  it('is eight lower-case hex digits and the same for the same inputs', () => {
    expect(BASE).toMatch(/^[0-9a-f]{8}$/);
    expect(fingerprintTrust(subject(), '3.27.0')).toBe(BASE);
  });

  it.each<[string, TrustSubject, string]>([
    ['the profile', subject({ profileId: 'p2' }), '3.27.0'],
    ['the machine', subject({ machineId: 'm2' }), '3.27.0'],
    ['the executable path', subject({}, { executablePath: 'C:\\Tools\\fallow2\\fallow.exe' }), '3.27.0'],
    ['the real path', subject({}, { realPath: 'D:\\cache\\fallow.exe' }), '3.27.0'],
    ['the size', subject({}, { size: 12_400_001 }), '3.27.0'],
    ['the modification time, to the millisecond', subject({}, { mtimeMs: 1_758_600_000_124 }), '3.27.0'],
    ['the root', subject({ rootPath: 'C:\\other', args: FALLOW_RUN_ARGS('C:\\repo') }), '3.27.0'],
    ['the arguments', subject({ args: [...FALLOW_RUN_ARGS('C:\\repo'), '--production'] }), '3.27.0'],
    ['the version', subject(), '3.28.0'],
  ])('changes when %s changes', (_label, changed, version) => {
    expect(fingerprintTrust(changed, version)).not.toBe(BASE);
  });

  it('ignores the sub-millisecond part of the modification time', () => {
    expect(fingerprintTrust(subject({}, { mtimeMs: 1_758_600_000_123.2 }), '3.27.0')).toBe(BASE);
  });

  it('treats a root that differs only in case as a different root (M29: re-ask, never widen consent)', () => {
    expect(fingerprintTrust(subject({ rootPath: 'c:\\REPO' }), '3.27.0')).not.toBe(BASE);
  });

  it('Review Focus 2: a path with spaces and non-ASCII characters fingerprints stably, and differs from its NFD spelling', () => {
    const nfc = subject({ rootPath: 'C:\\Users\\J\u00f6rg\\my repo' }, { executablePath: 'C:\\Program Files\\fallow\\fallow.exe' });
    const nfd = subject({ rootPath: 'C:\\Users\\Jo\u0308rg\\my repo' }, { executablePath: 'C:\\Program Files\\fallow\\fallow.exe' });
    expect(fingerprintTrust(nfc, '3.27.0')).toBe(fingerprintTrust(nfc, '3.27.0'));
    expect(fingerprintTrust(nfc, '3.27.0')).not.toBe(fingerprintTrust(nfd, '3.27.0'));
  });
});

describe('isTrustCurrent (Z7)', () => {
  const trust = { fingerprint: BASE, version: '3.27.0', grantedAt: '2026-09-23T10:00:00.000Z' };

  it('is never current without a trust record', () => {
    expect(isTrustCurrent(null, subject(), '3.27.0')).toBe(false);
  });

  it('is current only for the same subject and the same version', () => {
    expect(isTrustCurrent(trust, subject(), '3.27.0')).toBe(true);
    expect(isTrustCurrent(trust, subject(), '3.28.0')).toBe(false);
    expect(isTrustCurrent(trust, subject({}, { size: 1 }), '3.27.0')).toBe(false);
    expect(isTrustCurrent({ ...trust, fingerprint: '00000000' }, subject(), '3.27.0')).toBe(false);
  });
});
