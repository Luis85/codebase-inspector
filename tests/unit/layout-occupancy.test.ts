// GRA1 / GCO2 / GCP3 -- root district occupancy on a frozen real tree: the F2 shelf baseline and the NFDH adoption (ruling E15).
//
// Definition (the F2 note's own wording, docs/superpowers/notes/2026-09-21-wp01b-open-decisions.md §1): "own area" is
// the root district's extent INCLUDING its 2 x DISTRICT_PADDING border; "used area" is the sum of the root's direct
// items, i.e. its file lots plus its child districts' extents (tests/support/occupancy.ts).
//
// Calibration attempt (84d92d7, `git ls-tree -r 84d92d7 --name-only`, 601 tracked files), against the note's 64.2 %
// (own 1,016,060, used 652,244). The tree reproduces the note's 90 districts and maximum depth 5, but no variant
// reaches 64.2 within 0.1 points:
//   own incl. padding, lot by dimensions or LOT_FOOTPRINT^2 : 65.41 % (used 634,468 / own 970,056; root 972 x 998)
//   own excl. padding, either lot measure                   : 67.03 % (used 634,468 / own 946,560)
//   own incl. padding, the 80 png/jpg as unavailable 4 x 4 : 65.65 % (used 663,124 / own 1,010,024; root 1006 x 1004)
//   own excl. padding, the same                             : 67.25 % (used 663,124 / own 986,048)
// The note's scan had 1,087 files including untracked ones, and its scope is not recorded.
//
// So, per GCP3, the baseline is shelf packing on the plan-base tree: `git ls-files` at 3df98ea, 1,236 paths, frozen in
// tests/fixtures/real-tree.json, every lot measured (LOT_FOOTPRINT). Under shelf packing the root was 1624 x 1470,
// 16 lots and 5 child districts, 127 districts, maximum depth 6: 54.66 % (used 1,304,968 / own 2,387,280).
// GCO2's adoption bar is that + 10 points = 64.66 %. NFDH packing (src/domain/layout/pack.ts, ruling E15) measures
// NFDH_OCCUPANCY on the same tree, through the real computeLayout.
import { describe, expect, it } from 'vitest';
import { computeLayout } from '../../src/domain/layout/layout';
import { REAL_TREE_PATHS, snapshotFromPaths } from '../fixtures/path-tree';
import { rootOccupancy } from '../support/occupancy';

const SHELF_BASELINE = 54.66;
const ADOPTION_FLOOR = SHELF_BASELINE + 10;
const NFDH_OCCUPANCY = 71.87;

describe('root occupancy on the frozen plan-base tree (GRA1)', () => {
  it('measures every one of the 1,236 files as a full LOT_FOOTPRINT lot', () => {
    const layout = computeLayout(snapshotFromPaths(REAL_TREE_PATHS, 'plan-base'));
    expect(REAL_TREE_PATHS).toHaveLength(1236);
    expect(layout.lots).toHaveLength(1236);
    expect(layout.lots.every((l) => l.metricState === 'measured' && l.dimensions[0] === 10 && l.dimensions[2] === 10)).toBe(true);
  });

  it(`clears the adoption bar of ${ADOPTION_FLOOR.toFixed(2)} % (shelf baseline + 10 points)`, () => {
    const layout = computeLayout(snapshotFromPaths(REAL_TREE_PATHS, 'plan-base'));
    expect(rootOccupancy(layout)).toBeGreaterThanOrEqual(ADOPTION_FLOOR);
  });

  it(`is ${NFDH_OCCUPANCY} % under NFDH packing, to 0.1 points`, () => {
    const layout = computeLayout(snapshotFromPaths(REAL_TREE_PATHS, 'plan-base'));
    expect(rootOccupancy(layout)).toBeCloseTo(NFDH_OCCUPANCY, 1);
  });

  // Final review: occupancy alone would reward a packing that overlaps lots or stretches the city into a strip.
  it('overlaps no two of the 1,236 lots and keeps the root near square (aspect 0.7 to 1.43)', () => {
    const layout = computeLayout(snapshotFromPaths(REAL_TREE_PATHS, 'plan-base'));
    const lots = layout.lots;
    let overlapping: string | null = null;
    for (let i = 0; i < lots.length && overlapping === null; i += 1) {
      for (let j = i + 1; j < lots.length; j += 1) {
        const a = lots[i]!, b = lots[j]!;
        const sepX = Math.abs(a.center[0] - b.center[0]) >= (a.dimensions[0] + b.dimensions[0]) / 2;
        const sepZ = Math.abs(a.center[2] - b.center[2]) >= (a.dimensions[2] + b.dimensions[2]) / 2;
        if (!sepX && !sepZ) { overlapping = `lots ${i} and ${j}`; break; }
      }
    }
    expect(overlapping).toBeNull();

    const root = layout.districts.find((d) => d.parentId === null)!;
    const aspect = root.extent[0] / root.extent[1];
    expect(aspect).toBeGreaterThanOrEqual(0.7);
    expect(aspect).toBeLessThanOrEqual(1.43);
  });

  it('is the same figure for the reversed path list (determinism)', () => {
    const reversed = REAL_TREE_PATHS.map((_, i) => REAL_TREE_PATHS[REAL_TREE_PATHS.length - 1 - i]!);
    const forward = rootOccupancy(computeLayout(snapshotFromPaths(REAL_TREE_PATHS, 'plan-base')));
    const backward = rootOccupancy(computeLayout(snapshotFromPaths(reversed, 'plan-base')));
    expect(backward).toBe(forward);
    expect(backward).toBeGreaterThanOrEqual(ADOPTION_FLOOR);
  });
});
