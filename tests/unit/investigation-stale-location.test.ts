import { describe, expect, it } from 'vitest';
import { locationVerdict, type LocationInputs } from '../../src/application/investigation/stale-location';

const EXACT: LocationInputs = {
  reportCurrent: true, observedBytes: 120, observedLines: 10, currentBytes: 120, currentLines: 10,
  currentMtimeMs: Date.parse('2026-09-25T09:00:00Z'), analysedAt: '2026-09-25T10:00:00.000Z', line: 4,
};

describe('locationVerdict (IN10)', () => {
  it('is exact only when every check holds', () => {
    expect(locationVerdict(EXACT)).toEqual({ exact: true, line: 4 });
  });
  // Review Focus 4: one check at a time, each alone enough to drop the highlight.
  it.each([
    ['a stale report', { reportCurrent: false }, 'report', 'changed'],
    ['the same size, other lines', { currentLines: 11 }, 'lines', 'changed'],
    ['another size', { currentBytes: 121 }, 'size', 'changed'],
    ['no size observation', { observedBytes: null }, 'size', 'unknown'],
    ['no line observation', { observedLines: null }, 'lines', 'unknown'],
    ['modified after the analysis', { currentMtimeMs: Date.parse('2026-09-25T10:00:01Z') }, 'modified', 'changed'],
    ['no mtime', { currentMtimeMs: null }, 'modified', 'unknown'],
    ['no analysis time', { analysedAt: null }, 'modified', 'unknown'],
    // Fix round 1, review coverage 6h: an analysedAt string Date.parse cannot read at all
    // (never a null) must fail towards stale the same as a genuinely absent one.
    ['an unparseable analysis time', { analysedAt: 'not-a-real-date' }, 'modified', 'unknown'],
    ['a line past the end', { line: 11 }, 'line-range', 'changed'],
    // Fix round 1, review coverage 6h: line 0 is not a real line (1-indexed) — it fails the
    // range check the same way a line past the end does.
    ['line zero', { line: 0 }, 'line-range', 'changed'],
  ] as const)('%s fails %s', (_name, change, failed, cause) => {
    expect(locationVerdict({ ...EXACT, ...change })).toEqual({ exact: false, failed, cause });
  });
  it('names the FIRST failed check', () => {
    expect(locationVerdict({ ...EXACT, reportCurrent: false, currentBytes: 1 })).toMatchObject({ failed: 'report' });
  });
  it('a finding with no line is never exact', () => {
    expect(locationVerdict({ ...EXACT, line: null })).toEqual({ exact: false, failed: 'no-line' });
  });
  it('an mtime equal to the analysis time passes', () => {
    expect(locationVerdict({ ...EXACT, currentMtimeMs: Date.parse(EXACT.analysedAt!) })).toMatchObject({ exact: true });
  });
});
