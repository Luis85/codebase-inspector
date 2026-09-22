import { describe, expect, it } from 'vitest';
import { niceTicks } from '../../src/ui/kit/chart-scale';

const evenIntegers = (ticks: readonly number[]): boolean => ticks.length > 1
  && ticks.every((t) => Number.isInteger(t))
  && ticks.every((t, i) => i === 0 || (t - ticks[i - 1]!) === (ticks[1]! - ticks[0]!));

describe('niceTicks (E55)', () => {
  it('never produces 12.5-style ticks', () => {
    expect(niceTicks(50)).toEqual({ max: 60, step: 20, ticks: [0, 20, 40, 60] });
    expect(niceTicks(37)).toEqual({ max: 40, step: 10, ticks: [0, 10, 20, 30, 40] });
  });
  it('keeps the floor and uses 2.5 steps only from 10 up', () => {
    expect(niceTicks(0)).toEqual({ max: 10, step: 5, ticks: [0, 5, 10] });
    expect(niceTicks(3)).toEqual({ max: 10, step: 5, ticks: [0, 5, 10] });
    expect(niceTicks(100, 4, 100)).toEqual({ max: 100, step: 25, ticks: [0, 25, 50, 75, 100] });
    expect(niceTicks(137, 4, 100)).toEqual({ max: 150, step: 50, ticks: [0, 50, 100, 150] });
  });
  it('gives evenly spaced integer ticks whose last tick is the max, across a range of inputs', () => {
    for (let v = 0; v <= 5000; v += 7) {
      for (const target of [4, 5]) {
        const s = niceTicks(v, target);
        expect(evenIntegers(s.ticks), `${v}/${target}`).toBe(true);
        expect(s.ticks[s.ticks.length - 1]).toBe(s.max);
        expect(s.max).toBeGreaterThanOrEqual(Math.max(10, v));
      }
    }
  });
  it('keeps the same guarantees at floor 100, the only floor a chart passes (LineChart) (Part 5 V24)', () => {
    for (let v = 0; v <= 5000; v += 7) {
      for (const target of [4, 5]) {
        const s = niceTicks(v, target, 100);
        expect(evenIntegers(s.ticks), `${v}/${target}/100`).toBe(true);
        expect(s.ticks[s.ticks.length - 1]).toBe(s.max);
        expect(s.max).toBeGreaterThanOrEqual(Math.max(100, v));
      }
    }
  });
  it('falls back to the default target (4) and floor (10) when either is not a finite number above 0 (Part 5 V24)', () => {
    const bad = [0, -2, Number.NaN, Number.POSITIVE_INFINITY];
    for (const target of bad) expect(niceTicks(50, target), `target ${target}`).toEqual(niceTicks(50));
    // Value 3 sits below the default floor, so a floor that is ignored instead of replaced shows.
    for (const floor of bad) expect(niceTicks(3, 4, floor), `floor ${floor}`).toEqual(niceTicks(3));
    expect(niceTicks(0, 0, 0)).toEqual({ max: 10, step: 5, ticks: [0, 5, 10] });
  });
});
