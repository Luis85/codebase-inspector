import { describe, expect, it } from 'vitest';
import { computeLayout } from '../../src/domain/layout/layout';
import { buildSnapshotFixture, caseSiblingFixture, nestedStressFixture, tinyFixture } from '../fixtures/snapshot-builder';

// Fix round 1, IMPORTANT 4: a non-mutating reversal that never calls `Array#reverse()`
// (oxlint's unicorn/no-array-reverse fires on `.reverse()` regardless of whether the
// receiver is a fresh copy) — this maps each index to its mirror in a NEW array, so the
// input is never touched and no lint override is needed.
function toReversedArray<T>(arr: readonly T[]): T[] {
  return arr.map((_, i) => arr[arr.length - 1 - i]!);
}

function pairwiseSeparated<T extends { center: readonly [number, number, number] }>(
  items: readonly T[],
  sizeOf: (item: T) => readonly [number, number],
): void {
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      const a = items[i]!, b = items[j]!;
      const [aw, ad] = sizeOf(a);
      const [bw, bd] = sizeOf(b);
      const sepX = Math.abs(a.center[0] - b.center[0]) >= (aw + bw) / 2;
      const sepZ = Math.abs(a.center[2] - b.center[2]) >= (ad + bd) / 2;
      expect(sepX || sepZ, `items ${i} and ${j} overlap`).toBe(true);
    }
  }
}

describe('computeLayout determinism', () => {
  it('produces identical geometry for identical input', () => {
    const s = tinyFixture();
    expect(computeLayout(s)).toEqual(computeLayout(s));
  });

  it('is insensitive to input ordering', () => {
    const s = tinyFixture();
    const reversed = { ...s, entities: toReversedArray(s.entities),
                             observations: toReversedArray(s.observations) };
    expect(computeLayout(reversed).lots).toEqual(computeLayout(s).lots);
  });

  it('gives every file its own lot', () => {
    const { lots } = computeLayout(tinyFixture());
    expect(new Set(lots.map((l) => `${l.center[0]}/${l.center[2]}`)).size).toBe(lots.length);
  });

  it('overlaps no two lots', () => {
    const { lots } = computeLayout(buildSnapshotFixture({ files: 400, directories: 25 }));
    pairwiseSeparated(lots, (l) => [l.dimensions[0], l.dimensions[2]]);
  });

  // Fix round 1, IMPORTANT 3: the test above puts 25 directories directly under the
  // repository, which exceeds MAX_DIRECT_SUBDISTRICTS (20) and aggregates the root, so
  // every lot goes through ONE flat shelfPack call — the recursive origin composition in
  // collectResults (`originX + c.localX`, chained through several nested levels) is
  // never exercised. This fixture stays at or below the threshold at every level, so the
  // fully recursive path is the one actually under test.
  it('overlaps no two lots in a genuinely nested, non-aggregated tree', () => {
    const { lots, districts } = computeLayout(nestedStressFixture());
    expect(lots.length).toBe(432);
    expect(districts.some((d) => d.aggregated)).toBe(false);
    pairwiseSeparated(lots, (l) => [l.dimensions[0], l.dimensions[2]]);
  });

  // Fix round 1, IMPORTANT 2: 'README.md' and 'readme.md' collate as equal under
  // { sensitivity: 'base' } — a comparator tie that a naive sort would resolve by
  // Array#sort's stability (i.e. by ORIGINAL array order), silently breaking
  // determinism for two files that legally coexist on a case-sensitive filesystem.
  it('places case-differing siblings identically regardless of input array order', () => {
    const s = caseSiblingFixture();
    const reversed = { ...s, entities: toReversedArray(s.entities),
                             observations: toReversedArray(s.observations) };
    expect(computeLayout(reversed).lots).toEqual(computeLayout(s).lots);
  });

  it('never mutates the snapshot it was given', () => {
    const s = tinyFixture();
    const before = JSON.stringify(s);
    computeLayout(s);
    expect(JSON.stringify(s)).toBe(before);
  });

  it('carries a palette KEY, never a resolved colour', () => {
    // colorKey is a palette key so recolouring on css-change never re-runs layout.
    for (const lot of computeLayout(tinyFixture()).lots) {
      expect(lot.colorKey).not.toMatch(/^#|rgb|oklch/);
    }
  });
});

// Hoisted to module scope (oxlint unicorn/consistent-function-scoping): this closure
// captures nothing from the describe callback below, so nesting it there would just
// recreate an identical function on every call for no reason.
function threeStatesLayout() {
  return computeLayout(buildSnapshotFixture({ files: 6, measuredZero: 2, unavailable: 2 }));
}

describe('three presentation states, not two', () => {
  it('distinguishes measured, measured-zero and unavailable', () => {
    const states = new Set(threeStatesLayout().lots.map((l) => l.metricState));
    expect(states).toEqual(new Set(['measured', 'measured-zero', 'unavailable']));
  });

  it('keeps the CATEGORY COLOUR on a measured-zero lot and keeps it selectable', () => {
    const zero = threeStatesLayout().lots.find((l) => l.metricState === 'measured-zero')!;
    expect(zero.colorKey).not.toBe('other');       // it kept its own category
    expect(zero.dimensions[1]).toBeGreaterThan(0); // minimum height, still pickable
  });

  it('gives an unavailable lot a DISTINCT SILHOUETTE, not just a neutral colour', () => {
    // Colour alone is not enough: the Three.js prototype gives measured-zero and
    // unavailable identical geometry and distinguishes unavailable only by a grey that
    // destroys the category signal. Task 4's check is that the two are distinguishable
    // WITHOUT READING THE INSPECTOR (spec 4.3).
    const l = threeStatesLayout();
    const zero = l.lots.find((x) => x.metricState === 'measured-zero')!;
    const un = l.lots.find((x) => x.metricState === 'unavailable')!;
    expect(un.dimensions).not.toEqual(zero.dimensions);
  });
});
