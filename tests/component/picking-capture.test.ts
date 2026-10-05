// Gap closure Task 3 (GRA3, M95): an edge drag keeps its pointer (setPointerCapture on
// press, release on up/cancel), and a point outside the canvas never picks or arms a
// hover dwell. These drive the REAL createPicking against a real jsdom canvas with a
// stubbed rect and a `hitTest` spy -- no renderer is needed to pin gesture intent.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Mock } from 'vitest';
// Side-effect import: installs the createEl/createDiv HTMLElement extensions real
// Obsidian provides (tests/mocks/obsidian.ts), which the lint rule steers canvases to.
import '../mocks/obsidian';
import { createPicking } from '../../src/visualization/picking';
import type { Picking, PickingOptions } from '../../src/visualization/picking';

const SIZE = 100;
const LOT = 'repo\0file\0src/a.ts';

function pointerEvent(type: string, x: number, y: number, pointerId = 1): Event {
  const event = new MouseEvent(type, { clientX: x, clientY: y, button: 0, bubbles: true });
  Object.assign(event, { pointerId, pointerType: 'mouse' });
  return event;
}

describe('picking pointer capture and canvas bounds', () => {
  let canvas: HTMLCanvasElement;
  // Held as plain fields, not read back off the canvas: a method read off an object is
  // an unbound-method lint error, and these are the spies the assertions need.
  let setCapture: Mock<(id: number) => void>;
  let releaseCapture: Mock<(id: number) => void>;
  let picking: Picking;
  let hitTest: Mock<PickingOptions['hitTest']>;
  let onPick: Mock<PickingOptions['onPick']>;
  let onHover: Mock<PickingOptions['onHover']>;
  let onOrbit: Mock<PickingOptions['onOrbit']>;

  interface CaptureStubs { held?: boolean; setThrows?: boolean }

  function mount(withCapture: boolean, stubs: CaptureStubs = {}): void {
    canvas = window.document.body.createEl('canvas');
    canvas.getBoundingClientRect = () => ({
      left: 0, top: 0, right: SIZE, bottom: SIZE, width: SIZE, height: SIZE, x: 0, y: 0,
      toJSON: () => ({}),
    });
    if (withCapture) {
      setCapture = vi.fn<(id: number) => void>(() => {
        if (stubs.setThrows) throw new DOMException('no such pointer', 'NotFoundError');
      });
      releaseCapture = vi.fn<(id: number) => void>();
      Object.assign(canvas, {
        setPointerCapture: setCapture,
        releasePointerCapture: releaseCapture,
        hasPointerCapture: vi.fn(() => stubs.held ?? true),
      });
    }
    hitTest = vi.fn<PickingOptions['hitTest']>(() => LOT);
    onPick = vi.fn<PickingOptions['onPick']>();
    onHover = vi.fn<PickingOptions['onHover']>();
    onOrbit = vi.fn<PickingOptions['onOrbit']>();
    picking = createPicking({
      win: window, canvas, hitTest, onPick, onHover,
      onOrbit, onPan: () => {}, onZoom: () => {}, isActive: () => true,
    });
  }

  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => {
    picking.dispose();
    canvas.remove();
    vi.useRealTimers();
  });

  it('(a) pointerdown captures the pointer', () => {
    mount(true);
    canvas.dispatchEvent(pointerEvent('pointerdown', 50, 50));
    expect(setCapture).toHaveBeenCalledWith(1);
  });

  it('(b) pointerup and pointercancel release the captured pointer', () => {
    mount(true);
    canvas.dispatchEvent(pointerEvent('pointerdown', 50, 50));
    canvas.dispatchEvent(pointerEvent('pointerup', 50, 50));
    expect(releaseCapture).toHaveBeenCalledWith(1);

    releaseCapture.mockClear();
    canvas.dispatchEvent(pointerEvent('pointerdown', 50, 50, 7));
    canvas.dispatchEvent(pointerEvent('pointercancel', 50, 50, 7));
    expect(releaseCapture).toHaveBeenCalledWith(7);
  });

  it('(c) a release just past the canvas edge picks nothing; one inside it picks', () => {
    mount(true);
    canvas.dispatchEvent(pointerEvent('pointerdown', 98, 50));
    canvas.dispatchEvent(pointerEvent('pointerup', 102, 50));
    expect(hitTest).not.toHaveBeenCalled();
    expect(onPick).not.toHaveBeenCalled();

    // Positive control: the same short click, wholly inside the canvas, still picks.
    canvas.dispatchEvent(pointerEvent('pointerdown', 95, 50));
    canvas.dispatchEvent(pointerEvent('pointerup', 97, 50));
    expect(hitTest).toHaveBeenCalledTimes(1);
    expect(onPick).toHaveBeenCalledWith(LOT);
  });

  it('(d) a buttonless move outside the canvas arms no hover dwell', () => {
    mount(true);
    canvas.dispatchEvent(pointerEvent('pointermove', 130, 50));
    vi.advanceTimersByTime(1000);
    expect(hitTest).not.toHaveBeenCalled();
    expect(onHover).not.toHaveBeenCalled();

    // Positive control: the same move inside the canvas does dwell and raycast once.
    canvas.dispatchEvent(pointerEvent('pointermove', 50, 50));
    vi.advanceTimersByTime(1000);
    expect(hitTest).toHaveBeenCalledTimes(1);
    expect(onHover).toHaveBeenCalledTimes(1);
  });

  it('(e) without pointer-capture support a click still picks and nothing throws', () => {
    mount(false);
    expect('setPointerCapture' in canvas).toBe(false);
    expect(() => {
      canvas.dispatchEvent(pointerEvent('pointerdown', 50, 50));
      canvas.dispatchEvent(pointerEvent('pointerup', 50, 50));
    }).not.toThrow();
    expect(onPick).toHaveBeenCalledWith(LOT);
  });

  // Final review RF3. A release is issued only for a pointer the canvas still holds.
  it('(f) a pointer the canvas no longer holds is not released', () => {
    mount(true, { held: false });
    canvas.dispatchEvent(pointerEvent('pointerdown', 50, 50));
    canvas.dispatchEvent(pointerEvent('pointerup', 50, 50));
    expect(setCapture).toHaveBeenCalledWith(1);
    expect(releaseCapture).not.toHaveBeenCalled();
    expect(onPick).toHaveBeenCalledWith(LOT);   // the gesture itself still completed
  });

  // The document-level pointerup is what ends a gesture whose release lands outside the canvas
  // when capture is unavailable; the point it reports is outside, so nothing picks.
  it('(g) a press inside and a release on document.body outside the canvas, with no capture support, picks nothing', () => {
    mount(false);
    canvas.dispatchEvent(pointerEvent('pointerdown', 98, 50));
    window.document.body.dispatchEvent(pointerEvent('pointerup', 102, 50));
    expect(hitTest).not.toHaveBeenCalled();
    expect(onPick).not.toHaveBeenCalled();

    // The gesture ended: a later buttonless move over the canvas arms hover, not a drag.
    canvas.dispatchEvent(pointerEvent('pointermove', 50, 50));
    expect(onOrbit).not.toHaveBeenCalled();

    // Positive control: the same press and a release on the body INSIDE the canvas's box picks.
    canvas.dispatchEvent(pointerEvent('pointerdown', 95, 50));
    window.document.body.dispatchEvent(pointerEvent('pointerup', 97, 50));
    expect(onPick).toHaveBeenCalledWith(LOT);
  });

  it('(h) a setPointerCapture that throws still starts the gesture: a drag orbits and a click picks', () => {
    mount(true, { setThrows: true });
    expect(() => { canvas.dispatchEvent(pointerEvent('pointerdown', 50, 50)); }).not.toThrow();
    canvas.dispatchEvent(pointerEvent('pointermove', 60, 50));
    expect(onOrbit).toHaveBeenCalledWith(10, 0);
    canvas.dispatchEvent(pointerEvent('pointerup', 60, 50));

    canvas.dispatchEvent(pointerEvent('pointerdown', 50, 50));
    canvas.dispatchEvent(pointerEvent('pointerup', 50, 50));
    expect(onPick).toHaveBeenCalledWith(LOT);
  });
});
