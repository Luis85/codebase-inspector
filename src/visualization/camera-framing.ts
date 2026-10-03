// What `fit()` should frame, as pure geometry.
//
// Phase 2c, I2b / defect 4(a). `camera-rig.fit()` used to frame the bounds AABB's
// CIRCUMSCRIBED SPHERE — `boundsRadius` returns half the 3D diagonal — and a codebase
// city is a flat, elongated plate, much wider and deeper than it is tall. That sphere is
// far larger than anything actually drawn, so `fit()` systematically zoomed out much
// further than FIT_MARGIN implies: the intended margin is 10 %, the measured margin was
// 41–61 %, and it got worse the wider the leaf. A wide Obsidian main pane therefore
// showed a small city marooned in a large empty field — "the layout itself was not good,
// the whole view is way too wide".
//
// Both the review and the diagnosis confirmed independently that the projection maths
// itself (`fitZoom`'s min-of-two-bounds, `applyAspect`) is ARITHMETICALLY CORRECT. The
// radius it was handed was the fault, which is why the fix is here and not there.
//
// Split out of camera-rig.ts rather than inlined so that file stays inside the src/**
// 400-line limit, and because this is the part worth reading on its own: it is pure,
// total, allocation-light and has no dependency on the rig's mutable state.
import { Vector3 } from 'three';

export interface FramingBounds {
  min: [number, number, number];
  max: [number, number, number];
}

export interface HalfExtents {
  /** Half the silhouette's width, in world units, along the camera's screen-right axis. */
  halfWidth: number;
  /** Half its height along the camera's screen-up axis. */
  halfHeight: number;
}

/**
 * The bounds AABB's half-extents as PROJECTED onto the camera's own screen axes — the
 * silhouette that is actually drawn, rather than the sphere that circumscribes it.
 *
 * For an axis-aligned box the projected half-extent onto a unit axis `a` is exactly
 * `ex*|a.x| + ey*|a.y| + ez*|a.z|`, so this is the eight-corner answer in closed form,
 * with three vectors allocated instead of eight. An orthographic frustum's scale does
 * not depend on distance, so the camera BASIS alone determines the projection — which is
 * why only the direction from `position` to `target`, and `up`, are needed here.
 */
export function projectedHalfExtents(
  bounds: FramingBounds,
  position: readonly [number, number, number],
  target: readonly [number, number, number],
  up: readonly [number, number, number],
): HalfExtents {
  const forward = new Vector3(
    target[0] - position[0], target[1] - position[1], target[2] - position[2],
  ).normalize();
  const right = new Vector3().crossVectors(forward, new Vector3(up[0], up[1], up[2])).normalize();
  const screenUp = new Vector3().crossVectors(right, forward).normalize();
  const ex = (bounds.max[0] - bounds.min[0]) / 2;
  const ey = (bounds.max[1] - bounds.min[1]) / 2;
  const ez = (bounds.max[2] - bounds.min[2]) / 2;
  const along = (a: Vector3): number =>
    ex * Math.abs(a.x) + ey * Math.abs(a.y) + ez * Math.abs(a.z);
  return { halfWidth: along(right), halfHeight: along(screenUp) };
}

/**
 * The zoom at which a rectangle of these half-extents just fits, with `margin` to spare.
 *
 * The frustum is `top/bottom = ±halfFrustumHeight` and `left/right = ±aspect *
 * halfFrustumHeight` (the rig's `applyAspect`), so the visible world half-height is
 * `halfFrustumHeight/zoom` and the visible half-width `aspect*halfFrustumHeight/zoom`.
 * Each axis therefore gives a zoom bound and the binding one is the smaller — which is a
 * strict generalisation of the sphere form this replaces: with
 * `halfWidth === halfHeight === R` it reduces to `min(1, aspect)/(R*margin)`, exactly
 * what the old `min(zoomH, zoomH*aspect)` computed.
 *
 * Returns `null` when neither axis constrains anything (a degenerate, zero-sized box),
 * so the caller decides what to do rather than receiving an Infinity.
 */
export function zoomForHalfExtents(
  { halfWidth, halfHeight }: HalfExtents,
  aspect: number,
  halfFrustumHeight: number,
  margin: number,
): number | null {
  const byHeight = halfHeight > 0 ? halfFrustumHeight / (halfHeight * margin) : Infinity;
  const byWidth = halfWidth > 0 ? (halfFrustumHeight * aspect) / (halfWidth * margin) : Infinity;
  const zoom = Math.min(byHeight, byWidth);
  return Number.isFinite(zoom) ? zoom : null;
}
