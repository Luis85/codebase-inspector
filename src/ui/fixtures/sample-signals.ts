// WP-02 spec §4.4: sample signals for the metrics no provider collects yet. Ranges follow
// docs/concept/prototype/src/data.js so screens look like the prototype. Seeded from the
// entity id, so a file keeps the same sample values across rescans and snapshots.
import type { EntityId } from '../../domain/entity-id';
import { fnv1a, mulberry32 } from './seeded-random';

export interface FileSignals {
  complexity: number;        // max cognitive complexity of any function
  commits90d: number;
  branchesTotal: number;
  branchesCovered: number;
}

export function sampleFileSignals(entityId: EntityId): FileSignals {
  const r = mulberry32(fnv1a(entityId));
  const complexity = 3 + Math.floor(r() ** 2 * 43);
  const commits90d = 1 + Math.floor(r() ** 1.5 * 43);
  const branchesTotal = 20 + Math.floor(r() * 160);
  const branchesCovered = Math.round(branchesTotal * (0.4 + r() * 0.59));
  // Part 6 Y34: no sample findings any more. WP-03 N8/JF16: the sample fan-in field (the
  // last draw) is gone too — Imported by is now fallow's own real value — so no
  // placeholder draw replaces it; the draws above keep their order unchanged.
  return { complexity, commits90d, branchesTotal, branchesCovered };
}

/** A sample history that ENDS at the real current value, walking backwards by at most
 *  `maxStep` per point, clamped to [0, max]. `max` defaults to 100 (a percentage); a
 *  count passes `Infinity` so it is never capped at 100. */
export function sampleTrend(seedKey: string, endValue: number, points: number, maxStep: number, max = 100): number[] {
  const r = mulberry32(fnv1a(seedKey));
  const values = [endValue];
  for (let i = 1; i < points; i += 1) {
    const prev = values[0] ?? endValue;
    const next = Math.min(max, Math.max(0, Math.round(prev - (r() * 2 - 0.8) * maxStep)));
    values.unshift(next);
  }
  return values;
}
