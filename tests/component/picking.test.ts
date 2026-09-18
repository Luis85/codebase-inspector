// Task 10 step 3. The instanceId -> EntityId map is the whole point: an off-by-one
// here selects a NEIGHBOURING building, which looks entirely plausible and is wrong.
// So the screen positions below are computed by projecting known lot centres through
// a camera rig built exactly as the renderer builds its own (same bounds, same
// viewport, no nudges) — a wrong map picks the neighbour and the test says so.
//
// Only THREE.WebGLRenderer is doubled: raycasting, InstancedMesh, Matrix4 and the
// camera are all real, and none of them needs a GPU. jsdom's getContext() returns
// null for every type, so it is stubbed here too — otherwise the renderer's own
// WebGL2 pre-check would (correctly) report `unavailable{unsupported}` first.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MockInstance } from 'vitest';
// Side-effect import: installs the createDiv/setCssStyles prototype extensions real
// Obsidian patches onto HTMLElement (tests/mocks/obsidian.ts), which the renderer's
// label overlay builds its DOM through.
import '../mocks/obsidian';
import { Raycaster, Vector3 } from 'three';
import { createCameraRig } from '../../src/visualization/camera-rig';
import type { CityPalette, CityRendererEvent, CityRendererPort, EntityId } from '../../src/visualization/renderer-port';
import type { LayoutResult } from '../../src/domain/layout/types';
import { CATEGORY_IDS } from '../../src/domain/classify';
import { captureGetContext, stubGetContext } from '../fixtures/renderer-doubles';

// Declared INSIDE the factory: vi.mock is hoisted above this file's own `three`
// import, so a top-level class would not be initialised yet when the factory runs.
vi.mock('three', async (importOriginal) => {
  const actual = await importOriginal<typeof import('three')>();
  class FakeWebGLRenderer {
    info = { memory: { geometries: 0, textures: 0 }, programs: [], render: { calls: 0 } };
    setClearColor = vi.fn();
    setPixelRatio = vi.fn();
    setSize = vi.fn();
    render = vi.fn();
    dispose = vi.fn();
    forceContextLoss = vi.fn();
    getContext = vi.fn(() => ({ getExtension: () => null }));
  }
  return { ...actual, WebGLRenderer: FakeWebGLRenderer };
});

const WIDTH = 800;
const HEIGHT = 600;
const RECT_LEFT = 50;
const RECT_TOP = 20;

const ID = (path: string): EntityId => `repo\0file\0${path}`;
const DIR = 'repo\0directory\0src/domain';

function layoutFixture(): LayoutResult {
  const at = (path: string, x: number): LayoutResult['lots'][number] => ({
    entityId: ID(path), directoryId: DIR,
    center: [x, 1, 0], dimensions: [2, 2, 2],
    colorKey: CATEGORY_IDS[0], metricState: 'measured',
  });
  return {
    snapshotId: 's1', layoutVersion: '1',
    lots: [at('src/domain/model.ts', -6), at('src/domain/layout.ts', 0), at('src/domain/scale.ts', 6)],
    districts: [{
      directoryId: DIR, parentId: null, name: 'domain', depth: 0,
      center: [0, 0, 0], extent: [24, 12], labelAnchor: [0, 0.2, 0], aggregated: false,
    }],
    bounds: { min: [-12, 0, -6], max: [12, 2, 6] },
    scale: { metricId: 'physical-lines', name: 'Physical lines', cap: 1000, unit: 'lines', clampedCount: 0 },
  };
}

function paletteFixture(): CityPalette {
  const categories = Object.fromEntries(CATEGORY_IDS.map((id) => [id, '#4c8bf5'])) as CityPalette['categories'];
  return {
    background: '#1e1e1e', districtSurface: '#2a2a2a', districtBorder: '#3a3a3a',
    labelText: '#dddddd', selection: '#ffb020', unavailable: '#808080', categories,
  };
}

/** The screen point, in CLIENT coordinates, of a world position — using a rig built
 *  the same way the renderer builds its own. */
function screenOf(world: [number, number, number]): { x: number; y: number } {
  const rig = createCameraRig({ bounds: layoutFixture().bounds, onChanged: () => {} });
  rig.setViewportSize(WIDTH, HEIGHT);
  const v = new Vector3(...world).project(rig.camera);
  return {
    x: RECT_LEFT + ((v.x + 1) / 2) * WIDTH,
    y: RECT_TOP + ((1 - v.y) / 2) * HEIGHT,
  };
}

const lotScreenPosition = (path: string): { x: number; y: number } => {
  const lot = layoutFixture().lots.find((l) => l.entityId === ID(path));
  return screenOf(lot!.center);
};
const districtGroundPosition = (): { x: number; y: number } => screenOf([0, 0, 5]);

function pointerEvent(type: string, at: { x: number; y: number }, button = 0): Event {
  const event = new MouseEvent(type, { clientX: at.x, clientY: at.y, button, bubbles: true });
  Object.assign(event, { pointerId: 1, pointerType: 'mouse' });
  return event;
}

describe('picking', () => {
  let events: CityRendererEvent[];
  let port: CityRendererPort;
  let mount: HTMLElement;
  let canvas: HTMLCanvasElement;
  let frames: (() => void)[];
  let restoreGetContext: () => void;
  let raycastSpy: MockInstance<Raycaster['intersectObjects']>;

  const runFrames = (): void => {
    const due = frames.splice(0, frames.length);
    for (const f of due) f();
  };

  beforeEach(async () => {
    events = [];
    frames = [];
    restoreGetContext = captureGetContext();
    stubGetContext('ok');
    raycastSpy = vi.spyOn(Raycaster.prototype, 'intersectObjects');

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
      width: WIDTH, height: HEIGHT, left: RECT_LEFT, top: RECT_TOP,
      right: RECT_LEFT + WIDTH, bottom: RECT_TOP + HEIGHT, x: RECT_LEFT, y: RECT_TOP, toJSON: () => ({}),
    });
    port.setColors(paletteFixture());
    port.resize(WIDTH, HEIGHT, 1);
    await port.setLayout(layoutFixture(), { generation: 1, signal: new AbortController().signal });
    runFrames();
    raycastSpy.mockClear();
    // Installed only now: buildCity yields through win.setTimeout on purpose (the
    // task-S spike's 160 ms click-handler violation), so faking timers before the
    // setup above would deadlock the build it is waiting on.
    vi.useFakeTimers();
    events.length = 0;     // construction and the first fit are setup, not assertions
  });

  afterEach(() => {
    port.dispose();
    mount.remove();
    restoreGetContext();
    raycastSpy.mockRestore();
    vi.useRealTimers();
  });

  const picked = (): CityRendererEvent[] => events.filter((e) => e.type === 'entity-picked');
  const hovers = (): CityRendererEvent[] => events.filter((e) => e.type === 'hover-changed');

  function clickAt(at: { x: number; y: number }): void {
    canvas.dispatchEvent(pointerEvent('pointerdown', at));
    canvas.dispatchEvent(pointerEvent('pointerup', at));
  }

  it('selects the CORRECT file via the batch-and-instance to entity map', () => {
    clickAt(lotScreenPosition('src/domain/layout.ts'));
    expect(events).toContainEqual({
      type: 'entity-picked', entityId: 'repo\0file\0src/domain/layout.ts', snapshotId: 's1',
    });
  });

  it('picks each of the three neighbours distinctly, so an off-by-one cannot hide', () => {
    for (const path of ['src/domain/model.ts', 'src/domain/layout.ts', 'src/domain/scale.ts']) {
      events = [];
      clickAt(lotScreenPosition(path));
      expect(picked()).toEqual([{ type: 'entity-picked', entityId: ID(path), snapshotId: 's1' }]);
    }
  });

  it('raycasts ONLY against file lots', () => {
    // Never labels, ground planes, district borders or overlays (spec 5.2).
    clickAt(districtGroundPosition());
    expect(picked()).toHaveLength(0);
  });

  it('is a no-op on empty space', () => {
    clickAt({ x: RECT_LEFT + 4, y: RECT_TOP + 4 });
    expect(picked()).toHaveLength(0);
  });

  it('does not select on release after a drag beyond 5 CSS PIXELS', () => {
    const start = lotScreenPosition('src/domain/layout.ts');
    canvas.dispatchEvent(pointerEvent('pointerdown', start));
    canvas.dispatchEvent(pointerEvent('pointermove', { x: start.x + 7, y: start.y }));
    canvas.dispatchEvent(pointerEvent('pointerup', { x: start.x + 7, y: start.y }));
    expect(picked()).toHaveLength(0);
  });

  it('DOES select on release within 5 CSS pixels', () => {
    const start = lotScreenPosition('src/domain/layout.ts');
    canvas.dispatchEvent(pointerEvent('pointerdown', start));
    canvas.dispatchEvent(pointerEvent('pointermove', { x: start.x + 3, y: start.y }));
    canvas.dispatchEvent(pointerEvent('pointerup', { x: start.x + 3, y: start.y }));
    expect(picked()).toHaveLength(1);
  });

  it('measures the drag threshold in CSS pixels, not device pixels', () => {
    // 4 CSS px is 8 device px at ratio 2; only the CSS figure may be compared.
    port.resize(WIDTH, HEIGHT, 2);
    const start = lotScreenPosition('src/domain/layout.ts');
    canvas.dispatchEvent(pointerEvent('pointerdown', start));
    canvas.dispatchEvent(pointerEvent('pointermove', { x: start.x + 4, y: start.y }));
    canvas.dispatchEvent(pointerEvent('pointerup', { x: start.x + 4, y: start.y }));
    expect(picked()).toHaveLength(1);
  });

  it('emits hover-changed only AFTER the 200 ms dwell', () => {
    canvas.dispatchEvent(pointerEvent('pointermove', lotScreenPosition('src/domain/layout.ts')));
    vi.advanceTimersByTime(199);
    expect(hovers()).toHaveLength(0);
    vi.advanceTimersByTime(2);
    const hover = hovers()[0];
    expect(hover?.type).toBe('hover-changed');
    const detail = hover as { entityId: string; snapshotId: string; position: { x: number; y: number } };
    expect(typeof detail.entityId).toBe('string');
    expect(detail.snapshotId).toBe('s1');
    expect(typeof detail.position.x).toBe('number');
    expect(typeof detail.position.y).toBe('number');
  });

  it('RAYCASTS ONLY WHEN THE DWELL FIRES, never on every pointermove', () => {
    for (let i = 0; i < 40; i++) {
      canvas.dispatchEvent(pointerEvent('pointermove', { x: RECT_LEFT + 100 + i, y: RECT_TOP + 100 }));
    }
    expect(raycastSpy).not.toHaveBeenCalled();
    vi.advanceTimersByTime(250);
    expect(raycastSpy).toHaveBeenCalledTimes(1);
  });

  it('emits a null entityId IMMEDIATELY on leave', () => {
    canvas.dispatchEvent(pointerEvent('pointermove', lotScreenPosition('src/domain/layout.ts')));
    vi.advanceTimersByTime(250);
    canvas.dispatchEvent(pointerEvent('pointerleave', { x: 0, y: 0 }));
    expect(hovers().at(-1)).toMatchObject({ entityId: null, position: null });
  });

  it('does not re-arm the dwell after leaving, so no hover fires over nothing', () => {
    canvas.dispatchEvent(pointerEvent('pointermove', lotScreenPosition('src/domain/layout.ts')));
    canvas.dispatchEvent(pointerEvent('pointerleave', { x: 0, y: 0 }));
    const after = hovers().length;
    vi.advanceTimersByTime(500);
    expect(hovers()).toHaveLength(after);
  });

  it('anchors the hover position canvas-relative, for tooltip placement', () => {
    const at = lotScreenPosition('src/domain/layout.ts');
    canvas.dispatchEvent(pointerEvent('pointermove', at));
    vi.advanceTimersByTime(250);
    const hover = hovers().at(-1) as { position: { x: number; y: number } };
    expect(hover.position.x).toBeCloseTo(at.x - RECT_LEFT, 6);
    expect(hover.position.y).toBeCloseTo(at.y - RECT_TOP, 6);
  });

  it('lets NO key event cross the port', () => {
    expect(typeof (port as unknown as Record<string, unknown>).onKeyDown).toBe('undefined');
    canvas.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(events).toHaveLength(0);
  });

  it('does not select on click while the view is paused', () => {
    port.pause();
    clickAt(lotScreenPosition('src/domain/layout.ts'));
    expect(picked()).toHaveLength(0);
    port.resume();
    clickAt(lotScreenPosition('src/domain/layout.ts'));
    expect(picked()).toHaveLength(1);
  });

  it('does not hover while the view is paused', () => {
    port.pause();
    canvas.dispatchEvent(pointerEvent('pointermove', lotScreenPosition('src/domain/layout.ts')));
    vi.advanceTimersByTime(500);
    expect(hovers()).toHaveLength(0);
  });

  it('stops picking after dispose, with no listener left behind', () => {
    port.dispose();
    clickAt(lotScreenPosition('src/domain/layout.ts'));
    expect(picked()).toHaveLength(0);
  });
});
