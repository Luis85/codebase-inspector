// Task 10 step 7. THE PORT NEVER THROWS (spec 4.2).
//
// Geometry accounting is real here, not asserted against a stub: the `three` double
// below wraps the geometry classes this renderer constructs so that
// `renderer.info.memory.geometries` is a LIVE count of undisposed geometries, and
// BufferGeometry.prototype.dispose decrements it. It also collects the InstancedMesh
// and LineSegments instances, which is how these tests reach the live scene graph
// without the port growing an accessor it does not owe anyone.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Mock } from 'vitest';
// Side-effect import: installs the createDiv/setCssStyles prototype extensions real
// Obsidian patches onto HTMLElement before any plugin loads (tests/mocks/obsidian.ts),
// which the renderer's label overlay uses to build its DOM in the right document.
import '../mocks/obsidian';
import type { CityPalette, CityRendererEvent, CityRendererPort } from '../../src/visualization/renderer-port';
import { CATEGORY_IDS } from '../../src/domain/classify';
import {
  HEIGHT, ID, WIDTH, captureGetContext, layoutOf, makeWinDouble, paletteFixture, stubGetContext,
} from '../fixtures/renderer-doubles';

interface FakeRenderer {
  render: Mock; dispose: Mock; forceContextLoss: Mock; setPixelRatio: Mock;
  setSize: Mock; setClearColor: Mock;
  info: { memory: { geometries: number; textures: number } };
}

const probe = vi.hoisted(() => ({
  geometries: new Set<object>(),
  meshes: [] as object[],
  lines: [] as object[],
  renderers: [] as FakeRenderer[],
  failInit: false,
}));

vi.mock('three', async (importOriginal) => {
  const actual = await importOriginal<typeof import('three')>();
  // Read and replaced through an index, not a method reference: an unbound method
  // reference is exactly what @typescript-eslint/unbound-method exists to stop.
  const geometryProto = actual.BufferGeometry.prototype as unknown as { dispose: () => void };
  const baseDispose = geometryProto.dispose;
  geometryProto.dispose = function untracked(this: object): void {
    probe.geometries.delete(this);
    baseDispose.call(this);
  };
  type Ctor = new (...args: never[]) => object;
  /** Wraps one of `actual`'s classes so every instance it constructs is registered,
   *  and BufferGeometry.prototype.dispose above unregisters it again. */
  const track = (name: keyof typeof actual, into: Set<object> | object[]): Ctor =>
    class extends (actual[name] as Ctor) {
      constructor(...args: never[]) {
        super(...args);
        if (Array.isArray(into)) into.push(this); else into.add(this);
      }
    };
  class FakeWebGLRenderer {
    info = {
      memory: { get geometries(): number { return probe.geometries.size; }, textures: 0 },
      programs: [], render: { calls: 0 },
    };
    setClearColor = vi.fn();
    setPixelRatio = vi.fn();
    setSize = vi.fn();
    render = vi.fn();
    dispose = vi.fn();
    forceContextLoss = vi.fn();
    getContext = vi.fn(() => ({ getExtension: () => null }));
    constructor() {
      if (probe.failInit) throw new Error('WebGL initialization failed');
      probe.renderers.push(this);
    }
  }
  return {
    ...actual,
    BoxGeometry: track('BoxGeometry', probe.geometries),
    EdgesGeometry: track('EdgesGeometry', probe.geometries),
    BufferGeometry: track('BufferGeometry', probe.geometries),
    InstancedMesh: track('InstancedMesh', probe.meshes),
    LineSegments: track('LineSegments', probe.lines),
    WebGLRenderer: FakeWebGLRenderer,
  };
});

interface Harness {
  port: CityRendererPort;
  mount: HTMLElement;
  events: CityRendererEvent[];
  renderer: FakeRenderer;
  cancelSpy: ReturnType<typeof vi.fn>;
  resizeObserver: ReturnType<typeof vi.fn>;
  runFrames: () => void;
}

let restoreGetContext: () => void;

async function makeHarness(): Promise<Harness> {
  const { win, runFrames, cancelSpy, resizeObserver } = makeWinDouble();
  const events: CityRendererEvent[] = [];
  const mount = document.body.createDiv();
  const { createCityRenderer } = await import('../../src/visualization/city-renderer');
  const port = createCityRenderer(mount, win, (e) => events.push(e));
  return {
    port, mount, events, cancelSpy, resizeObserver, runFrames,
    renderer: probe.renderers[probe.renderers.length - 1] as FakeRenderer,
  };
}

beforeEach(() => {
  restoreGetContext = captureGetContext();
  probe.geometries.clear();
  probe.meshes.length = 0;
  probe.lines.length = 0;
  probe.renderers.length = 0;
  probe.failInit = false;
  stubGetContext('ok');
});

afterEach(() => {
  restoreGetContext();
  document.body.replaceChildren();
});

// The live scene graph, reached through the `three` double above rather than through
// an accessor the port does not owe anyone. buildCity constructs its meshes in a fixed
// order: measured lots, unavailable markers, district slabs; then the district borders
// and the selection outline as LineSegments.
interface InstancedLike {
  instanceColor: { array: ArrayLike<number> } | null;
  instanceMatrix: { array: ArrayLike<number> };
  material: { color?: { getHex: () => number } };
}
interface LineLike { visible: boolean; material: { color?: { getHex: () => number } } }

function city(): { buildings: InstancedLike; markers: InstancedLike; slabs: InstancedLike;
                   borders: LineLike; selection: LineLike } {
  const [buildings, markers, slabs] = probe.meshes.slice(-3) as unknown as InstancedLike[];
  const [borders, selection] = probe.lines.slice(-2) as unknown as LineLike[];
  return { buildings: buildings!, markers: markers!, slabs: slabs!, borders: borders!, selection: selection! };
}

const hexOf = (holder: { material: { color?: { getHex: () => number } } }): number =>
  holder.material.color?.getHex() ?? -1;

function sceneColours(): Record<string, number> {
  const c = city();
  return {
    slab: hexOf(c.slabs), border: hexOf(c.borders),
    marker: hexOf(c.markers), selection: hexOf(c.selection),
  };
}

function labelOverlay(mount: HTMLElement): HTMLElement {
  return mount.querySelector<HTMLElement>('.ci-city-labels')!;
}

describe('the port never throws', () => {
  it('reports WebGL2 unavailability through onEvent, not by throwing', async () => {
    stubGetContext('null');
    const h = await makeHarness();
    expect(h.events).toContainEqual({ type: 'unavailable', reason: 'unsupported' });
  });

  it('reports context-creation failure through onEvent', async () => {
    stubGetContext('throw');
    const h = await makeHarness();
    expect(h.events).toContainEqual({ type: 'unavailable', reason: 'unsupported' });
  });

  it('reports initialization failure through onEvent', async () => {
    probe.failInit = true;
    const h = await makeHarness();
    expect(h.events).toContainEqual({ type: 'unavailable', reason: 'initialization-failed' });
    // Distinguishable from `unsupported`, which is the whole point: the view shows a
    // different notice and deliberately does not retry this one.
    expect(h.events).not.toContainEqual({ type: 'unavailable', reason: 'unsupported' });
  });

  it('returns a usable port even when unavailable, so the view always has a surface', async () => {
    stubGetContext('null');
    const h = await makeHarness();
    expect(() => {
      h.port.setColors(paletteFixture());
      h.port.setSelection(ID('src/f0.ts'));
      h.port.setFilter(null);
      h.port.setLabels(true);
      h.port.resize(WIDTH, HEIGHT, 1);
      h.port.setCameraMode('top');
      h.port.pause(); h.port.resume();
      h.port.fit(); h.port.focus(ID('src/f0.ts'));
      h.port.debugLoseContext();
      h.port.dispose();
    }).not.toThrow();
    const bookmark = h.port.getCamera();
    h.port.setCamera({ ...bookmark, zoom: 3 });
    expect(h.port.getCamera().zoom).toBe(3);
    await expect(h.port.setLayout(layoutOf('s', 1), { generation: 1, signal: new AbortController().signal }))
      .resolves.toBeUndefined();
  });

  it('RESOLVES an aborted setLayout without applying, and never rejects', async () => {
    const h = await makeHarness();
    h.port.resize(WIDTH, HEIGHT, 1);
    h.runFrames();
    h.renderer.render.mockClear();
    const c = new AbortController();
    const p = h.port.setLayout(layoutOf('s1', 50), { generation: 1, signal: c.signal });
    c.abort();
    await expect(p).resolves.toBeUndefined();
    h.runFrames();
    expect(h.renderer.render).not.toHaveBeenCalled();
    expect(h.port.getDiagnostics().instanceCount).toBe(0);
  });

  it('RESOLVES a superseded setLayout without applying', async () => {
    // Deliberately lopsided: A is large enough to need three build chunks and B one,
    // so without the post-await supersession check A finishes LAST and wins. This is
    // what makes the check load-bearing rather than the unreachable dead code task 3's
    // synchronous version was.
    const h = await makeHarness();
    h.port.resize(WIDTH, HEIGHT, 1);
    const layoutA = layoutOf('a', 1200);
    const layoutB = layoutOf('b', 10);
    const a = h.port.setLayout(layoutA, { generation: 1, signal: new AbortController().signal });
    const b = h.port.setLayout(layoutB, { generation: 2, signal: new AbortController().signal });
    await Promise.all([a, b]);
    expect(h.port.getDiagnostics().instanceCount).toBe(layoutB.lots.length);
  });

  it('accepts a LayoutResult and has NO method taking a CodebaseSnapshot', async () => {
    const h = await makeHarness();
    const anyPort = h.port as unknown as Record<string, unknown>;
    expect(anyPort.loadSnapshot).toBeUndefined();
    expect(anyPort.setSnapshot).toBeUndefined();
    expect(typeof h.port.setLayout).toBe('function');
  });

  it('re-applies setPixelRatio on EVERY resize, clamped to 2', async () => {
    const h = await makeHarness();
    h.port.resize(WIDTH, HEIGHT, 3);
    expect(h.renderer.setPixelRatio).toHaveBeenLastCalledWith(2);
    h.port.resize(WIDTH, HEIGHT, 1.5);
    expect(h.renderer.setPixelRatio).toHaveBeenLastCalledWith(1.5);
    expect(h.renderer.setPixelRatio).toHaveBeenCalledTimes(2);
  });

  it('no-ops resize on a zero-size box, so hidden leaves cost nothing', async () => {
    const h = await makeHarness();
    h.port.resize(0, 0, 2);
    h.port.resize(WIDTH, 0, 2);
    h.port.resize(0, HEIGHT, 2);
    expect(h.renderer.setPixelRatio).not.toHaveBeenCalled();
    expect(h.renderer.setSize).not.toHaveBeenCalled();
  });

  it('never fits as a side effect of resize', async () => {
    const h = await makeHarness();
    h.port.resize(WIDTH, HEIGHT, 1);
    await h.port.setLayout(layoutOf('s1', 5), { generation: 1, signal: new AbortController().signal });
    const before = h.port.getCamera();
    h.port.resize(400, 1000, 1);
    expect(h.port.getCamera()).toEqual(before);
    h.port.fit();
    expect(h.port.getCamera()).not.toEqual(before);   // fit() still does fit
  });

  it('installs NO ResizeObserver of its own', async () => {
    const h = await makeHarness();
    h.port.resize(WIDTH, HEIGHT, 1);
    expect(h.resizeObserver).not.toHaveBeenCalled();
  });

  it('distinguishes setFilter(null) from setFilter(empty set)', async () => {
    const h = await makeHarness();
    h.port.resize(WIDTH, HEIGHT, 1);
    h.port.setColors(paletteFixture());
    await h.port.setLayout(layoutOf('s1', 3), { generation: 1, signal: new AbortController().signal });
    const colourOf = (index: number): [number, number, number] => {
      const a = city().buildings.instanceColor!.array;
      return [a[index * 3]!, a[index * 3 + 1]!, a[index * 3 + 2]!];
    };
    h.port.setFilter(null);                      // unfiltered
    const unfiltered = colourOf(0);
    h.port.setFilter(new Set());                 // no matches — everything dimmed
    const dimmed = colourOf(0);
    expect(dimmed).not.toEqual(unfiltered);
    h.port.setFilter(new Set([ID('src/f0.ts')]));
    expect(colourOf(0)).toEqual(unfiltered);     // a match is drawn undimmed again
    expect(colourOf(1)).toEqual(dimmed);         // its neighbour is not
  });

  it('re-supplies EVERY colour the scene draws on setColors', async () => {
    const h = await makeHarness();
    h.port.resize(WIDTH, HEIGHT, 1);
    h.port.setColors(paletteFixture());
    await h.port.setLayout(layoutOf('s1', 3), { generation: 1, signal: new AbortController().signal });
    const before = sceneColours();
    const buildingBefore = Array.from(city().buildings.instanceColor!.array).slice(0, 3);
    h.port.setColors({
      ...paletteFixture('#ffffff'),
      districtSurface: '#112233', districtBorder: '#445566', selection: '#778899',
      unavailable: '#00ff00', labelText: '#010203',
      categories: Object.fromEntries(CATEGORY_IDS.map((id) => [id, '#ff0000'])) as CityPalette['categories'],
    });
    const after = sceneColours();
    expect(after.slab).not.toEqual(before.slab);
    expect(after.border).not.toEqual(before.border);
    expect(after.selection).not.toEqual(before.selection);
    expect(after.marker).not.toEqual(before.marker);
    // Building colour is per INSTANCE (setColorAt), not a material colour — the one
    // that would silently stay stale if setColors only re-coloured materials.
    expect(Array.from(city().buildings.instanceColor!.array).slice(0, 3)).not.toEqual(buildingBefore);
    expect(h.renderer.setClearColor).toHaveBeenCalled();
    expect(labelOverlay(h.mount).style.color).not.toBe('');
  });

  it('does not move buildings, change camera or clear state on setColors', async () => {
    const h = await makeHarness();
    h.port.resize(WIDTH, HEIGHT, 1);
    h.port.setColors(paletteFixture());
    await h.port.setLayout(layoutOf('s1', 3), { generation: 1, signal: new AbortController().signal });
    h.port.setSelection(ID('src/f1.ts'));
    const camera = h.port.getCamera();
    const matrix = Array.from(city().buildings.instanceMatrix.array);
    const selectionVisible = city().selection.visible;
    h.port.setColors(paletteFixture('#123456'));
    expect(h.port.getCamera()).toEqual(camera);
    expect(Array.from(city().buildings.instanceMatrix.array)).toEqual(matrix);
    expect(city().selection.visible).toBe(selectionVisible);
    expect(h.port.getDiagnostics().instanceCount).toBe(3);
  });

  it('reports context loss as unavailable{context-lost} and offers NO restore partner', async () => {
    const h = await makeHarness();
    h.port.debugLoseContext();
    expect(h.events).toContainEqual({ type: 'unavailable', reason: 'context-lost' });
    const anyPort = h.port as unknown as Record<string, unknown>;
    expect(anyPort.restore).toBeUndefined();
    expect(anyPort.onContextRestored).toBeUndefined();
    // Reported exactly once, however many times the loss is observed.
    h.port.debugLoseContext();
    expect(h.events.filter((e) => e.type === 'unavailable')).toHaveLength(1);
  });

  it('re-renders on demand only: nothing draws after the scene settles', async () => {
    const h = await makeHarness();
    h.port.resize(WIDTH, HEIGHT, 1);
    h.port.setColors(paletteFixture());
    await h.port.setLayout(layoutOf('s1', 5), { generation: 1, signal: new AbortController().signal });
    h.runFrames();
    expect(h.renderer.render).toHaveBeenCalled();
    h.renderer.render.mockClear();
    h.runFrames();
    h.runFrames();
    expect(h.renderer.render).not.toHaveBeenCalled();
  });

  it('switches camera mode with setCameraMode, spelled 3d | top everywhere', async () => {
    // "never receives it in list mode" is the VIEW's obligation (App.vue hides the
    // camera controls and, per this task's report, should not mount the viewport at
    // all there) — the port has no 'list' in its vocabulary to receive.
    const h = await makeHarness();
    h.port.resize(WIDTH, HEIGHT, 1);
    const threeD = h.port.getCamera();
    h.port.setCameraMode('top');
    expect(h.port.getCamera().mode).toBe('top');
    h.port.setCameraMode('3d');
    expect(h.port.getCamera()).toEqual(threeD);
  });

  it('keeps every light intensity inside the unclipped budget', async () => {
    // Nothing but a reader catches a wrong intensity, so this is the reader. With the
    // sun at SUN_DIRECTION, the largest dot product an axis-aligned box face can have
    // is that direction's largest normalised component; a fully lit face of the
    // brightest albedo a theme can supply (1.0) must land below 1.0, or the render
    // clips to white and the shading disappears — the blown-out white the task-S spike
    // photographed. Both intensities are also written as `<value> * Math.PI` (r155/r165).
    const { AMBIENT_BASE, DIRECTIONAL_BASE, SUN_DIRECTION } = await import('../../src/visualization/city-renderer');
    const length = Math.hypot(...SUN_DIRECTION);
    const maxDotNL = Math.max(...SUN_DIRECTION.map((c) => Math.abs(c) / length));
    expect(AMBIENT_BASE + DIRECTIONAL_BASE * maxDotNL).toBeLessThan(1);
    // …and the shaded sides must still be clearly darker, or every box reads as flat.
    expect(AMBIENT_BASE).toBeLessThan(AMBIENT_BASE + DIRECTIONAL_BASE * maxDotNL - 0.2);
  });
});

