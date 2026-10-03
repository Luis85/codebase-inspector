// Phase 2c, ruling M101 -- THE SIGN MATRIX, in a file of its own so
// tests/unit/camera-rig.test.ts stays inside the tests/** 450-line budget.
//
// A single-axis sign error is the classic "the controls feel wrong" signature, and the
// value of pinning it as a MATRIX rather than one hand-picked direction is that three of
// the four cases were already correct: before the fix this file failed on exactly one of
// them (3D horizontal) and passed on the other three. A test that asserted only the
// broken case would not have told the next reader that the other three must not move.
//
// Pure maths over a Three OrthographicCamera -- no canvas, no WebGL, no DOM.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Mock } from 'vitest';
import { Vector3 } from 'three';
import { createCameraRig, ORBIT_RADIANS_PER_CSS_PX, type CameraRig } from '../../src/visualization/camera-rig';

type Bounds = { min: [number, number, number]; max: [number, number, number] };
const SMALL: Bounds = { min: [-10, 0, -10], max: [10, 6, 10] };

let changed: Mock<() => void>;

function makeRig(bounds: Bounds): CameraRig {
  const rig = createCameraRig({ bounds, onChanged: changed });
  rig.setViewportSize(800, 600);
  return rig;
}

/** The unit view direction, which fit() and focusOn() must both leave untouched. */
function direction(b: { position: readonly number[]; target: readonly number[] }): number[] {
  const d = [0, 1, 2].map((i) => b.position[i]! - b.target[i]!);
  const length = Math.hypot(...d);
  return d.map((v) => v / length);
}

/** How far the camera moved along the SCREEN axis this drag was made on, signed. The
 *  content appears to move the other way, so two inputs agree iff these agree in sign.
 *  The basis is taken BEFORE the move, which is the frame the user's hand is in. */
function shiftAlongScreen(
  mode: '3d' | 'top',
  delta: Parameters<CameraRig['nudge']>[0],
  axis: 'horizontal' | 'vertical',
): number {
  const r = makeRig(SMALL);
  r.setCameraMode(mode);
  const before = r.getCamera();
  const forward = new Vector3(
    before.target[0] - before.position[0],
    before.target[1] - before.position[1],
    before.target[2] - before.position[2],
  ).normalize();
  const up = new Vector3(before.up[0], before.up[1], before.up[2]);
  const right = new Vector3().crossVectors(forward, up).normalize();
  const screenUp = new Vector3().crossVectors(right, forward).normalize();
  r.nudge(delta);
  const after = r.getCamera();
  const moved = new Vector3(
    after.position[0] - before.position[0],
    after.position[1] - before.position[1],
    after.position[2] - before.position[2],
  );
  return moved.dot(axis === 'horizontal' ? right : screenUp);
}

describe('camera rig: drag direction', () => {
  let rig: CameraRig;

  beforeEach(() => {
    changed = vi.fn<() => void>();
    rig = makeRig(SMALL);
  });

  // Phase 2c, ruling M101. A SINGLE-AXIS sign error: the 3D horizontal orbit is
  // inverted and the vertical is not, which is exactly the shape a user calls
  // "inverted". Pinned as the whole sign matrix rather than one hand-picked direction,
  // because the value of the assertion is that it holds for the three cases that are
  // already correct as well as the one that is not: today it fails on exactly one of
  // the four (3D horizontal) and passes on the other three.
  //
  // The evidence is INTERNAL and needs no outside reference: 01-core-interactions.md
  // rows 15-16 put "primary drag -> orbit" and "modified-primary drag -> pan" on the
  // same gesture surface, and today the same rightward drag moves the city LEFT with
  // the primary button and RIGHT with Shift held, in the same view.
  describe('M101: every drag moves the city the SAME way, on both axes and in both modes', () => {
    const DRAG = 100;   // CSS px

    for (const mode of ['3d', 'top'] as const) {
      for (const axis of ['horizontal', 'vertical'] as const) {
        it(`${mode} / ${axis}`, () => {
          // picking.ts hands raw CSS px; city-renderer.ts turns a drag into an orbit
          // delta by pre-multiplying BOTH components by -ORBIT_RADIANS_PER_CSS_PX, and
          // the same drag with a modifier held becomes onPan(dx, dy) untouched. These
          // are those two call sites, verbatim.
          const [dx, dy] = axis === 'horizontal' ? [DRAG, 0] : [0, DRAG];
          const orbitShift = shiftAlongScreen(mode, {
            orbit: [-dx * ORBIT_RADIANS_PER_CSS_PX, -dy * ORBIT_RADIANS_PER_CSS_PX],
          }, axis);
          const panShift = shiftAlongScreen(mode, { pan: [dx, dy] }, axis);
          expect(Math.abs(orbitShift)).toBeGreaterThan(1e-6);
          expect(Math.abs(panShift)).toBeGreaterThan(1e-6);
          expect(Math.sign(orbitShift)).toBe(Math.sign(panShift));
        });
      }
    }
  });

  it('M101: leaves fit(), focusOn() and a restored bookmark untouched', () => {
    // fit/focusOn derive their angles from sphericalOf(bookmark) and never pass a delta
    // through the orbit branch, and a bookmark stores absolute position/target -- so no
    // persisted view may move because of the sign change.
    const bookmark = rig.getCamera();
    rig.setCamera({ ...bookmark, position: [3, 4, 5], target: [1, 1, 1] });
    expect(rig.getCamera().position).toEqual([3, 4, 5]);
    const before = direction(rig.getCamera());
    rig.fit();
    direction(rig.getCamera()).forEach((v, i) => { expect(v).toBeCloseTo(before[i]!, 6); });
    rig.focusOn([0, 0, 0], 2);
    direction(rig.getCamera()).forEach((v, i) => { expect(v).toBeCloseTo(before[i]!, 6); });
  });
});
