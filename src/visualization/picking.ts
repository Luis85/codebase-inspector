// Pointer intent: what a press, a drag and a hover MEAN. It owns the 200 ms hover
// dwell timer and the 5 CSS PIXEL drag threshold, and it raycasts ONLY when the dwell
// fires — never on every pointermove, which is the difference between a hover that
// costs nothing while the pointer crosses the city and one that raycasts forty times.
//
// CSS pixels, never device pixels: clientX/clientY and getBoundingClientRect() are
// already CSS px, so devicePixelRatio is never read here at all. At ratio 2 a 4 CSS px
// drag is 8 device px, and comparing the device figure against 5 would turn ordinary
// clicks into drags on every HiDPI screen.
//
// NO key event crosses this boundary (spec 4.2: the VIEW owns focus, keys and
// accessible naming). There is no keydown listener in this file and no onKeyDown on
// the port. `win` is injected, never a bare global (acceptance criterion 10).
import type { EntityId } from './renderer-port';

export const DRAG_THRESHOLD_CSS_PX = 5;
export const HOVER_DWELL_MS = 200;
/** Phase 2c, ruling M104. One Chromium/Windows wheel notch is `deltaMode 0, deltaY 100`
 *  (WHEEL_DELTA 120 x the OS "lines to scroll" default of 3 x Chromium's 100/3 px per
 *  line). At the previous 0.0035 that was `exp(-100 * 0.0035) = 0.7047` -- a 29.5% cut
 *  PER NOTCH, and 40.8% at WHEEL_CLAMP, which also left only ~6.8 notches of zoom-out
 *  after a fit before MIN_ZOOM clamped. 0.00105 is `-ln(0.9)/100`: a conventional 10%
 *  per notch, chosen because it is the round number the ratio is derived FROM rather
 *  than a tuned constant. WHEEL_CLAMP is unchanged, so a flung trackpad still cannot
 *  teleport the camera. */
const WHEEL_ZOOM_RATE = 0.00105;
const WHEEL_CLAMP = 150;

export interface CanvasPoint { x: number; y: number }

export interface PickingOptions {
  win: Window;
  canvas: HTMLCanvasElement;
  /** The view's single focusable, named region (spec 4.2) — the element the canvas is
   *  mounted into. Read ONLY to answer "is this canvas focused or engaged", which is the
   *  gate the handoff puts on the wheel; no listener is attached to it and nothing about
   *  focus is changed from here (the VIEW owns focus). */
  focusRoot: HTMLElement;
  /** Canvas-relative point -> the entity under it, or null. The only raycast. */
  hitTest: (point: CanvasPoint) => EntityId | null;
  onPick: (entityId: EntityId) => void;
  onHover: (entityId: EntityId | null, position: CanvasPoint | null) => void;
  onOrbit: (dxCssPx: number, dyCssPx: number) => void;
  onPan: (dxCssPx: number, dyCssPx: number) => void;
  onZoom: (factor: number) => void;
  /** False while paused, context-lost or disposed: no picking, no hover, no camera. */
  isActive: () => boolean;
}

export interface Picking { dispose(): void }

interface Gesture { startX: number; startY: number; lastX: number; lastY: number; button: number; dragged: boolean }

export function createPicking(options: PickingOptions): Picking {
  const { win, canvas } = options;
  let gesture: Gesture | null = null;
  /** Phase 2c, ruling M104. The handoff says "Wheel over FOCUSED/ENGAGED canvas | Dolly |
   *  Bound zoom; LET TEXT/LIST SCROLLING REMAIN NORMAL"
   *  (docs/concept/design/interactions/01-core-interactions.md:17). The wheel handler
   *  used to fire on bare hover AND `preventDefault()` unconditionally, so the pointer
   *  merely crossing the canvas on its way somewhere else ate the leaf's scroll entirely.
   *  Engagement is a press inside the canvas, and it ends when the pointer leaves —
   *  focus inside the view's own region counts too, so tabbing to the stage and using
   *  the wheel works without a click. */
  let pressedHere = false;
  let dwell: ReturnType<Window['setTimeout']> | null = null;
  let hovered: EntityId | null = null;
  let disposed = false;

  function toCanvas(event: { clientX: number; clientY: number }): CanvasPoint {
    const rect = canvas.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  function clearDwell(): void {
    if (dwell !== null) win.clearTimeout(dwell);
    dwell = null;
  }

  function armDwell(point: CanvasPoint): void {
    clearDwell();
    dwell = win.setTimeout(() => {
      dwell = null;
      if (disposed || !options.isActive()) return;
      const entity = options.hitTest(point);      // the ONLY hover raycast
      if (entity === hovered) return;             // hover-CHANGED, not hover-repeated
      hovered = entity;
      options.onHover(entity, entity === null ? null : point);
    }, HOVER_DWELL_MS);
  }

  function endGesture(): void { gesture = null; }

  /** Focused OR engaged, per the handoff row above. A live gesture counts: a drag that
   *  began on the canvas is as engaged as anything can be. */
  function isEngaged(): boolean {
    if (gesture !== null || pressedHere) return true;
    const active = win.document.activeElement;
    return active !== null && options.focusRoot.contains(active);
  }

  const onPointerDown = (event: Event): void => {
    const pointer = event as PointerEvent;
    if (!options.isActive()) return;
    pressedHere = true;
    clearDwell();
    gesture = {
      startX: pointer.clientX, startY: pointer.clientY,
      lastX: pointer.clientX, lastY: pointer.clientY,
      button: pointer.button, dragged: false,
    };
  };

  const onPointerMove = (event: Event): void => {
    const pointer = event as PointerEvent;
    if (!options.isActive()) return;
    if (!gesture) {
      // Hover intent only: arm the dwell and do NOTHING else. No raycast here.
      armDwell(toCanvas(pointer));
      return;
    }
    const dx = pointer.clientX - gesture.lastX;
    const dy = pointer.clientY - gesture.lastY;
    gesture.lastX = pointer.clientX;
    gesture.lastY = pointer.clientY;
    if (Math.hypot(pointer.clientX - gesture.startX, pointer.clientY - gesture.startY) > DRAG_THRESHOLD_CSS_PX) {
      gesture.dragged = true;
    }
    if (dx === 0 && dy === 0) return;
    // Secondary/middle button, or any modifier, pans; primary orbits. Every one of
    // these has a single-pointer alternative in CameraControls (WCAG 2.5.7) — this is
    // the dragging gesture those alternatives exist for, not the only way in.
    if (gesture.button !== 0 || pointer.shiftKey || pointer.ctrlKey || pointer.metaKey) {
      options.onPan(dx, dy);
    } else {
      options.onOrbit(dx, dy);
    }
  };

  const onPointerUp = (event: Event): void => {
    const pointer = event as PointerEvent;
    const active = gesture;
    if (!active) return;
    endGesture();
    if (!options.isActive()) return;
    if (active.dragged || active.button !== 0) return;
    if (Math.hypot(pointer.clientX - active.startX, pointer.clientY - active.startY) > DRAG_THRESHOLD_CSS_PX) return;
    const entity = options.hitTest(toCanvas(pointer));
    if (entity !== null) options.onPick(entity);    // empty space is a deliberate no-op
  };

  const onPointerCancel = (): void => { endGesture(); };

  const onPointerLeave = (): void => {
    clearDwell();
    endGesture();
    pressedHere = false;
    if (hovered === null) return;         // nothing was hovered: nothing changed
    hovered = null;
    options.onHover(null, null);          // immediately, not after the dwell
  };

  const onWheel = (event: Event): void => {
    const wheel = event as WheelEvent;
    if (!options.isActive()) return;
    // The gate comes BEFORE preventDefault, which is the whole point: an unengaged
    // canvas must let the event through so the leaf scrolls normally.
    if (!isEngaged()) return;
    wheel.preventDefault();
    const unit = wheel.deltaMode === 1 ? 16 : wheel.deltaMode === 2 ? canvas.getBoundingClientRect().height : 1;
    const delta = Math.min(WHEEL_CLAMP, Math.max(-WHEEL_CLAMP, wheel.deltaY * unit));
    options.onZoom(Math.exp(-delta * WHEEL_ZOOM_RATE));
  };

  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('pointercancel', onPointerCancel);
  canvas.addEventListener('pointerleave', onPointerLeave);
  canvas.addEventListener('wheel', onWheel, { passive: false });
  // A release outside the canvas still ends the gesture. The canvas listener runs
  // first and clears `gesture`, so this one is a no-op for an ordinary in-canvas
  // release rather than a second handler for it.
  win.document.addEventListener('pointerup', onPointerUp);

  return {
    dispose(): void {
      if (disposed) return;
      disposed = true;
      clearDwell();
      hovered = null;
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('pointercancel', onPointerCancel);
      canvas.removeEventListener('pointerleave', onPointerLeave);
      canvas.removeEventListener('wheel', onWheel);
      win.document.removeEventListener('pointerup', onPointerUp);
    },
  };
}
