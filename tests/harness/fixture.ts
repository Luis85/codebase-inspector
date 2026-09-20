// ONE deterministic snapshot, shaped like a real repository rather than like a
// minimal test case: the harness exists to be looked at, and a three-file city
// photographs nothing. 144 files over 6 districts matches the design package's own
// reference fixture, so a capture and `mockups/s05-city.png` are comparable as
// compositions.
import { buildSnapshotFixture } from '../fixtures/snapshot-builder';
import { computeLayout } from '../../src/domain/layout/layout';
import type { CodebaseSnapshot } from '../../src/domain/model';
import type { LayoutResult } from '../../src/domain/layout/types';

export function harnessSnapshot(): CodebaseSnapshot {
  return buildSnapshotFixture({
    files: 144,
    directories: 6,
    repositoryId: 'harness-city',
    // One measured zero and three unavailable, so a capture shows the three distinct
    // metric states interactions/03 requires be distinguishable — a measured 0 is not
    // an unknown, and neither is drawn as the other.
    measuredZero: 1,
    unavailable: 3,
  });
}

export function harnessLayout(): LayoutResult {
  return computeLayout(harnessSnapshot());
}
