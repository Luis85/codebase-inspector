import { describe, expect, it } from 'vitest';
import { collected, formatMetric, hasValue, sample, unknown } from '../../src/ui/evidence';

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
