// The live camera, and the CameraBookmark that is its persisted form (spec 4.2).
//
// Two decisions carry this file:
//
// 1. The BOOKMARK is the source of truth, and it stores ABSOLUTE position/target/up/
//    zoom. Spherical angles are derived on demand, inside orbit, and thrown away —
//    they are never persisted. The prototype recomputes its orbit radius from the
//    layout extent, so a bookmark restored against anything but a byte-identical
//    layout lands somewhere else; storing absolutes is what makes the
//    dispose-and-reconstruct round trip spec 11 leaves open actually exact.
// 2. The orthographic frustum is a FIXED half-height of 1, so `zoom` carries the
//    entire scale of the view. Nothing about what the camera shows depends on the
//    current layout's extent — again so a bookmark alone determines the view. fit()
//    is the only thing that reads the bounds, and resize() never fits (spec 4.2).
//
// getCamera() reports the LOGICAL camera (the destination), not the tweened one, so
// every round trip is exact whatever the motion setting is. Tweening is purely
// visual: `advance()` walks the live camera toward the bookmark and reports whether
// it is still moving, which is the only thing that keeps invalidating frames. There
// is no inertia and no decay — motion stops the frame the tween ends.
import { OrthographicCamera, Vector3 } from 'three';
import type { CameraBookmark } from '../domain/model';

export interface CameraRigBounds {
  min: [number, number, number];
  max: [number, number, number];
}

export interface CameraRigOptions {
  bounds: CameraRigBounds;
  /** Called for a RIG-INITIATED move only (nudge/fit/focus/mode switch) — never from
   *  setCamera, which is the inbound command. Keeping the two apart is what stops
   *  host synchronisation looping (spec 4.2). */
  onChanged: () => void;
}

export interface CameraRig {
  readonly camera: OrthographicCamera;
  getCamera(): CameraBookmark;
  setCamera(bookmark: CameraBookmark): void;
  setCameraMode(mode: '3d' | 'top'): void;
  setMotion(mode: 'standard' | 'reduced'): void;
  setBounds(bounds: CameraRigBounds): void;
  setViewportSize(cssWidth: number, cssHeight: number): void;
  nudge(delta: { orbit?: [number, number]; pan?: [number, number]; zoomFactor?: number }): void;
  fit(): void;
  focusOn(center: [number, number, number], radius: number): void;
  /** Advances the visual tween by `deltaMs`; returns true while it is still moving. */
  advance(deltaMs: number): boolean;
  isAnimating(): boolean;
  dispose(): void;
}

const FRUSTUM_HALF_HEIGHT = 1;     // see decision 2 above — `zoom` carries the scale
const FIT_MARGIN = 1.1;
const MIN_ZOOM = 1e-4;
const MAX_ZOOM = 1e4;
const MIN_PHI = 0.08;              // never edge-on to the ground plane
const MAX_PHI = Math.PI / 2 - 0.05; // never from below it
const DEFAULT_THETA = Math.PI / 4;
const DEFAULT_PHI = Math.acos(1 / Math.sqrt(3));   // the isometric angle, ~54.7 degrees
const TWEEN_MS = 220;

type Triple = [number, number, number];

function copy(v: Triple): Triple { return [v[0], v[1], v[2]]; }
function copyBookmark(b: CameraBookmark): CameraBookmark {
  return { ...b, position: copy(b.position), target: copy(b.target), up: copy(b.up) };
}
function lerp(a: number, b: number, t: number): number { return a + (b - a) * t; }
function lerpTriple(a: Triple, b: Triple, t: number): Triple {
  return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
}
/** easeInOutCubic — symmetric, zero velocity at both ends, so nothing overshoots and
 *  nothing coasts. */
function ease(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

/** The spherical angles are DERIVED, here, on demand — never persisted. Both of these
 *  are pure, so they live at module scope rather than being rebuilt per rig. */
function positionFor(target: Triple, theta: number, phi: number, radius: number): Triple {
  return [
    target[0] + radius * Math.sin(phi) * Math.cos(theta),
    target[1] + radius * Math.cos(phi),
    target[2] + radius * Math.sin(phi) * Math.sin(theta),
  ];
}

function sphericalOf(b: CameraBookmark): { theta: number; phi: number; radius: number } {
  const dx = b.position[0] - b.target[0];
  const dy = b.position[1] - b.target[1];
  const dz = b.position[2] - b.target[2];
  const radius = Math.hypot(dx, dy, dz) || 1;
  return { theta: Math.atan2(dz, dx), phi: Math.acos(Math.min(1, Math.max(-1, dy / radius))), radius };
}

function boundsCenter(b: CameraRigBounds): Triple {
  return [(b.min[0] + b.max[0]) / 2, (b.min[1] + b.max[1]) / 2, (b.min[2] + b.max[2]) / 2];
}
function boundsRadius(b: CameraRigBounds): number {
  const r = Math.hypot(b.max[0] - b.min[0], b.max[1] - b.min[1], b.max[2] - b.min[2]) / 2;
  return r > 0 ? r : 1;
}

export function createCameraRig(options: CameraRigOptions): CameraRig {
  let bounds = options.bounds;
  let cssWidth = 800;
  let cssHeight = 600;
  let motion: 'standard' | 'reduced' = 'reduced';   // until the view reads matchMedia

  const camera = new OrthographicCamera(-1, 1, FRUSTUM_HALF_HEIGHT, -FRUSTUM_HALF_HEIGHT, 0.1, 1000);

  function orbitDistance(): number { return boundsRadius(bounds) * 4 + 10; }

  function fitZoom(radius: number): number {
    const aspect = cssHeight > 0 ? cssWidth / cssHeight : 1;
    const needed = 2 * radius * FIT_MARGIN;
    const zoomH = (2 * FRUSTUM_HALF_HEIGHT) / needed;
    return clampZoom(Math.min(zoomH, zoomH * aspect));
  }

  function clampZoom(z: number): number {
    return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z));
  }

  function defaultBookmark(): CameraBookmark {
    const target = boundsCenter(bounds);
    return {
      projection: 'orthographic',
      mode: '3d',
      position: positionFor(target, DEFAULT_THETA, DEFAULT_PHI, orbitDistance()),
      target,
      up: [0, 1, 0],
      zoom: fitZoom(boundsRadius(bounds)),
    };
  }

  let bookmark: CameraBookmark = defaultBookmark();
  let saved3d: CameraBookmark = copyBookmark(bookmark);
  let live: CameraBookmark = copyBookmark(bookmark);
  let tweenFrom: CameraBookmark | null = null;
  let tweenElapsed = 0;

  function applyLiveToCamera(): void {
    camera.position.set(live.position[0], live.position[1], live.position[2]);
    camera.up.set(live.up[0], live.up[1], live.up[2]);
    camera.lookAt(new Vector3(live.target[0], live.target[1], live.target[2]));
    camera.zoom = live.zoom;
    const span = Math.hypot(
      live.position[0] - live.target[0],
      live.position[1] - live.target[1],
      live.position[2] - live.target[2],
    );
    camera.near = 0.1;
    camera.far = span * 4 + boundsRadius(bounds) * 8 + 100;
    camera.updateProjectionMatrix();
    // Kept current here rather than relying on the render pass: raycasting and label
    // projection both read matrixWorldInverse, and either can run before the next
    // frame (a click during a paused view, a hover before anything has drawn).
    camera.updateMatrixWorld(true);
  }

  function applyAspect(): void {
    const aspect = cssHeight > 0 ? cssWidth / cssHeight : 1;
    camera.left = -FRUSTUM_HALF_HEIGHT * aspect;
    camera.right = FRUSTUM_HALF_HEIGHT * aspect;
    camera.top = FRUSTUM_HALF_HEIGHT;
    camera.bottom = -FRUSTUM_HALF_HEIGHT;
    camera.updateProjectionMatrix();
  }

  /** Every write to the logical bookmark goes through here: it starts (or skips) the
   *  visual tween and, for a rig-initiated move, reports the change exactly once. */
  function commit(next: CameraBookmark, initiated: boolean): void {
    bookmark = next;
    if (bookmark.mode === '3d') saved3d = copyBookmark(bookmark);
    if (motion === 'standard' && initiated) {
      tweenFrom = copyBookmark(live);
      tweenElapsed = 0;
    } else {
      tweenFrom = null;
      live = copyBookmark(bookmark);
    }
    applyLiveToCamera();
    if (initiated) options.onChanged();
  }

  /** World units per CSS pixel of apparent movement: the visible world height is the
   *  frustum height divided by zoom, spread over the viewport's CSS height. */
  function unitsPerPixel(): number {
    return (2 * FRUSTUM_HALF_HEIGHT / bookmark.zoom) / (cssHeight > 0 ? cssHeight : 600);
  }

  function panVector(dx: number, dy: number): Triple {
    const forward = new Vector3(
      bookmark.target[0] - bookmark.position[0],
      bookmark.target[1] - bookmark.position[1],
      bookmark.target[2] - bookmark.position[2],
    ).normalize();
    const up = new Vector3(bookmark.up[0], bookmark.up[1], bookmark.up[2]);
    const right = new Vector3().crossVectors(forward, up).normalize();
    const screenUp = new Vector3().crossVectors(right, forward).normalize();
    const unit = unitsPerPixel();
    // Dragging right moves the CONTENT right, so the camera moves left.
    const v = right.multiplyScalar(-dx * unit).add(screenUp.multiplyScalar(dy * unit));
    return [v.x, v.y, v.z];
  }

  const rig: CameraRig = {
    camera,

    getCamera: () => copyBookmark(bookmark),

    setCamera(next: CameraBookmark): void {
      // THE BOOKMARK WINS, including a mode switch (spec 4.2). A command, never an
      // event: this must not call onChanged.
      if (bookmark.mode === '3d' && next.mode !== '3d') saved3d = copyBookmark(bookmark);
      commit(copyBookmark(next), false);
    },

    setCameraMode(mode: '3d' | 'top'): void {
      if (bookmark.mode === mode) return;
      if (mode === 'top') {
        saved3d = copyBookmark(bookmark);
        const target = copy(bookmark.target);
        commit({
          ...bookmark, mode: 'top',
          target,
          position: [target[0], target[1] + orbitDistance(), target[2]],
          up: [0, 0, -1],
        }, true);
        return;
      }
      commit(copyBookmark(saved3d), true);   // restored IN FULL
    },

    setMotion(next: 'standard' | 'reduced'): void {
      motion = next;
      if (next === 'reduced') {
        tweenFrom = null;
        live = copyBookmark(bookmark);
        applyLiveToCamera();
      }
    },

    setBounds(next: CameraRigBounds): void {
      bounds = next;
    },

    setViewportSize(width: number, height: number): void {
      if (width <= 0 || height <= 0) return;
      cssWidth = width;
      cssHeight = height;
      applyAspect();                 // resize NEVER implies fit (spec 4.2)
    },

    nudge(delta): void {
      let next = copyBookmark(bookmark);
      if (delta.orbit && next.mode === '3d') {
        // Top view is a plan: it has no orbit. Pan and zoom still apply there.
        const { theta, phi, radius } = sphericalOf(next);
        const nextPhi = Math.min(MAX_PHI, Math.max(MIN_PHI, phi + delta.orbit[1]));
        next = { ...next, position: positionFor(next.target, theta + delta.orbit[0], nextPhi, radius) };
      }
      if (delta.pan) {
        const [vx, vy, vz] = panVector(delta.pan[0], delta.pan[1]);
        next = {
          ...next,
          position: [next.position[0] + vx, next.position[1] + vy, next.position[2] + vz],
          target: [next.target[0] + vx, next.target[1] + vy, next.target[2] + vz],
        };
      }
      if (delta.zoomFactor) next = { ...next, zoom: clampZoom(next.zoom * delta.zoomFactor) };
      commit(next, true);
    },

    fit(): void {
      const target = boundsCenter(bounds);
      const { theta, phi } = sphericalOf(bookmark);
      const position = bookmark.mode === 'top'
        ? [target[0], target[1] + orbitDistance(), target[2]] as Triple
        : positionFor(target, theta, phi, orbitDistance());
      commit({ ...bookmark, target, position, zoom: fitZoom(boundsRadius(bounds)) }, true);
    },

    focusOn(center: Triple, radius: number): void {
      const { theta, phi } = sphericalOf(bookmark);
      const target = copy(center);
      const position = bookmark.mode === 'top'
        ? [target[0], target[1] + orbitDistance(), target[2]] as Triple
        : positionFor(target, theta, phi, orbitDistance());
      commit({ ...bookmark, target, position, zoom: fitZoom(Math.max(radius, 0.5)) }, true);
    },

    advance(deltaMs: number): boolean {
      if (!tweenFrom) return false;
      tweenElapsed += deltaMs;
      const t = Math.min(1, tweenElapsed / TWEEN_MS);
      const e = ease(t);
      live = {
        ...bookmark,
        position: lerpTriple(tweenFrom.position, bookmark.position, e),
        target: lerpTriple(tweenFrom.target, bookmark.target, e),
        up: lerpTriple(tweenFrom.up, bookmark.up, e),
        zoom: lerp(tweenFrom.zoom, bookmark.zoom, e),
      };
      if (t >= 1) {
        tweenFrom = null;
        live = copyBookmark(bookmark);
      }
      applyLiveToCamera();
      return tweenFrom !== null;
    },

    isAnimating: () => tweenFrom !== null,

    dispose(): void {
      tweenFrom = null;
      // r186 gave Object3D a dispose(); OrthographicCamera does not override it, so
      // this is the base implementation and there is nothing to call super on here.
      camera.dispose();
    },
  };

  applyAspect();
  applyLiveToCamera();
  return rig;
}
