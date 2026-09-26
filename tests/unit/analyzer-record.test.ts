// Part 7 Z1/Z2: the data.json `analyzers` slice, read and written as pure data. A newer
// format is read-only and never overwritten; a malformed or other-device record is never
// used and is replaced only by an explicit choice (bind) or deleted by Forget.
import { describe, expect, it } from 'vitest';
import { AnalyzerStoreError, applyAnalyzerWrite, decodeAnalyzerRecord } from '../../src/application/analysis/analyzer-record';

const M = 'machine-a';
const TRUST = { fingerprint: '0a1b2c3d', version: '3.27.0', grantedAt: '2026-09-23T10:00:00.000Z' };
const RECORD = { v: 1, provider: 'fallow', machineId: M, executablePath: 'C:\\Tools\\fallow\\fallow.exe', timeoutSeconds: 120, trust: TRUST };
const codeOf = (fn: () => unknown): string => {
  try { fn(); } catch (e) { return e instanceof AnalyzerStoreError ? e.code : 'other'; }
  return 'none';
};

describe('decodeAnalyzerRecord (Z2)', () => {
  it('reads each kind', () => {
    expect(decodeAnalyzerRecord(undefined, 'p1', M)).toEqual({ kind: 'none' });
    expect(decodeAnalyzerRecord({}, 'p1', M)).toEqual({ kind: 'none' });
    expect(decodeAnalyzerRecord({ p1: RECORD }, 'p1', M)).toEqual({
      kind: 'bound', binding: { profileId: 'p1', executablePath: RECORD.executablePath, timeoutSeconds: 120, trust: TRUST },
    });
    expect(decodeAnalyzerRecord({ p1: RECORD }, 'p1', 'machine-b')).toEqual({ kind: 'other-machine' });
    expect(decodeAnalyzerRecord({ p1: { ...RECORD, timeoutSeconds: 5 } }, 'p1', M)).toEqual({ kind: 'invalid' });
    expect(decodeAnalyzerRecord({ p1: { ...RECORD, extra: 1 } }, 'p1', M)).toEqual({ kind: 'invalid' });
    expect(decodeAnalyzerRecord({ p1: { ...RECORD, executablePath: 'C:\\Tools\\..\\fallow.exe' } }, 'p1', M)).toEqual({ kind: 'invalid' });
    expect(decodeAnalyzerRecord({ p1: { ...RECORD, trust: { ...TRUST, fingerprint: 'XYZ' } } }, 'p1', M)).toEqual({ kind: 'invalid' });
    expect(decodeAnalyzerRecord({ p1: { ...RECORD, v: 2 } }, 'p1', M)).toEqual({ kind: 'unsupported' });
    expect(decodeAnalyzerRecord({ p1: 'fallow.exe' }, 'p1', M)).toEqual({ kind: 'unsupported' });
    expect(decodeAnalyzerRecord([RECORD], 'p1', M)).toEqual({ kind: 'unsupported' });
  });

  it('never reads an Object.prototype member as a record', () => {
    expect(decodeAnalyzerRecord({}, 'constructor', M)).toEqual({ kind: 'none' });
  });

  it('refuses a path over 1,024 characters (K21)', () => {
    const long = `C:\\${'a'.repeat(1030)}\\fallow.exe`;
    expect(decodeAnalyzerRecord({ p1: { ...RECORD, executablePath: long } }, 'p1', M)).toEqual({ kind: 'invalid' });
  });
});

describe('applyAnalyzerWrite (Z2, Z3)', () => {
  it('bind writes a v1 record stamped with this machine, no trust, and the default time limit', () => {
    expect(applyAnalyzerWrite(undefined, 'p1', M, { op: 'bind', executablePath: 'C:\\Tools\\fallow\\fallow.exe' })).toEqual({
      p1: { v: 1, provider: 'fallow', machineId: M, executablePath: 'C:\\Tools\\fallow\\fallow.exe', timeoutSeconds: 120, trust: null },
    });
  });

  it('bind keeps a bound record\'s time limit, drops its trust, and leaves other entries verbatim', () => {
    const other = { v: 7, anything: true };
    const next = applyAnalyzerWrite({ p1: { ...RECORD, timeoutSeconds: 300 }, p2: other }, 'p1', M, { op: 'bind', executablePath: 'D:\\fallow.exe' });
    expect(next).toEqual({ p1: { ...RECORD, executablePath: 'D:\\fallow.exe', timeoutSeconds: 300, trust: null }, p2: other });
  });

  it('bind replaces an invalid or other-device record (an explicit user choice)', () => {
    expect(applyAnalyzerWrite({ p1: { ...RECORD, timeoutSeconds: 5 } }, 'p1', M, { op: 'bind', executablePath: 'D:\\fallow.exe' }))
      .toMatchObject({ p1: { executablePath: 'D:\\fallow.exe', timeoutSeconds: 120, machineId: M } });
    expect(applyAnalyzerWrite({ p1: { ...RECORD, machineId: 'machine-b' } }, 'p1', M, { op: 'bind', executablePath: 'D:\\fallow.exe' }))
      .toMatchObject({ p1: { machineId: M, timeoutSeconds: 120 } });
  });

  it('an unsupported entry or slice refuses every write, so it is never overwritten', () => {
    for (const slice of [{ p1: { ...RECORD, v: 2 } }, 'nonsense']) {
      for (const write of [
        { op: 'bind', executablePath: 'D:\\fallow.exe' }, { op: 'timeout', seconds: 60 }, { op: 'revoke' }, { op: 'forget' },
        { op: 'grant', trust: TRUST, expectedPath: RECORD.executablePath },
      ] as const) {
        expect(codeOf(() => applyAnalyzerWrite(slice, 'p1', M, write)), write.op).toBe('unsupported');
      }
    }
  });

  it('timeout, grant and revoke need a bound record; grant refuses a path that moved', () => {
    expect(codeOf(() => applyAnalyzerWrite(undefined, 'p1', M, { op: 'timeout', seconds: 60 }))).toBe('not-bound');
    expect(codeOf(() => applyAnalyzerWrite({ p1: { ...RECORD, machineId: 'machine-b' } }, 'p1', M, { op: 'revoke' }))).toBe('not-bound');
    expect(codeOf(() => applyAnalyzerWrite({ p1: RECORD }, 'p1', M, { op: 'grant', trust: TRUST, expectedPath: 'D:\\fallow.exe' }))).toBe('changed');
    expect(applyAnalyzerWrite({ p1: { ...RECORD, trust: null } }, 'p1', M, { op: 'grant', trust: TRUST, expectedPath: RECORD.executablePath }))
      .toEqual({ p1: RECORD });
    expect(applyAnalyzerWrite({ p1: RECORD }, 'p1', M, { op: 'revoke' })).toEqual({ p1: { ...RECORD, trust: null } });
    expect(applyAnalyzerWrite({ p1: RECORD }, 'p1', M, { op: 'timeout', seconds: 1800 })).toEqual({ p1: { ...RECORD, timeoutSeconds: 1800 } });
  });

  it('forget deletes a bound, invalid or other-device record, and is a no-op with none', () => {
    expect(applyAnalyzerWrite({ p1: RECORD, p2: RECORD }, 'p1', M, { op: 'forget' })).toEqual({ p2: RECORD });
    expect(applyAnalyzerWrite({ p1: { ...RECORD, timeoutSeconds: 5 } }, 'p1', M, { op: 'forget' })).toEqual({});
    expect(applyAnalyzerWrite({ p1: { ...RECORD, machineId: 'machine-b' } }, 'p1', M, { op: 'forget' })).toEqual({});
    expect(applyAnalyzerWrite(undefined, 'p1', M, { op: 'forget' })).toBeUndefined();
  });

  it('purge deletes the entry whatever its format (Z11), and leaves a non-object slice alone', () => {
    expect(applyAnalyzerWrite({ p1: { v: 9 }, p2: RECORD }, 'p1', M, { op: 'purge' })).toEqual({ p2: RECORD });
    expect(applyAnalyzerWrite('nonsense', 'p1', M, { op: 'purge' })).toBe('nonsense');
  });
});
