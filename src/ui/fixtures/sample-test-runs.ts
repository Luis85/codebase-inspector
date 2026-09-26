// Part 3 Q12: SAMPLE results for one real test file, seeded by its entity id. Never
// invents test files: callers pass real ones only.
import type { EntityId } from '../../domain/entity-id';
import { fnv1a, mulberry32 } from './seeded-random';

export interface SampleTestRun { tests: number; failing: number; durationMs: number }

export function sampleTestRun(entityId: EntityId): SampleTestRun {
  const r = mulberry32(fnv1a(`tests:${entityId}`));
  const tests = 1 + Math.floor(r() * 40);
  const failing = r() > 0.9 ? Math.min(tests, 1 + Math.floor(r() * 2)) : 0;
  const durationMs = 5 + Math.floor(r() ** 2 * 2000);
  return { tests, failing, durationMs };
}
