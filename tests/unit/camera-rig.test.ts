// Task 10 step 5. The rig owns the live camera; the BOOKMARK is the persisted form and
// the source of truth for what getCamera() reports (spec 4.2). Everything here is pure
// maths over a Three OrthographicCamera — no canvas, no WebGL, no DOM.
//
// Spec 11's open question — "whether a renderer reconstructed from a CameraBookmark and
// a LayoutResult lands where it left off" — is answered by the two round-trip tests
// below. Both prototypes agree on dispose-and-reconstruct and NEITHER demonstrates it.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Mock } from 'vitest';
import { createCameraRig, ORBIT_RADIANS_PER_CSS_PX, type CameraRig } from '../../src/visualization/camera-rig';
import type { CameraBookmark } from '../../src/domain/model';

type Bounds = { min: [number, number, number]; max: [number, number, number] };

const SMALL: Bounds = { min: [-10, 0, -10], max: [10, 6, 10] };
const LARGER: Bounds = { min: [-400, 0, -250], max: [400, 40, 250] };

let changed: Mock<() => void>;

function makeRig(bounds: Bounds): CameraRig {
  const rig = createCameraRig({ bounds, onChanged: changed });
  rig.setViewportSize(800, 600);
  return rig;
}

function distance(a: readonly number[], b: readonly number[]): number {
  return Math.hypot(a[0]! - b[0]!, a[1]! - b[1]!, a[2]! - b[2]!);
}

/** The azimuth of the eye about the target — the angle an orbit step moves. */
function azimuth(b: CameraBookmark): number {
  return Math.atan2(b.position[2] - b.target[2], b.position[0] - b.target[0]);
}

/** The azimuth of the LIVE (drawn) camera -- the one a user actually sees -- about the
 *  same target. `getCamera()` reports the LOGICAL destination by design, so the two can
 *  only be compared by reading the Three camera directly. */
function liveAzimuth(r: CameraRig, target: readonly number[]): number {
  return Math.atan2(r.camera.position.z - target[2]!, r.camera.position.x - target[0]!);
}

/** The unit view direction, which fit() and focusOn() must both leave untouched. */
function direction(b: CameraBookmark): number[] {
  const d = [0, 1, 2].map((i) => b.position[i]! - b.target[i]!);
  const length = Math.hypot(...d);
  return d.map((v) => v / length);
}

describe('camera rig', () => {
  let rig: CameraRig;

  beforeEach(() => {
    changed = vi.fn<() => void>();
    rig = makeRig(SMALL);
  });

  it('is ORTHOGRAPHIC in both 3D and top view, with an oblique 3D default', () => {
    expect(rig.camera.isOrthographicCamera).toBe(true);
    const threeD = rig.getCamera();
    expect(threeD.projection).toBe('orthographic');
    expect(threeD.mode).toBe('3d');
    // Oblique: displaced from the target on all three axes, and above it — never a
    // plan or an elevation, which is what 'top' is for.
    const [dx, dy, dz] = [0, 1, 2].map((i) => threeD.position[i]! - threeD.target[i]!);
    expect(Math.abs(dx!)).toBeGreaterThan(0.01);
    expect(Math.abs(dz!)).toBeGreaterThan(0.01);
    expect(dy!).toBeGreaterThan(0);

    rig.setCameraMode('top');
    const top = rig.getCamera();
    expect(rig.camera.isOrthographicCamera).toBe(true);
    expect(top.projection).toBe('orthographic');
    expect(top.position[0]).toBeCloseTo(top.target[0], 6);
    expect(top.position[2]).toBeCloseTo(top.target[2], 6);
    expect(top.position[1]).toBeGreaterThan(top.target[1]);
    expect(top.up).toEqual([0, 0, -1]);       // 'up' is +Z-back looking straight down
  });

  it('persists ABSOLUTE position/target/up, deriving spherical angles internally', () => {
    const b = rig.getCamera();
    expect(b.projection).toBe('orthographic');
    expect(b.mode).toBe('3d');
    expect(Array.isArray(b.position)).toBe(true);
    expect(Array.isArray(b.target)).toBe(true);
    expect(Array.isArray(b.up)).toBe(true);
    expect(typeof b.zoom).toBe('number');
    expect(b).not.toHaveProperty('theta');
    expect(b).not.toHaveProperty('phi');
    expect(b).not.toHaveProperty('radius');
    // Orbiting is still available — the angles simply are not the persisted form.
    const before = rig.getCamera();
    rig.nudge({ orbit: [0.12, 0] });
    expect(rig.getCamera().position).not.toEqual(before.position);
  });

  it('round-trips a bookmark through dispose and RECONSTRUCT', () => {
    rig.nudge({ orbit: [0.4, 0.15] });
    rig.nudge({ zoomFactor: 1.15 });
    const b = rig.getCamera();
    rig.dispose();

    const rebuilt = makeRig(SMALL);
    rebuilt.setCamera(b);
    expect(rebuilt.getCamera()).toEqual(b);
  });

  it('round-trips a bookmark against a DIFFERENT layout extent', () => {
    // Absolute coordinates are the persisted form precisely so this holds: the
    // prototype recomputes radius from layout extent, so a restored bookmark would
    // only be exact if the layout were byte-identical.
    rig.nudge({ orbit: [0.3, -0.1] });
    const b = rig.getCamera();

    const rebuilt = makeRig(LARGER);
    rebuilt.setCamera(b);
    expect(rebuilt.getCamera()).toEqual(b);
    expect(rebuilt.camera.zoom).toBe(b.zoom);
    expect([rebuilt.camera.position.x, rebuilt.camera.position.y, rebuilt.camera.position.z])
      .toEqual(b.position);
  });

  it('returns a COPY of the bookmark, so a caller cannot mutate the rig through it', () => {
    const b = rig.getCamera();
    b.position[0] = 9999;
    b.zoom = 1234;
    expect(rig.getCamera().position[0]).not.toBe(9999);
    expect(rig.getCamera().zoom).not.toBe(1234);
  });

  it('lets the BOOKMARK WIN when its mode differs from the current mode', () => {
    rig.setCameraMode('3d');
    const bookmark = rig.getCamera();
    rig.setCamera({ ...bookmark, mode: 'top' });
    expect(rig.getCamera().mode).toBe('top');
  });

  it('restores the saved 3D bookmark IN FULL on top -> 3D', () => {
    rig.nudge({ orbit: [0.5, 0.2] });
    rig.nudge({ zoomFactor: 1.2 });
    const saved = rig.getCamera();

    rig.setCameraMode('top');
    expect(rig.getCamera().mode).toBe('top');
    rig.setCameraMode('3d');
    expect(rig.getCamera()).toEqual(saved);
  });

  it('never mutates the saved 3D bookmark from a top-view operation', () => {
    const saved = rig.getCamera();
    rig.setCameraMode('top');
    rig.nudge({ orbit: [0.9, 0.3] });
    rig.nudge({ zoomFactor: 2 });
    rig.nudge({ pan: [120, 90] });
    rig.setCameraMode('3d');
    expect(rig.getCamera()).toEqual(saved);
  });

  // Phase 2 fix wave, I3 (Important): a primary drag in top view did NOTHING.
  // picking.ts routes an unmodified primary drag to onOrbit regardless of camera
  // mode, and nudge() discarded it (`if (delta.orbit && next.mode === '3d')`) --
  // the bookmark came back unchanged, commit() still fired onChanged, a frame was
  // scheduled, and the city did not move, with no cue why. The rank-4 handoff is
  // explicit ("Primary drag | Orbit in 3D; PAN IN TOP VIEW") and makes it a
  // checkpoint step. The dock's Rotate buttons and the unshifted arrow keys were
  // silently inert there for the same reason, while remaining visibly enabled.
  //
  // Fixed in the RIG, not in picking.ts: the frozen port keeps its signature, and
  // every caller of an orbit delta -- drag, buttons, keys -- is fixed in one place.
  it('I3: an orbit nudge in TOP view pans the plan instead of doing nothing', () => {
    rig.setCameraMode('top');
    const before = rig.getCamera();

    rig.nudge({ orbit: [0.5, 0.2] });
    const after = rig.getCamera();

    expect(after.mode).toBe('top');                       // still a plan
    expect(distance(after.target, before.target)).toBeGreaterThan(0);
    // The camera and its target move TOGETHER, which is what distinguishes a pan
    // from anything else: the view direction is unchanged.
    expect(distance(after.position, after.target)).toBeCloseTo(distance(before.position, before.target), 6);
    expect(after.up).toEqual(before.up);
    expect(after.zoom).toBe(before.zoom);
  });

  it('I3: the top-view pan it produces is the same gesture the pan path produces', () => {
    // The equivalence that makes this honest: picking.ts turns a drag of (dx, dy)
    // CSS px into `orbit: [-dx * k, -dy * k]`, so an orbit delta in top view must
    // land exactly where `onPan(dx, dy)` would have.
    rig.setCameraMode('top');
    rig.nudge({ orbit: [-40 * ORBIT_RADIANS_PER_CSS_PX, -25 * ORBIT_RADIANS_PER_CSS_PX] });
    const viaOrbit = rig.getCamera();

    const other = makeRig(SMALL);
    other.setCameraMode('top');
    other.nudge({ pan: [40, 25] });
    const viaPan = other.getCamera();

    // Componentwise to 9 decimals, not toEqual: `-dx * k / k` is 1-2 ulp away from
    // `dx` in binary floating point, which is the arithmetic being asserted, not a
    // difference in behaviour.
    expect(viaOrbit.mode).toBe(viaPan.mode);
    expect(viaOrbit.zoom).toBe(viaPan.zoom);
    [0, 1, 2].forEach((i) => {
      expect(viaOrbit.position[i]!).toBeCloseTo(viaPan.position[i]!, 9);
      expect(viaOrbit.target[i]!).toBeCloseTo(viaPan.target[i]!, 9);
    });
  });

  it('I3: 3D view still ORBITS -- the pan translation is top-view only', () => {
    const before = rig.getCamera();
    rig.nudge({ orbit: [0.3, 0] });
    const after = rig.getCamera();
    expect(after.target).toEqual(before.target);          // an orbit never moves the target
    expect(Math.abs(azimuth(after) - azimuth(before))).toBeCloseTo(0.3, 6);
  });

  it('applies the spec step increments', () => {
    const before = rig.getCamera();
    const radiusBefore = distance(before.position, before.target);

    rig.nudge({ orbit: [0.12, 0] });               // keyboard/button orbit step, radians
    const orbited = rig.getCamera();
    expect(distance(orbited.position, orbited.target)).toBeCloseTo(radiusBefore, 6);
    expect(orbited.target).toEqual(before.target);   // orbit never moves the target
    expect(Math.abs(azimuth(orbited) - azimuth(before))).toBeCloseTo(0.12, 6);

    rig.nudge({ pan: [30, 0] });                   // 30 CSS px of apparent movement
    const panned = rig.getCamera();
    const moved = distance(panned.target, orbited.target);
    // 30 px at this zoom, in world units: the visible world height is 2/zoom over 600
    // CSS px of viewport.
    expect(moved).toBeCloseTo(30 * (2 / orbited.zoom) / 600, 6);
    // Pan translates the whole rig: position and target move by the identical vector,
    // so the view direction is unchanged.
    expect(distance(panned.position, orbited.position)).toBeCloseTo(moved, 6);

    rig.nudge({ zoomFactor: 1.15 });
    expect(rig.getCamera().zoom).toBeCloseTo(panned.zoom * 1.15, 6);
  });

  it('fit() frames the whole layout and never changes the view direction', () => {
    rig.nudge({ orbit: [0.35, 0.1] });
    const before = rig.getCamera();
    rig.fit();
    const after = rig.getCamera();
    direction(after).forEach((v, i) => { expect(v).toBeCloseTo(direction(before)[i]!, 6); });
    expect(after.target).toEqual([0, 3, 0]);      // the layout's own centre
    expect(after.zoom).toBeGreaterThan(0);
  });

  it('has NO INERTIAL DRIFT: it settles on the frame after the last input', () => {
    rig.setMotion('standard');
    rig.nudge({ orbit: [0.2, 0] });
    // One long frame past the tween duration is enough; nothing keeps scheduling.
    rig.advance(10_000);
    expect(rig.isAnimating()).toBe(false);
    rig.advance(10_000);
    expect(rig.isAnimating()).toBe(false);
  });

  it('JUMPS instead of tweening under setMotion("reduced")', () => {
    rig.setMotion('reduced');
    rig.nudge({ orbit: [0.4, 0] });
    const b = rig.getCamera();
    expect(rig.isAnimating()).toBe(false);
    expect(rig.camera.position.x).toBeCloseTo(b.position[0], 6);
    expect(rig.camera.position.z).toBeCloseTo(b.position[2], 6);
    expect(rig.camera.zoom).toBeCloseTo(b.zoom, 6);
  });

  it('tweens under setMotion("standard")', () => {
    rig.setMotion('standard');
    const from = rig.camera.position.clone();
    rig.nudge({ orbit: [0.4, 0] });
    const b = rig.getCamera();
    // The logical bookmark is already at the destination; the LIVE camera is not.
    expect(rig.isAnimating()).toBe(true);
    expect(rig.camera.position.x).toBeCloseTo(from.x, 6);
    rig.advance(16);
    expect(rig.camera.position.x).not.toBeCloseTo(from.x, 6);
    expect(rig.advance(10_000)).toBe(false);
    expect(rig.camera.position.x).toBeCloseTo(b.position[0], 6);
  });

  it('emits camera-changed as an EVENT, separate from the setCamera COMMAND', () => {
    // So host synchronisation does not loop (spec 4.2).
    const bookmark = rig.getCamera();
    rig.setCamera(bookmark);
    expect(changed).not.toHaveBeenCalled();

    rig.nudge({ zoomFactor: 1.15 });
    expect(changed).toHaveBeenCalled();           // a rig-initiated move DOES report
  });

  // Phase 2 fix wave, M6: making `setMotion('reduced')` not snap the live camera to
  // the bookmark left the suite green. Spec 4.4 requires the preference to reach the
  // tween, and CityViewport re-reads it on every reconstruction and now tracks live
  // OS changes -- none of which meant anything without an assertion that reduced
  // motion actually skips the tween that is already in flight.
  it('M6: reduced motion snaps the live camera to the bookmark and ends the tween', () => {
    rig.setMotion('standard');
    rig.nudge({ zoomFactor: 2 });
    expect(rig.isAnimating()).toBe(true);
    // The LIVE camera still lags the logical one: that is what a tween is.
    expect(rig.camera.zoom).not.toBeCloseTo(rig.getCamera().zoom, 6);

    rig.setMotion('reduced');
    expect(rig.isAnimating()).toBe(false);
    expect(rig.camera.zoom).toBeCloseTo(rig.getCamera().zoom, 9);
    expect(rig.camera.position.x).toBeCloseTo(rig.getCamera().position[0], 9);

    // ...and a move made while reduced never starts one at all.
    rig.nudge({ zoomFactor: 2 });
    expect(rig.isAnimating()).toBe(false);
    expect(rig.camera.zoom).toBeCloseTo(rig.getCamera().zoom, 9);
  });

  it('reports a rig-initiated move for fit, focus and mode switches too', () => {
    rig.fit();
    rig.focusOn([1, 2, 3], 4);
    rig.setCameraMode('top');
    expect(changed).toHaveBeenCalledTimes(3);
  });

  it('focusOn centres the target on the requested point without changing direction', () => {
    const before = rig.getCamera();
    rig.focusOn([5, 1, -4], 2);
    const after = rig.getCamera();
    expect(after.target).toEqual([5, 1, -4]);
    direction(after).forEach((v, i) => { expect(v).toBeCloseTo(direction(before)[i]!, 6); });
  });

  it('clamps the orbit above the ground plane, so the city is never viewed from below', () => {
    for (let i = 0; i < 40; i++) rig.nudge({ orbit: [0, 0.3] });
    const down = rig.getCamera();
    expect(down.position[1]).toBeGreaterThan(down.target[1]);
    for (let i = 0; i < 40; i++) rig.nudge({ orbit: [0, -0.3] });
    const up = rig.getCamera();
    expect(up.position[1]).toBeGreaterThan(up.target[1]);
  });

  it('keeps zoom positive and finite under repeated zoom-out', () => {
    for (let i = 0; i < 200; i++) rig.nudge({ zoomFactor: 1 / 1.15 });
    const z = rig.getCamera().zoom;
    expect(z).toBeGreaterThan(0);
    expect(Number.isFinite(z)).toBe(true);
  });

  // Phase 2c, I1 (Important). No existing tween test drives a SEQUENCE: every one of
  // them issues exactly one nudge and then advances, so the suite could not tell the
  // defective rig from its fix (the review's MUT-2 survived all 804 tests). A real drag
  // is the only shape that exposes it -- MANY nudges between frames, at a REALISTIC
  // frame delta. `commit()` restarted the 220 ms ease on every initiated move, so a
  // continuous drag re-armed it ~60x/s and `ease(16.7/220) = 0.0017` of the gap closed
  // per frame: the drawn camera moved 1.74% of the gesture while it happened and then
  // leapt the rest on release.
  it('I1: a CONTINUOUS drag is NOT smoothed away -- the drawn camera tracks the gesture', () => {
    rig.setMotion('standard');
    const target = rig.getCamera().target;
    const start = liveAzimuth(rig, target);
    // One second of dragging at a 125 Hz pointer against a 60 Hz rAF clock: two pointer
    // events per frame, exactly what picking.ts delivers on a real drag.
    for (let frame = 0; frame < 60; frame++) {
      for (let event = 0; event < 2; event++) {
        rig.nudge({ orbit: [-4 * ORBIT_RADIANS_PER_CSS_PX, 0] }, { continuous: true });
      }
      rig.advance(1000 / 60);
    }
    const drawn = Math.abs(liveAzimuth(rig, target) - start);
    const logical = Math.abs(azimuth(rig.getCamera()) - start);
    expect(logical).toBeGreaterThan(0.5);            // the gesture really did move
    expect(drawn / logical).toBeGreaterThan(0.9);    // before the fix: 0.017
  });

  it('I1: a continuous move leaves NOTHING still animating after the gesture stops', () => {
    rig.setMotion('standard');
    rig.nudge({ orbit: [0.4, 0] }, { continuous: true });
    // The review measured twelve further frames drawn after the last pointermove. A
    // continuous commit writes the live camera directly, so there is nothing to settle.
    expect(rig.isAnimating()).toBe(false);
    expect(rig.advance(16)).toBe(false);
  });

  it('I1: a DISCRETE move still tweens -- the fix must not delete the tween', () => {
    // The dock buttons, the arrow keys, Fit, Focus and the mode switch are discrete
    // commands, and easing 220 ms into a jump is the designed behaviour there.
    rig.setMotion('standard');
    const from = rig.camera.position.x;
    rig.nudge({ orbit: [0.4, 0] });
    expect(rig.isAnimating()).toBe(true);
    expect(rig.camera.position.x).toBeCloseTo(from, 6);
  });

  it('I1: a continuous move still REPORTS, so the host keeps mirroring the bookmark', () => {
    rig.setMotion('standard');
    changed.mockClear();
    rig.nudge({ orbit: [0.1, 0] }, { continuous: true });
    expect(changed).toHaveBeenCalledTimes(1);
  });

});
