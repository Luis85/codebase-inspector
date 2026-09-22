// E12 / Part 4 E55: one axis scale for every chart. The step is 1, 2, 2.5 or 5 × 10^n
// (2.5 only from 10 up, so every tick stays an integer), the ticks are evenly spaced
// from 0, and the last tick is the axis maximum. `floor` keeps a tiny or empty series
// from producing a 0..1 axis.
export interface NiceScale { max: number; step: number; ticks: readonly number[] }

export function niceTicks(value: number, target = 4, floor = 10): NiceScale {
  const top = Math.max(floor, Number.isFinite(value) ? value : 0);
  const raw = top / target;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const factors = magnitude >= 10 ? [1, 2, 2.5, 5, 10] : [1, 2, 5, 10];
  const step = factors.map((f) => f * magnitude).find((s) => s >= raw) ?? 10 * magnitude;
  const max = Math.ceil(top / step) * step;
  const ticks: number[] = [];
  for (let i = 0; i * step <= max; i += 1) ticks.push(Math.round(i * step));
  return { max, step, ticks };
}

export const niceMax = (v: number): number => niceTicks(v).max;
