// The per-scenario BASELINE: what the view held before the step under test, and the
// two-sided "nothing moved the camera" check.
//
// Split out of ui-steps.ts in fix round 1 (that file reached the tests/** 450-line cap
// once scenarios 8, 11 and 12 moved to consent-steps.ts) and shared by both step modules
// so there is one definition of "unchanged", not two that could drift.
import { expect } from 'vitest';
import { put, take, ui } from './world';
import type { World } from './world';
import type { CameraBookmark } from '../../src/domain/model';

/** What `setLayout`'s own auto-fit commits on a fresh renderer, mirrored back out as
 *  `camera-changed` exactly as city-renderer.ts does. Every scenario therefore starts
 *  with a REAL camera bookmark, so "unchanged" is never trivially "still null". */
export const FIT_CAMERA: CameraBookmark = {
  projection: 'orthographic', mode: '3d',
  position: [20, 20, 20], target: [0, 0, 0], up: [0, 1, 0], zoom: 1,
};

export interface Baseline {
  camera: CameraBookmark | null;
  query: string;
  selectedEntityId: string | null;
  snapshotId: string;
  lots: string;
}

function baselineOf(world: World): Baseline {
  const harness = ui(world);
  return {
    camera: harness.store.camera ? { ...harness.store.camera } : null,
    query: harness.store.query,
    selectedEntityId: harness.store.selectedEntityId,
    snapshotId: harness.store.snapshot!.snapshotId,
    lots: JSON.stringify(harness.layout.lots.map((lot) => lot.center)),
  };
}

export function markBaseline(world: World): void {
  put(world, 'baseline', baselineOf(world));
}

export function expectCameraUnchanged(world: World): void {
  const before = take<Baseline>(world, 'baseline');
  const harness = ui(world);
  expect(harness.store.camera).toEqual(before.camera);
  // Nothing COMMANDED the camera either: an unchanged bookmark that was moved and moved
  // back would satisfy the value check alone.
  expect(harness.renderer?.calls.setCamera).not.toHaveBeenCalled();
  expect(harness.renderer?.calls.nudgeCamera).not.toHaveBeenCalled();
  expect(harness.renderer?.calls.fit).not.toHaveBeenCalled();
}

