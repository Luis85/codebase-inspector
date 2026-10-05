// Part 7 Z1/Z2 + Part B GRB10/GCO23: the data.json `analyzers` slice, read and written as pure
// data. Record v2 keeps one binding per device; a v1 record reads as one device and is migrated
// by the next write; a newer format is read-only and never overwritten; a malformed device reads
// as invalid with a reason and is replaced only by an explicit choice (bind) or removed by Forget.
import { describe, expect, it } from 'vitest';
import { AnalyzerStoreError, applyAnalyzerWrite, decodeAnalyzerRecord, type AnalyzerBindingRead } from '../../src/application/analysis/analyzer-record';

const M = 'machine-a';
const B = 'machine-b';
const TRUST = { fingerprint: '0a1b2c3d', version: '3.27.0', grantedAt: '2026-09-23T10:00:00.000Z' };
const DEVICE = { executablePath: 'C:\\Tools\\fallow\\fallow.exe', timeoutSeconds: 120, trust: TRUST };
const V1 = { v: 1, provider: 'fallow', machineId: M, ...DEVICE };
const v2 = (devices: Record<string, unknown>): unknown => ({ v: 2, provider: 'fallow', devices });
const RECORD = v2({ [M]: DEVICE });
const codeOf = (fn: () => unknown): string => {
  try { fn(); } catch (e) { return e instanceof AnalyzerStoreError ? e.code : 'other'; }
  return 'none';
};
const bound = (device: typeof DEVICE) => ({ kind: 'bound', binding: { profileId: 'p1', ...device } });
/** The reason of an invalid read, or the read's kind in angle brackets when it is not invalid. */
const reasonOf = (read: AnalyzerBindingRead): string => (read.kind === 'invalid' ? read.reason : `<${read.kind}>`);

describe('decodeAnalyzerRecord (Z2, GRB10)', () => {
  it('reads each kind', () => {
    expect(decodeAnalyzerRecord(undefined, 'p1', M)).toEqual({ kind: 'none' });
    expect(decodeAnalyzerRecord({}, 'p1', M)).toEqual({ kind: 'none' });
    expect(decodeAnalyzerRecord({ p1: RECORD }, 'p1', M)).toEqual(bound(DEVICE));
    expect(decodeAnalyzerRecord({ p1: { ...(RECORD as object), v: 3 } }, 'p1', M)).toEqual({ kind: 'unsupported' });
    expect(decodeAnalyzerRecord({ p1: 'fallow.exe' }, 'p1', M)).toEqual({ kind: 'unsupported' });
    expect(decodeAnalyzerRecord([RECORD], 'p1', M)).toEqual({ kind: 'unsupported' });
  });

  it('(d) v: 3 and a missing or non-numeric v read unsupported', () => {
    for (const entry of [{ v: 3, provider: 'fallow', devices: {} }, { provider: 'fallow', devices: {} }, { v: '2', provider: 'fallow', devices: {} }]) {
      expect(decodeAnalyzerRecord({ p1: entry }, 'p1', M)).toEqual({ kind: 'unsupported' });
    }
  });

  it('reads a device that has no entry as none, however many other devices are bound', () => {
    expect(decodeAnalyzerRecord({ p1: RECORD }, 'p1', B)).toEqual({ kind: 'none' });
    expect(decodeAnalyzerRecord({ p1: v2({}) }, 'p1', M)).toEqual({ kind: 'none' });
  });

  it('(b) reads a v1 record as a one-device v2: bound on its device, none on any other', () => {
    expect(decodeAnalyzerRecord({ p1: V1 }, 'p1', M)).toEqual(bound(DEVICE));
    expect(decodeAnalyzerRecord({ p1: V1 }, 'p1', B)).toEqual({ kind: 'none' });
  });

  it('(c) an invalid device reads invalid with a reason naming the field; the other device still reads bound', () => {
    const relative = { ...DEVICE, executablePath: 'fallow.exe' };
    const slice = { p1: v2({ [M]: relative, [B]: DEVICE }) };
    expect(reasonOf(decodeAnalyzerRecord(slice, 'p1', M))).toContain('executablePath');
    expect(decodeAnalyzerRecord(slice, 'p1', B)).toEqual(bound(DEVICE));
  });

  it('reasons name the offending field for each malformed device', () => {
    const reason = (device: unknown): string => reasonOf(decodeAnalyzerRecord({ p1: v2({ [M]: device }) }, 'p1', M));
    expect(reason({ ...DEVICE, timeoutSeconds: 5 })).toContain('timeoutSeconds');
    expect(reason({ ...DEVICE, extra: 1 })).toContain('extra');
    expect(reason({ ...DEVICE, executablePath: 'C:\\Tools\\..\\fallow.exe' })).toContain('executablePath');
    expect(reason({ ...DEVICE, trust: { ...TRUST, fingerprint: 'XYZ' } })).toContain('fingerprint');
    expect(reason({ ...DEVICE, executablePath: `C:\\${'a'.repeat(1030)}\\fallow.exe` })).toContain('executablePath');
    expect(reason('fallow.exe')).not.toMatch(/^</);
  });

  it('an invalid v1 record or v2 envelope reads invalid with a reason', () => {
    const reasonFor = (entry: unknown): string => reasonOf(decodeAnalyzerRecord({ p1: entry }, 'p1', M));
    expect(reasonFor({ ...V1, timeoutSeconds: 5 })).toContain('timeoutSeconds');
    expect(reasonFor({ ...V1, extra: 1 })).toContain('extra');
    expect(reasonFor({ v: 2, provider: 'fallow' })).toContain('devices');
    expect(reasonFor({ v: 2, provider: 'fallow', devices: {}, extra: 1 })).toContain('extra');
  });

  it('E44 a: an invalid v1 record owned by another device reads none here, and invalid (with its reason) on its owner', () => {
    const foreign = { ...V1, timeoutSeconds: 5 };
    expect(decodeAnalyzerRecord({ p1: foreign }, 'p1', B)).toEqual({ kind: 'none' });
    expect(reasonOf(decodeAnalyzerRecord({ p1: foreign }, 'p1', M))).toContain('timeoutSeconds');
  });

  it('E44 c: an envelope whose provider is not fallow reads unsupported (v1 and v2)', () => {
    expect(decodeAnalyzerRecord({ p1: { v: 2, provider: 'x', devices: { [M]: DEVICE } } }, 'p1', M)).toEqual({ kind: 'unsupported' });
    expect(decodeAnalyzerRecord({ p1: { ...V1, provider: 'x' } }, 'p1', M)).toEqual({ kind: 'unsupported' });
  });

  it('never reads an Object.prototype member as a record or a device', () => {
    expect(decodeAnalyzerRecord({}, 'constructor', M)).toEqual({ kind: 'none' });
    expect(decodeAnalyzerRecord({ p1: v2({}) }, 'p1', 'constructor')).toEqual({ kind: 'none' });
  });
});

describe('applyAnalyzerWrite (Z2, Z3, GRB10)', () => {
  it('bind writes a v2 record with this device, no trust, and the default time limit', () => {
    expect(applyAnalyzerWrite(undefined, 'p1', M, { op: 'bind', executablePath: DEVICE.executablePath })).toEqual({
      p1: v2({ [M]: { executablePath: DEVICE.executablePath, timeoutSeconds: 120, trust: null } }),
    });
  });

  it('bind keeps this device\'s time limit, drops its trust, and leaves other profiles verbatim', () => {
    const other = { v: 7, anything: true };
    const next = applyAnalyzerWrite({ p1: v2({ [M]: { ...DEVICE, timeoutSeconds: 300 } }), p2: other }, 'p1', M, { op: 'bind', executablePath: 'D:\\fallow.exe' });
    expect(next).toEqual({ p1: v2({ [M]: { executablePath: 'D:\\fallow.exe', timeoutSeconds: 300, trust: null } }), p2: other });
  });

  it('(a) a bind on machine B keeps machine A bound', () => {
    const afterA = applyAnalyzerWrite(undefined, 'p1', M, { op: 'bind', executablePath: DEVICE.executablePath });
    const afterB = applyAnalyzerWrite(afterA, 'p1', B, { op: 'bind', executablePath: 'D:\\fallow.exe' });
    expect(decodeAnalyzerRecord(afterB, 'p1', M)).toMatchObject({ kind: 'bound', binding: { executablePath: DEVICE.executablePath } });
    expect(decodeAnalyzerRecord(afterB, 'p1', B)).toMatchObject({ kind: 'bound', binding: { executablePath: 'D:\\fallow.exe' } });
  });

  it('(a) timeout, grant and revoke on one device leave the other device untouched', () => {
    const slice = { p1: v2({ [M]: { ...DEVICE, trust: null }, [B]: DEVICE }) };
    const granted = applyAnalyzerWrite(slice, 'p1', M, { op: 'grant', trust: TRUST, expectedPath: DEVICE.executablePath });
    expect(granted).toEqual({ p1: v2({ [M]: DEVICE, [B]: DEVICE }) });
    expect(applyAnalyzerWrite(granted, 'p1', M, { op: 'revoke' })).toEqual({ p1: v2({ [M]: { ...DEVICE, trust: null }, [B]: DEVICE }) });
    expect(applyAnalyzerWrite(slice, 'p1', M, { op: 'timeout', seconds: 1800 })).toEqual({ p1: v2({ [M]: { ...DEVICE, trust: null, timeoutSeconds: 1800 }, [B]: DEVICE }) });
  });

  it('(b) the next write on a v1 device stores v2 with that device', () => {
    expect(applyAnalyzerWrite({ p1: V1 }, 'p1', M, { op: 'timeout', seconds: 300 })).toEqual({ p1: v2({ [M]: { ...DEVICE, timeoutSeconds: 300 } }) });
    expect(applyAnalyzerWrite({ p1: V1 }, 'p1', M, { op: 'revoke' })).toEqual({ p1: v2({ [M]: { ...DEVICE, trust: null } }) });
  });

  it('(b) a write on another device migrates a v1 record and keeps its device', () => {
    const next = applyAnalyzerWrite({ p1: V1 }, 'p1', B, { op: 'bind', executablePath: 'D:\\fallow.exe' });
    expect(next).toEqual({ p1: v2({ [M]: DEVICE, [B]: { executablePath: 'D:\\fallow.exe', timeoutSeconds: 120, trust: null } }) });
    expect(decodeAnalyzerRecord(next, 'p1', M)).toEqual(bound(DEVICE));
  });

  it('(c) bind on an invalid device replaces only that device and keeps the others verbatim', () => {
    const bad = { ...DEVICE, executablePath: 'fallow.exe' };
    const kept = { executablePath: 'E:\\x\\fallow.exe', timeoutSeconds: 5, trust: null };
    const next = applyAnalyzerWrite({ p1: v2({ [M]: bad, [B]: DEVICE, c: kept }) }, 'p1', M, { op: 'bind', executablePath: 'D:\\fallow.exe' });
    expect(next).toEqual({ p1: v2({ [B]: DEVICE, c: kept, [M]: { executablePath: 'D:\\fallow.exe', timeoutSeconds: 120, trust: null } }) });
  });

  it('bind on an invalid v1 record or an invalid envelope replaces it (an explicit user choice)', () => {
    expect(applyAnalyzerWrite({ p1: { ...V1, timeoutSeconds: 5 } }, 'p1', M, { op: 'bind', executablePath: 'D:\\fallow.exe' }))
      .toEqual({ p1: v2({ [M]: { executablePath: 'D:\\fallow.exe', timeoutSeconds: 120, trust: null } }) });
    expect(applyAnalyzerWrite({ p1: { v: 2, provider: 'fallow', extra: 1, devices: { [B]: DEVICE } } }, 'p1', M, { op: 'bind', executablePath: 'D:\\fallow.exe' }))
      .toEqual({ p1: v2({ [B]: DEVICE, [M]: { executablePath: 'D:\\fallow.exe', timeoutSeconds: 120, trust: null } }) });
  });

  it('E44 a: bind and forget here leave another device\'s invalid v1 record intact (carried into devices)', () => {
    const foreign = { ...V1, timeoutSeconds: 5 };
    const carried = { executablePath: DEVICE.executablePath, timeoutSeconds: 5, trust: TRUST };
    expect(applyAnalyzerWrite({ p1: foreign }, 'p1', B, { op: 'forget' })).toEqual({ p1: foreign });
    const afterBind = applyAnalyzerWrite({ p1: foreign }, 'p1', B, { op: 'bind', executablePath: 'D:\\fallow.exe' });
    expect(afterBind).toEqual({ p1: v2({ [M]: carried, [B]: { executablePath: 'D:\\fallow.exe', timeoutSeconds: 120, trust: null } }) });
    expect(reasonOf(decodeAnalyzerRecord(afterBind, 'p1', M))).toContain('timeoutSeconds');
    expect(decodeAnalyzerRecord(afterBind, 'p1', B)).toMatchObject({ kind: 'bound' });
  });

  it('E44 b: forget on a device with no entry is a no-op whatever the envelope state', () => {
    for (const entry of [
      { v: 2, provider: 'fallow', extra: 1, devices: { [B]: DEVICE } },
      { ...V1, machineId: B, timeoutSeconds: 5 },
      v2({ [B]: { ...DEVICE, timeoutSeconds: 5 } }),
    ]) {
      const slice = { p1: entry };
      expect(applyAnalyzerWrite(slice, 'p1', M, { op: 'forget' })).toBe(slice);
    }
  });

  it('E44 c: a foreign provider refuses every write but purge, so a bind never relabels its entries', () => {
    const slice = { p1: { v: 2, provider: 'x', devices: { [B]: DEVICE } } };
    for (const write of [{ op: 'bind', executablePath: 'D:\\fallow.exe' }, { op: 'forget' }, { op: 'revoke' }] as const) {
      expect(codeOf(() => applyAnalyzerWrite(slice, 'p1', M, write)), write.op).toBe('unsupported');
    }
    expect(applyAnalyzerWrite(slice, 'p1', M, { op: 'purge' })).toEqual({});
  });

  it('(d) an unsupported entry or slice refuses every write, so it is never overwritten', () => {
    for (const slice of [{ p1: { ...(RECORD as object), v: 3 } }, { p1: { ...(RECORD as object), v: 4 } }, 'nonsense']) {
      for (const write of [
        { op: 'bind', executablePath: 'D:\\fallow.exe' }, { op: 'timeout', seconds: 60 }, { op: 'revoke' }, { op: 'forget' },
        { op: 'grant', trust: TRUST, expectedPath: DEVICE.executablePath },
      ] as const) {
        expect(codeOf(() => applyAnalyzerWrite(slice, 'p1', M, write)), write.op).toBe('unsupported');
      }
    }
  });

  it('timeout, grant and revoke need a bound device; grant refuses a path that moved', () => {
    expect(codeOf(() => applyAnalyzerWrite(undefined, 'p1', M, { op: 'timeout', seconds: 60 }))).toBe('not-bound');
    expect(codeOf(() => applyAnalyzerWrite({ p1: RECORD }, 'p1', B, { op: 'revoke' }))).toBe('not-bound');
    expect(codeOf(() => applyAnalyzerWrite({ p1: V1 }, 'p1', B, { op: 'timeout', seconds: 60 }))).toBe('not-bound');
    expect(codeOf(() => applyAnalyzerWrite({ p1: v2({ [M]: { ...DEVICE, timeoutSeconds: 5 } }) }, 'p1', M, { op: 'revoke' }))).toBe('not-bound');
    expect(codeOf(() => applyAnalyzerWrite({ p1: RECORD }, 'p1', M, { op: 'grant', trust: TRUST, expectedPath: 'D:\\fallow.exe' }))).toBe('changed');
  });

  it('forget removes only this device, and the whole entry when the last device goes', () => {
    const both = { p1: v2({ [M]: DEVICE, [B]: DEVICE }), p2: RECORD };
    expect(applyAnalyzerWrite(both, 'p1', M, { op: 'forget' })).toEqual({ p1: v2({ [B]: DEVICE }), p2: RECORD });
    expect(applyAnalyzerWrite({ p1: v2({ [M]: DEVICE }), p2: RECORD }, 'p1', M, { op: 'forget' })).toEqual({ p2: RECORD });
    expect(applyAnalyzerWrite({ p1: V1 }, 'p1', M, { op: 'forget' })).toEqual({});
  });

  it('forget removes an invalid device (keeping the others) and is a no-op with none', () => {
    expect(applyAnalyzerWrite({ p1: v2({ [M]: { ...DEVICE, timeoutSeconds: 5 }, [B]: DEVICE }) }, 'p1', M, { op: 'forget' })).toEqual({ p1: v2({ [B]: DEVICE }) });
    expect(applyAnalyzerWrite({ p1: { ...V1, timeoutSeconds: 5 } }, 'p1', M, { op: 'forget' })).toEqual({});
    const elsewhere = { p1: RECORD };
    expect(applyAnalyzerWrite(elsewhere, 'p1', B, { op: 'forget' })).toBe(elsewhere);
    expect(applyAnalyzerWrite({ p1: V1 }, 'p1', B, { op: 'forget' })).toEqual({ p1: V1 });
    expect(applyAnalyzerWrite(undefined, 'p1', M, { op: 'forget' })).toBeUndefined();
  });

  it('(e) purge deletes the entry whatever its format (Z11), and leaves a non-object slice alone', () => {
    expect(applyAnalyzerWrite({ p1: { v: 9 }, p2: RECORD }, 'p1', M, { op: 'purge' })).toEqual({ p2: RECORD });
    expect(applyAnalyzerWrite({ p1: V1, p2: RECORD }, 'p1', M, { op: 'purge' })).toEqual({ p2: RECORD });
    expect(applyAnalyzerWrite({ p1: v2({ [M]: DEVICE, [B]: DEVICE }), p2: RECORD }, 'p1', M, { op: 'purge' })).toEqual({ p2: RECORD });
    expect(applyAnalyzerWrite({ p1: { ...(RECORD as object), v: 3 }, p2: RECORD }, 'p1', M, { op: 'purge' })).toEqual({ p2: RECORD });
    expect(applyAnalyzerWrite('nonsense', 'p1', M, { op: 'purge' })).toBe('nonsense');
  });
});
