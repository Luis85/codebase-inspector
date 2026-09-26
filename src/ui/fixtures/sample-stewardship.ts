// fixtures/sample-stewardship.ts — Part 3 Q11: a SAMPLE stewarding team (an index into
// the copy's team labels) and a SAMPLE concentration per MODULE. Nothing per person.
import { fnv1a, mulberry32 } from './seeded-random';

export const SAMPLE_TEAM_COUNT = 3;

export function sampleStewardship(module: string): { teamIndex: number; concentration: number } {
  const r = mulberry32(fnv1a(`steward:${module}`));
  return { teamIndex: Math.floor(r() * SAMPLE_TEAM_COUNT), concentration: 55 + Math.floor(r() * 26) };
}
