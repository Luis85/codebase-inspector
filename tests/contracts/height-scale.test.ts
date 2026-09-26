// interactions/03: "Production may choose another explicit scale, but it must preserve
// the metric definition, display cap, exact raw values, and legend. Do not silently
// apply a different scale in each district." `scale.ts` chooses one such scale —
// deriving the cap from the snapshot's 95th percentile rather than the reference
// fixture's hardcoded 600 — and that substitution was assessed and ruled compliant
// (docs/concept/design/validation/design-review-checklist.md, "City and inspection").
// Nothing pinned the compliance itself, so a reader who finds 600 in the design and a
// derived cap here could "correct" scale.ts back to a hardcoded value and quietly break
// every rendered city. These five tests are the five clauses of that ruling, one each.
//
// Task 13 mutation log: every clause below was verified to fail under a targeted
// mutation of the exact code it depends on (see task-13-report.md for the red output).
// A test that cannot be made to fail is this branch's own defect class (three such
// guards were found, one AFTER being reported as mutation-verified) and is treated as a
// finding, not a pass.
import { describe, expect, it } from 'vitest';
import { computeLayout } from '../../src/domain/layout/layout';
import { buildSnapshotFixture } from '../fixtures/snapshot-builder';
import type { CodebaseSnapshot } from '../../src/domain/model';
import type { CityLot } from '../../src/domain/layout/types';

/**
 * 40 explicit physical-lines values. The first 38 (indices 0-37) are the p95 BODY and
 * top out at 200; the last 2 (indices 38-39, 5% of 40) are outliers two orders of
 * magnitude past that body. Because deriveCap's p95 index for 40 sorted values lands on
 * index 37 -- the body's own maximum -- the cap can only ever be derived FROM the body,
 * so the two outliers exceed it BY CONSTRUCTION, for any body shape, not by a value that
 * happens to clamp today and might stop clamping after an unrelated edit.
 */
const LINE_COUNTS_WITH_OUTLIERS: readonly number[] = [
  10, 15, 20, 25, 31, 36, 41, 46, 51, 56, 61, 66, 72, 77, 82, 87, 92, 97, 102, 108,
  113, 118, 123, 128, 133, 138, 144, 149, 154, 159, 164, 169, 174, 179, 185, 190, 195, 200,
  5000, 9000,
];

/**
 * 20 explicit values: 19 in a tight, ordinary body (10-100, step 5) and one outlier at
 * 5000. deriveCap's p95 index here lands on index 18 -- the body's own maximum, 100 --
 * so the cap is bounded by the body and the outlier is guaranteed to sit above it,
 * giving genuine headroom between the raw value and the display cap.
 */
const LINE_COUNTS_ONE_OUTLIER: readonly number[] = [
  10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90, 95, 100, 5000,
];

/**
 * 40 explicit values across 4 directories (file i's parent is directories[i % 4]).
 * Every value is distinct (10 + i, which only ever reaches 49) EXCEPT indices 6 and 33,
 * both forced to 60 -- a value the (10 + i) formula can never produce on its own, so the
 * collision is exactly two lots, not an accidental third. 6 % 4 = 2 while 33 % 4 = 1:
 * two DIFFERENT directories. A fixture built from buildSnapshotFixture's own default
 * line-count formula would give every file a distinct value and make the cross-district
 * check pass vacuously, since no two lots would ever share a value to compare; forcing
 * one explicit collision across two directories is what makes the assertion below
 * capable of failing at all.
 *
 * 60 is deliberately chosen to sit BELOW this snapshot's own derived cap (100, from the
 * 10-49 body): a collision value large enough to always saturate past every plausible
 * per-district cap would clamp to the same maximum height in every district regardless
 * of whether one scale or many were applied, and the mutation this fixture exists to
 * catch would go unnoticed. Verified directly: mutating districts.ts to scale the cap
 * by +/- 5% per district changes the height of these two identical-value lots from
 * ~100.95 (both, correct) to ~92.85 / ~94.68 (mutated) -- see task-13-report.md.
 */
const LINE_COUNTS_SAME_VALUE_DIFFERENT_DISTRICTS: readonly number[] = Array.from(
  { length: 40 },
  (_, i) => (i === 6 || i === 33 ? 60 : 10 + i),
);

/** Reads a lot's RAW observed value from the SNAPSHOT the layout was built from --
 *  never from the lot's own height or from `layout.scale`, either of which is exactly
 *  what this file exists to check against. Comparing a derived value back to itself is
 *  the "measurement compared to itself" failure mode this task was warned against. */
function valueFor(snapshot: CodebaseSnapshot, lot: CityLot): number {
  const obs = snapshot.observations.find(
    (o) => o.entityId === lot.entityId && o.measurement.metricId === 'physical-lines',
  );
  if (obs === undefined || obs.value === null) {
    throw new Error(`no physical-lines observation for lot ${lot.entityId}`);
  }
  return obs.value;
}

describe('height scale: the four properties a substitute scale must preserve (interactions/03)', () => {
  it('preserves the metric definition', () => {
    const layout = computeLayout(buildSnapshotFixture({ files: 40, directories: 3, repositoryId: 'r' }));
    expect(layout.scale.metricId).toBe('physical-lines');
    expect(layout.scale.unit).toBe('lines');
  });

  it('preserves the display cap, and says how many values it clamped', () => {
    const layout = computeLayout(buildSnapshotFixture({ files: 40, lineCounts: LINE_COUNTS_WITH_OUTLIERS }));
    expect(layout.scale.cap).toBeGreaterThan(0);
    expect(layout.scale.clampedCount).toBeGreaterThan(0);
  });

  it('preserves the exact raw values, which the cap never rewrites', () => {
    // The cap is a DISPLAY cap. A clamped building is shorter; its observation is not.
    const snapshot = buildSnapshotFixture({ files: 20, lineCounts: LINE_COUNTS_ONE_OUTLIER });
    const layout = computeLayout(snapshot);
    const rawOutlier = snapshot.observations.find(
      (o) => o.measurement.metricId === 'physical-lines' && o.value === 5000,
    );
    expect(rawOutlier?.value).toBe(5000);
    expect(layout.scale.cap).toBeLessThan(5000);

    // Not just "the cap is smaller than the raw value" -- the clamped building's actual
    // HEIGHT must be bounded by the cap's own ceiling (sqrt(min(value, cap) / cap) === 1,
    // i.e. 8 + 120) no matter how far past the cap the raw value goes. Without this the
    // clause could pass while heightFor quietly used the unclamped raw value.
    const clampedLot = layout.lots.find((l) => l.entityId === rawOutlier!.entityId);
    expect(clampedLot).toBeDefined();
    expect(clampedLot!.dimensions[1]).toBeLessThanOrEqual(8 + 120 + 1e-9);
  });

  it('preserves the legend name', () => {
    expect(computeLayout(buildSnapshotFixture({ files: 4 })).scale.name).toBe('physical lines · square-root scale');
  });

  it('applies ONE scale across every district, never one per district', () => {
    // The explicit prohibition. Two files with the same line count in different
    // districts must be the same height, or the city encodes district membership as
    // height and nobody can read it.
    const snapshot = buildSnapshotFixture({
      files: 40,
      directories: 4,
      repositoryId: 'r',
      lineCounts: LINE_COUNTS_SAME_VALUE_DIFFERENT_DISTRICTS,
    });
    const layout = computeLayout(snapshot);
    const byValue = new Map<number, { height: number; directoryId: string }[]>();
    for (const lot of layout.lots) {
      if (lot.metricState !== 'measured') continue;
      const value = valueFor(snapshot, lot);
      byValue.set(value, [...(byValue.get(value) ?? []), { height: lot.dimensions[1], directoryId: lot.directoryId }]);
    }

    // Sanity: the engineered collision (value 60, two different directories) must
    // actually be present, or the loop below checks nothing.
    const collision = byValue.get(60);
    expect(collision?.length).toBe(2);
    expect(new Set(collision!.map((c) => c.directoryId)).size, 'the two value-60 lots must sit in different districts').toBe(2);

    for (const [value, entries] of byValue) {
      expect(new Set(entries.map((e) => e.height.toFixed(6))).size, `value ${value} produced more than one height`).toBe(1);
    }
  });
});
