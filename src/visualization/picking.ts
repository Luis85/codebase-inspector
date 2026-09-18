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
const WHEEL_ZOOM_RATE = 0.0035;
const WHEEL_CLAMP = 150;

export interface CanvasPoint { x: number; y: number }

export interface PickingOptions {
  win: Window;
  canvas: HTMLCanvasElement;
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

  const onPointerDown = (event: Event): void => {
    const pointer = event as PointerEvent;
    if (!options.isActive()) return;
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
    if (hovered === null) return;         // nothing was hovered: nothing changed
    hovered = null;
    options.onHover(null, null);          // immediately, not after the dwell
  };

  const onWheel = (event: Event): void => {
    const wheel = event as WheelEvent;
    if (!options.isActive()) return;
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
