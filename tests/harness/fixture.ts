// ONE deterministic snapshot, shaped like a real repository rather than like a
// minimal test case: the harness exists to be looked at, and a three-file city
// photographs nothing. 144 files over 6 districts matches the design package's own
// reference fixture, so a capture and `mockups/s05-city.png` are comparable as
// compositions.
//
// Gap closure GRA7/GCO19/B2: `?city=dense` and `?city=sparse` swap in a crowded and an
// almost-empty city, to see what the relation arcs do among many tall buildings and over
// open ground. Every other capture keeps the default.
import { buildSnapshotFixture } from '../fixtures/snapshot-builder';
import { computeLayout } from '../../src/domain/layout/layout';
import type { CodebaseSnapshot } from '../../src/domain/model';
import type { LayoutResult } from '../../src/domain/layout/types';

export type HarnessCityKind = 'default' | 'dense' | 'sparse';

/** Dense city: four very tall files (clamped to the tallest building), each standing mid-way
 *  along the corridor from the selected file 4 to a related file: 341 on 4 -> 10, 55 on
 *  4 -> 23, 480 on 4 -> 31 and 412 on 4 -> 57 (checked against the layout, tests/harness). */
const DENSE_TALL_FILES: Readonly<Record<number, number>> = { 341: 3000, 55: 3000, 480: 3000, 412: 3000 };

function denseLineCounts(files: number): number[] {
  return Array.from({ length: files }, (_, i) => DENSE_TALL_FILES[i] ?? 10 + (i % 140));
}

export function harnessSnapshot(kind: HarnessCityKind = 'default'): CodebaseSnapshot {
  if (kind === 'dense') {
    return buildSnapshotFixture({
      files: 600, directories: 12, repositoryId: 'harness-city-dense', measuredZero: 1, unavailable: 3,
      lineCounts: denseLineCounts(600),
    });
  }
  if (kind === 'sparse') {
    return buildSnapshotFixture({ files: 24, directories: 3, repositoryId: 'harness-city-sparse', measuredZero: 1, unavailable: 3 });
  }
  return buildSnapshotFixture({
    files: 144,
    directories: 6,
    repositoryId: 'harness-city',
    // One measured zero and three unavailable, so a capture shows the three distinct
    // metric states interactions/03 requires be distinguishable — a measured 0 is not
    // an unknown, and neither is drawn as the other.
    measuredZero: 1,
    unavailable: 3,
    // Part 5 V30 (Part 4 E17), ruling E22: a real scan marks a snapshot partial whenever
    // a file was skipped (inventory-collector.ts's warningReasons), carrying the walk's
    // own skip reason verbatim. This is node-source-filesystem.ts's `readAsText` reason
    // for a binary file, passed through unmodified by walker.ts's `reason: read.reason`.
    completeness: 'partial',
    warnings: ['file appears to contain binary content'],
  });
}

export function harnessLayout(kind: HarnessCityKind = 'default'): LayoutResult {
  return computeLayout(harnessSnapshot(kind));
}
