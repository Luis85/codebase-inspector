// Phase 2c. THE CANVAS INPUT PATH, end to end: a real pointer stream on the real
// canvas, through the real picking module, the real city-renderer and the real camera
// rig, observed at the place a user actually sees — the camera handed to `render()`.
//
// That last part is what makes this file worth having. `getCamera()` reports the
// LOGICAL destination by design, so every existing test reads the camera the rig is
// heading for, never the one being drawn. `threeRenderer.render(scene, rig.camera)`
// receives the LIVE camera, so capturing its argument is the only way to assert what is
// actually on screen from outside the rig.
//
// Only THREE.WebGLRenderer is doubled; raycasting, the rig, the scheduler, InstancedMesh
// and Matrix4 are all real, and none of them needs a GPU.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '../mocks/obsidian';
import type { CityRendererEvent, CityRendererPort } from '../../src/visualization/renderer-port';
import { layoutOf, paletteFixture, captureGetContext, stubGetContext } from '../fixtures/renderer-doubles';

const WIDTH = 800;
const HEIGHT = 600;

/** Every camera position `render()` was handed, in order — the DRAWN camera, frame by
 *  frame. Hoisted because `vi.mock`'s factory is hoisted above this file's own imports. */
const drawn = vi.hoisted(() => ({ positions: [] as [number, number, number][] }));

vi.mock('three', async (importOriginal) => {
  const actual = await importOriginal<typeof import('three')>();
  class FakeWebGLRenderer {
    info = { memory: { geometries: 0, textures: 0 }, programs: [], render: { calls: 0 } };
    setClearColor = vi.fn();
    setPixelRatio = vi.fn();
    setSize = vi.fn();
    render = vi.fn((_scene: unknown, camera: { position: { x: number; y: number; z: number } }) => {
      drawn.positions.push([camera.position.x, camera.position.y, camera.position.z]);
    });
    dispose = vi.fn();
    forceContextLoss = vi.fn();
    getContext = vi.fn(() => ({ getExtension: () => null }));
  }
  return { ...actual, WebGLRenderer: FakeWebGLRenderer };
});

function pointerEvent(type: string, x: number, y: number, init: Partial<PointerEvent> = {}): Event {
  const event = new MouseEvent(type, { clientX: x, clientY: y, button: 0, bubbles: true });
  Object.assign(event, { pointerId: 1, pointerType: 'mouse', ...init });
  return event;
}

describe('the canvas input path reaching the camera', () => {
  let port: CityRendererPort;
  let mount: HTMLElement;
  let canvas: HTMLCanvasElement;
  let frames: (() => void)[];
  let restoreGetContext: () => void;
  let events: CityRendererEvent[];

  const runFrame = (): void => { frames.splice(0, frames.length).forEach((f) => { f(); }); };
  const azimuthOf = (p: readonly number[]): number => Math.atan2(p[2]!, p[0]!);

  beforeEach(async () => {
    frames = [];
    events = [];
    drawn.positions = [];
    restoreGetContext = captureGetContext();
    stubGetContext('ok');
    const win = {
      document,
      requestAnimationFrame: (cb: () => void) => { frames.push(cb); return frames.length; },
      cancelAnimationFrame: () => {},
      setTimeout: (fn: () => void, ms: number) => window.setTimeout(fn, ms),
      clearTimeout: (handle: number) => { window.clearTimeout(handle); },
      devicePixelRatio: 1,
      localStorage: { getItem: () => null },
    } as unknown as Window;
    mount = document.body.createDiv();
    const { createCityRenderer } = await import('../../src/visualization/city-renderer');
    port = createCityRenderer(mount, win, (e) => events.push(e));
    canvas = mount.querySelector('canvas')!;
    canvas.getBoundingClientRect = () => ({
      width: WIDTH, height: HEIGHT, left: 0, top: 0,
      right: WIDTH, bottom: HEIGHT, x: 0, y: 0, toJSON: () => ({}),
    });
    port.setColors(paletteFixture());
    port.resize(WIDTH, HEIGHT, 1);
    await port.setLayout(layoutOf('s1', 3), { generation: 1, signal: new AbortController().signal });
    // What CityViewport.applyMotionPreference applies whenever the OS does not ask for
    // reduced motion — i.e. the normal case, and the only one the defect lives in.
    port.setMotion('standard');
    runFrame();
    drawn.positions = [];
  });

  afterEach(() => {
    port.dispose();
    mount.remove();
    restoreGetContext();
  });

  // Phase 2c, I1 (Important). The rig-level test pins the rule; this one pins that the
  // PRODUCTION path actually carries it — `city-renderer.ts`'s `onOrbit`/`onPan`/`onZoom`
  // are the three call sites that know a delta came from picking, and therefore at
  // pointer rate. Without them the rig's `continuous` flag has no production caller at
  // all, which is the defect class this branch has paid for eight times.
  it('I1: a DRAG on the canvas is drawn as it happens, not eased away and snapped', () => {
    canvas.dispatchEvent(pointerEvent('pointerdown', 400, 300));
    // 1 s of dragging: 60 rAF frames, two pointer events each (a 125 Hz mouse), 4 CSS px
    // apiece — the shape picking.ts really delivers, and the shape no tween test has.
    for (let frame = 0; frame < 60; frame += 1) {
      for (let event = 0; event < 2; event += 1) {
        canvas.dispatchEvent(pointerEvent('pointermove', 404 + frame * 8 + event * 4, 300));
      }
      runFrame();
    }
    canvas.dispatchEvent(pointerEvent('pointerup', 884, 300));

    const logical = port.getCamera();
    const last = drawn.positions.at(-1)!;
    // The bookmark and the drawn camera must agree: the drag really moved (so the
    // assertion is not vacuous), and what was drawn is where the bookmark is.
    expect(drawn.positions.length).toBeGreaterThan(30);
    const travelled = Math.abs(azimuthOf(logical.position) - azimuthOf(drawn.positions[0]!));
    expect(travelled).toBeGreaterThan(0.5);
    for (const axis of [0, 1, 2]) expect(last[axis]).toBeCloseTo(logical.position[axis]!, 6);
  });

  it('I1: the drag leaves no tail — nothing is still moving after the pointer stops', () => {
    canvas.dispatchEvent(pointerEvent('pointerdown', 400, 300));
    for (let i = 0; i < 10; i += 1) canvas.dispatchEvent(pointerEvent('pointermove', 410 + i * 6, 300));
    canvas.dispatchEvent(pointerEvent('pointerup', 470, 300));
    runFrame();
    const settled = drawn.positions.length;
    // A tween would keep invalidating for ~12 more frames after the last pointermove.
    runFrame();
    runFrame();
    expect(drawn.positions.length).toBe(settled);
  });

  // Phase 2c, ruling M104 -- THE WHEEL. Two separate faults, both against the same
  // handoff row: `01-core-interactions.md:17` reads
  //   "Wheel over FOCUSED/ENGAGED canvas | Dolly | Bound zoom; let text/list scrolling
  //    remain normal".
  describe('M104: the wheel', () => {
    /** One Chromium/Windows notch: WHEEL_DELTA 120 x the OS "lines to scroll" default of
     *  3 x Chromium's 100/3 px per line = deltaY 100 at deltaMode 0. */
    const notch = (): WheelEvent =>
      new WheelEvent('wheel', { deltaY: 100, deltaMode: 0, cancelable: true, bubbles: true });

    const engage = (): void => {
      canvas.dispatchEvent(pointerEvent('pointerdown', 400, 300));
      canvas.dispatchEvent(pointerEvent('pointerup', 400, 300));
    };

    it('one notch is a usable step, not a 30% leap', () => {
      engage();
      const before = port.getCamera().zoom;
      canvas.dispatchEvent(notch());
      const factor = port.getCamera().zoom / before;
      // WHEEL_ZOOM_RATE 0.0035 gave exp(-100*0.0035) = 0.7047 -- a 29.5% cut per notch,
      // and only 6.8 notches of zoom-out before MIN_ZOOM clamps. A conventional 10% is
      // rate = -ln(0.9)/100 = 0.00105.
      expect(factor).toBeGreaterThan(0.85);
      expect(factor).toBeLessThan(0.95);
    });

    it('does NOT zoom or swallow the scroll on a bare hover', () => {
      // "let text/list scrolling remain normal": the pointer merely crossing the canvas
      // must not eat the leaf's scroll. preventDefault() on an unengaged canvas is what
      // made a scroll over the city stop the pane scrolling at all.
      const before = port.getCamera().zoom;
      const wheel = notch();
      canvas.dispatchEvent(wheel);
      expect(port.getCamera().zoom).toBe(before);
      expect(wheel.defaultPrevented).toBe(false);
    });

    it('DOES zoom, and suppresses the scroll, once the canvas is engaged', () => {
      engage();
      const before = port.getCamera().zoom;
      const wheel = notch();
      canvas.dispatchEvent(wheel);
      expect(port.getCamera().zoom).toBeLessThan(before);
      expect(wheel.defaultPrevented).toBe(true);
    });

    it('counts FOCUS as engagement, so the keyboard route works without a click', () => {
      // The stage is the view's single focusable, named region (spec 4.2); the canvas
      // inside it is aria-hidden and untabbable. Tabbing to the stage must be enough.
      mount.tabIndex = 0;
      mount.focus();
      const before = port.getCamera().zoom;
      canvas.dispatchEvent(notch());
      expect(port.getCamera().zoom).toBeLessThan(before);
    });

    it('disengages when the pointer leaves, so a later stray wheel scrolls the leaf', () => {
      engage();
      canvas.dispatchEvent(pointerEvent('pointerleave', 400, 300));
      mount.blur();
      const before = port.getCamera().zoom;
      const wheel = notch();
      canvas.dispatchEvent(wheel);
      expect(port.getCamera().zoom).toBe(before);
      expect(wheel.defaultPrevented).toBe(false);
    });
  });

  it('I1: nudgeCamera — the DOCK and the keyboard — still tweens, so the fix is a SPLIT', () => {
    const before = port.getCamera().position;
    port.nudgeCamera({ orbit: [0.4, 0] });
    runFrame();
    const first = drawn.positions.at(-1)!;
    const after = port.getCamera().position;
    // A discrete command eases: one frame in, the drawn camera is between the two.
    expect(Math.abs(first[0] - before[0])).toBeGreaterThan(0);
    expect(Math.abs(first[0] - after[0])).toBeGreaterThan(1e-6);
  });
});
