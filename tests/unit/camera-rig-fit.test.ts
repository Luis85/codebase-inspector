// Phase 2c, I2b / defect 4(a) -- WHAT fit() FRAMES, in a file of its own so
// tests/unit/camera-rig.test.ts stays inside the tests/** 450-line budget.
//
// Pure maths over a Three OrthographicCamera -- no canvas, no WebGL, no DOM.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Mock } from 'vitest';
import { Vector3 } from 'three';
import { createCameraRig, type CameraRig } from '../../src/visualization/camera-rig';

type Bounds = { min: [number, number, number]; max: [number, number, number] };

let changed: Mock<() => void>;

describe('camera rig: framing', () => {
  beforeEach(() => { changed = vi.fn<() => void>(); });

  // Phase 2c, I2b / defect 4(a). `fit()` framed the AABB's CIRCUMSCRIBED SPHERE --
  // `boundsRadius` returns half the 3D diagonal -- and a codebase city is a flat,
  // elongated plate, so that sphere is far larger than what is actually drawn. Intended
  // margin 10%; measured 41-61%, worse the wider the leaf, so the city sat small in a
  // large empty field. The projection maths (`fitZoom`, `applyAspect`) was confirmed
  // ARITHMETICALLY CORRECT by both reports independently -- the radius was the fault.
  describe('I2b: fit() frames what is DRAWN, not the circumscribed sphere', () => {
    // The user's own tree, as measured against their real scan.
    const PLATE: Bounds = { min: [0, 0, 0], max: [762, 128, 1518] };

    /** The NDC span of the bounds' eight corners, per screen axis. A perfect fit puts the
     *  binding axis at 2 / FIT_MARGIN = 1.818; anything above 2 is CLIPPED. */
    function ndcSpan(r: CameraRig, b: Bounds): { x: number; y: number } {
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      for (const x of [b.min[0], b.max[0]]) {
        for (const y of [b.min[1], b.max[1]]) {
          for (const z of [b.min[2], b.max[2]]) {
            const v = new Vector3(x, y, z).project(r.camera);
            minX = Math.min(minX, v.x); maxX = Math.max(maxX, v.x);
            minY = Math.min(minY, v.y); maxY = Math.max(maxY, v.y);
          }
        }
      }
      return { x: maxX - minX, y: maxY - minY };
    }

    for (const [w, h] of [[1000, 700], [1400, 700], [600, 700], [1876, 730]] as const) {
      it(`fills the binding axis of a ${w}x${h} stage`, () => {
        const r = createCameraRig({ bounds: PLATE, onChanged: changed });
        r.setViewportSize(w, h);
        r.fit();
        const span = ndcSpan(r, PLATE);
        // Nothing clipped, in either axis -- the guard that stops "fill more" being
        // satisfied by cropping the city.
        expect(span.x).toBeLessThanOrEqual(2);
        expect(span.y).toBeLessThanOrEqual(2);
        // ...and the binding axis genuinely used. Before the fix: 1.10, i.e. 55%.
        expect(Math.max(span.x, span.y)).toBeGreaterThan(1.6);
      });
    }

    it('still frames TOP view, where the plate is a narrow vertical ribbon', () => {
      const r = createCameraRig({ bounds: PLATE, onChanged: changed });
      r.setViewportSize(1000, 700);
      r.setCameraMode('top');
      r.fit();
      const span = ndcSpan(r, PLATE);
      expect(Math.max(span.x, span.y)).toBeGreaterThan(1.6);
      expect(Math.max(span.x, span.y)).toBeLessThanOrEqual(2);
    });
  });
});
