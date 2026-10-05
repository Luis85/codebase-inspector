// Part 6 Y13 (Part 5 E25, the 400/400 rule): review-store.ts was split so later work has
// room. Like city-budget.test.ts, the checks read the source text rather than importing it,
// so each one fails on its own before the split.
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

function source(path: string): string {
  const abs = resolve(process.cwd(), path);
  expect(existsSync(abs), `${path} exists`).toBe(true);
  return readFileSync(abs, 'utf8');
}

describe('review store line budget (Part 6 Y13)', () => {
  it('review-store.ts stays at or under 360 lines', () => {
    expect(source('src/ui/stores/review-store.ts').split('\n').length).toBeLessThanOrEqual(360);
  });

  it('the per-codebase bookkeeping lives in review-buckets.ts, at or under 200 lines', () => {
    const buckets = source('src/ui/stores/review-buckets.ts');
    expect(buckets.split('\n').length).toBeLessThanOrEqual(200);
    for (const name of ['createBucketState', 'bucketFor', 'listenTo', 'stopListening', 'ownWrite', 'reserve', 'release']) {
      expect(buckets, name).toMatch(new RegExp(`export (?:async )?function ${name}\\(`));
    }
    expect(source('src/ui/stores/review-store.ts')).toContain("from './review-buckets'");
  });

  it('the store keeps no id counter of its own: ids come from the port (Y10)', () => {
    expect(source('src/ui/stores/review-store.ts')).not.toMatch(/\bnextId\b|\bnextRuleId\b|\bmaxSuffix\b/);
  });
});
