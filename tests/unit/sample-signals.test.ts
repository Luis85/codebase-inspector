import { describe, expect, it } from 'vitest';
import { fnv1a, mulberry32 } from '../../src/ui/fixtures/seeded-random';
import { sampleFileSignals, sampleTrend } from '../../src/ui/fixtures/sample-signals';

describe('seeded random', () => {
  it('fnv1a is stable', () => {
    expect(fnv1a('abc')).toBe(fnv1a('abc'));
    expect(fnv1a('abc')).not.toBe(fnv1a('abd'));
  });
  it('mulberry32 yields [0,1) deterministically', () => {
    const a = mulberry32(42); const b = mulberry32(42);
    const xs = [a(), a(), a()];
    expect([b(), b(), b()]).toEqual(xs);
    for (const x of xs) { expect(x).toBeGreaterThanOrEqual(0); expect(x).toBeLessThan(1); }
  });
});

describe('sampleFileSignals', () => {
  it('is deterministic per entity id', () => {
    expect(sampleFileSignals('r\0file\0a.ts')).toEqual(sampleFileSignals('r\0file\0a.ts'));
  });
  it('stays inside the prototype ranges for 500 ids', () => {
    for (let i = 0; i < 500; i += 1) {
      const s = sampleFileSignals(`r\0file\0f-${i}.ts`);
      expect(s.complexity).toBeGreaterThanOrEqual(3);
      expect(s.complexity).toBeLessThanOrEqual(45);
      expect(s.commits90d).toBeGreaterThanOrEqual(1);
      expect(s.commits90d).toBeLessThanOrEqual(43);
      expect(s.branchesTotal).toBeGreaterThanOrEqual(20);
      expect(s.branchesCovered).toBeLessThanOrEqual(s.branchesTotal);
      expect(s.highFindings).toBeLessThanOrEqual(s.findings);
    }
  });
});

describe('sampleTrend', () => {
  it('ends exactly at the current value and has the requested length', () => {
    const t = sampleTrend('snap-1', 68, 7, 4);
    expect(t).toHaveLength(7);
    expect(t[6]).toBe(68);
  });
  it('is deterministic and clamped to [0, 100]', () => {
    expect(sampleTrend('k', 99, 7, 10)).toEqual(sampleTrend('k', 99, 7, 10));
    for (const v of sampleTrend('k', 99, 7, 10)) { expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThanOrEqual(100); }
  });
  it('clamps to a caller-given max instead, so a count is not capped at 100', () => {
    const t = sampleTrend('k', 240, 7, 10, Infinity);
    expect(t[6]).toBe(240);
    expect(t.some((v) => v > 100)).toBe(true);
    for (const v of t) expect(v).toBeGreaterThanOrEqual(0);
  });
});
