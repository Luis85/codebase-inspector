// fixtures/sample-evolution.ts — Part 3 Q10: SAMPLE commit activity and change coupling.
// Coupling pairs real files of one module; it is correlation, never an import claim.
import type { FileSummary } from '../read-models/file-summaries';
import { fnv1a, mulberry32 } from './seeded-random';

export type ChangeWindow = 30 | 90;
export const WINDOW_POINTS: Readonly<Record<ChangeWindow, { count: number; stepDays: number }>> = {
  90: { count: 7, stepDays: 14 }, 30: { count: 5, stepDays: 7 },
};

export function sampleActivity(seedKey: string, changeWindow: ChangeWindow): number[] {
  const r = mulberry32(fnv1a(`activity:${seedKey}:${changeWindow}`));
  return Array.from({ length: WINDOW_POINTS[changeWindow].count }, () => 40 + Math.floor(r() * 70));
}

export interface SampleCoupling { a: FileSummary; b: FileSummary; rate: number; shared: number }

/** `ordered` is the caller's priority order; the first `limit` distinct pairs win. */
export function sampleCoupling(ordered: readonly FileSummary[], limit: number): SampleCoupling[] {
  const byModule = new Map<string, FileSummary[]>();
  for (const f of ordered) {
    const g = byModule.get(f.module);
    if (g) g.push(f); else byModule.set(f.module, [f]);
  }
  const seen = new Set<string>();
  const pairs: SampleCoupling[] = [];
  for (const a of ordered) {
    if (pairs.length >= limit) break;
    const siblings = (byModule.get(a.module) ?? []).filter((f) => f.id !== a.id);
    if (siblings.length === 0) continue;
    const r = mulberry32(fnv1a(`couple:${a.id}`));
    const b = siblings[Math.floor(r() * siblings.length)];
    if (!b) continue;
    const key = [a.id, b.id].sort().join('|');
    if (seen.has(key)) continue;
    seen.add(key);
    pairs.push({ a, b, rate: 40 + Math.floor(r() * 41), shared: 6 + Math.floor(r() * 19) });
  }
  return pairs.sort((x, y) => y.rate - x.rate);
}
