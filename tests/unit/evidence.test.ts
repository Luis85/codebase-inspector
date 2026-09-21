import { describe, expect, it } from 'vitest';
import { collected, countEvidence, formatMetric, hasValue, isSampleBacked, ratioEvidence, sample, sumEvidence, unknown, type MetricValue } from '../../src/ui/evidence';

describe('MetricValue constructors', () => {
  it('collected carries value and source', () => {
    expect(collected(12, 'inventory')).toEqual({ state: 'collected', value: 12, provenance: { source: 'inventory' } });
  });
  it('sample is always provenance "sample"', () => {
    expect(sample(3).provenance.source).toBe('sample');
    expect(sample(3).state).toBe('sample');
  });
  it('unknown has no value and requires a reason', () => {
    const m = unknown('Import graph not collected yet');
    expect(m.value).toBeUndefined();
    expect(m.reason).toBe('Import graph not collected yet');
    expect(hasValue(m)).toBe(false);
  });
});

describe('formatMetric', () => {
  it('renders an unknown as an em dash, never 0', () => {
    expect(formatMetric(unknown('x'))).toBe('—');
  });
  it('groups thousands and appends a unit', () => {
    expect(formatMetric(collected(1248, 'inventory'))).toBe('1,248');
    expect(formatMetric(sample(68), '%')).toBe('68%');
  });
});

const stale = (v: number): MetricValue => ({ state: 'stale', value: v, provenance: { source: 'sample' } });
const partial = (v: number): MetricValue => ({ state: 'partial', value: v, provenance: { source: 'sample' }, reason: '1 of 2 inputs missing.' });

describe('evidence-aware aggregation (A13)', () => {
  it('no inputs is unknown with the caller\'s reason', () => {
    const m = sumEvidence([], 'No files in this scan.');
    expect(m.state).toBe('unknown');
    expect(m.value).toBeUndefined();
    expect(m.reason).toBe('No files in this scan.');
  });
  it('all collected stays collected and keeps the shared source', () => {
    expect(sumEvidence([collected(2, 'inventory'), collected(3, 'inventory')]))
      .toEqual({ state: 'collected', value: 5, provenance: { source: 'inventory' } });
  });
  it('takes the weakest state when every input has a value', () => {
    expect(sumEvidence([collected(1, 'inventory'), sample(2)]).state).toBe('sample');
    expect(sumEvidence([sample(1), stale(2)]).state).toBe('stale');
    expect(sumEvidence([stale(1), partial(2)]).state).toBe('partial');
  });
  it('is partial over the present inputs when some lack a value — a missing input is never 0', () => {
    expect(sumEvidence([sample(4), unknown('x'), sample(6)]))
      .toMatchObject({ state: 'partial', value: 10, reason: '1 of 3 inputs missing.' });
  });
  it('is unknown, keeping the first reason, when no input has a value', () => {
    const m = sumEvidence([unknown('not measured'), unknown('y')]);
    expect(m.state).toBe('unknown');
    expect(m.value).toBeUndefined();
    expect(m.reason).toBe('not measured');
  });
  it('collapses mixed sources to "aggregate"', () => {
    expect(sumEvidence([collected(1, 'inventory'), sample(1)]).provenance.source).toBe('aggregate');
  });
  it('counts only values passing the predicate', () => {
    expect(countEvidence([sample(10), sample(70), sample(90)], (v) => v >= 65).value).toBe(2);
  });
  it('ratio needs both sides and a non-zero denominator', () => {
    expect(ratioEvidence(sample(1), sample(4)).value).toBe(25);
    expect(ratioEvidence(sample(1), unknown('no total')).reason).toBe('no total');
    expect(ratioEvidence(sample(0), sample(0)).state).toBe('unknown');
    expect(ratioEvidence(partial(1), sample(2))).toMatchObject({ state: 'partial', value: 50, reason: '1 of 2 inputs missing.' });
  });
  it('recognises sample-backed values by state or by provenance', () => {
    expect(isSampleBacked(sample(1))).toBe(true);
    expect(isSampleBacked(partial(1))).toBe(true);
    expect(isSampleBacked(collected(1, 'inventory'))).toBe(false);
  });
});

describe('includesSample (Part 3 §4)', () => {
  it('marks a partial aggregate whose present inputs mix collected and sample', () => {
    const m = sumEvidence([collected(3, 'inventory'), sample(4), unknown('x')]);
    expect(m.state).toBe('partial');
    expect(m.provenance.source).toBe('aggregate');
    expect(m.provenance.includesSample).toBe(true);
    expect(isSampleBacked(m)).toBe(true);
  });
  it('marks a ratio of a collected value over a sample value', () => {
    const r = ratioEvidence(collected(1, 'inventory'), sample(4));
    expect(isSampleBacked(r)).toBe(true);
  });
  it('leaves an all-collected aggregate unflagged', () => {
    const m = sumEvidence([collected(1, 'inventory'), collected(2, 'inventory')]);
    expect(m.provenance).toEqual({ source: 'inventory' });
    expect(isSampleBacked(m)).toBe(false);
  });
  it('does not add the flag when the source is already sample', () => {
    expect(sumEvidence([sample(1), sample(2)]).provenance).toEqual({ source: 'sample' });
  });
});
