import { describe, expect, it, vi } from 'vitest';
import { setTimeout as scheduleTimeout } from 'node:timers';
import type { Object3D } from 'three';
import type { LayoutResult } from '../../src/domain/layout/types';
import type { CityPalette, CityRendererPort } from '../../src/visualization/renderer-port';
import { CATEGORY_IDS } from '../../src/domain/classify';

// createCityRenderer's happy path needs a real WebGL2 context, which no environment
// available to this test suite provides (verified directly against jsdom while
// implementing task 3: constructing a real THREE.WebGLRenderer against a jsdom canvas
// throws synchronously — jsdom has no WebGL backend at all). Mocking only
// WebGLRenderer (everything else in 'three' — Scene, cameras, lights, InstancedMesh —
// is real, since none of it needs an actual GPU context) is what lets this test reach
// the REAL (non-inert) port object, which is what fix 2 (task-3-report.md, review
// round 1, finding 2) needs covered: debugLoseContext() must never throw, including
// when the underlying context is already gone.
class FakeWebGLRenderer {
  info = { memory: { geometries: 0, textures: 0 }, programs: [], render: { calls: 0 } };
  setClearColor = vi.fn();
  setPixelRatio = vi.fn();
  setSize = vi.fn();
  render = vi.fn();
  dispose = vi.fn();
  forceContextLoss = vi.fn();
  getContext = vi.fn(() => {
    throw new Error('context is gone');
  });
}

vi.mock('three', async (importOriginal) => {
  const actual = await importOriginal<typeof import('three')>();
  return { ...actual, WebGLRenderer: FakeWebGLRenderer };
});

// Task 10 expanded what construction actually touches, so these doubles grew with it —
// every `it` body below is unchanged. The renderer now (a) pre-checks WebGL2 with
// getContext('webgl2') before constructing THREE.WebGLRenderer, so that a platform
// without it reports `unavailable{unsupported}` instead of the `initialization-failed`
// task 3 reported for every failure alike, and (b) appends a DOM label overlay beside
// the canvas, built with the mount element's own createDiv.
function fakeElement(): HTMLCanvasElement {
  return {
    style: {},
    className: '',
    hidden: false,
    setAttribute: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    appendChild: vi.fn(),
    remove: vi.fn(),
    // Obsidian's own ambient HTMLElement extensions, which the real app installs long
    // before a plugin loads: the renderer styles its canvas through setCssStyles (its
    // own no-static-styles-assignment rule) and the label overlay builds its DOM with
    // createDiv, in the mount element's own document.
    setCssStyles: vi.fn(),
    createDiv: vi.fn(() => fakeElement()),
    // Task 6 fix round 1: the district-focus tests below drive a REAL `setLayout()`,
    // which reaches label-overlay.ts's `setDistricts()` — unexercised by every test
    // above this point, none of which calls `setLayout` at all — and that calls
    // `el.createSpan(...)` on each label div, Obsidian's own ambient extension.
    createSpan: vi.fn(() => fakeElement()),
    getContext: vi.fn(() => ({ getExtension: () => null })),
  } as unknown as HTMLCanvasElement;
}

function fakeWin(): Window {
  return {
    document: {
      createElement: vi.fn(() => fakeElement()),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      hidden: false,
    },
    requestAnimationFrame: vi.fn(() => 1),
    cancelAnimationFrame: vi.fn(),
    setTimeout: vi.fn(() => 1),
    clearTimeout: vi.fn(),
    localStorage: { getItem: vi.fn(() => null) },
  } as unknown as Window;
}

describe('createCityRenderer', () => {
  it('reaches the real (non-inert) port when WebGL construction succeeds', async () => {
    const { createCityRenderer } = await import('../../src/visualization/city-renderer');
    const onEvent = vi.fn();
    const mountEl = fakeElement() as unknown as HTMLElement;
    createCityRenderer(mountEl, fakeWin(), onEvent);
    // The port never throws (spec 4.2): no unavailable event on a successful build.
    expect(onEvent).not.toHaveBeenCalled();
  });

  it('debugLoseContext() never throws, even when the underlying context is already gone', async () => {
    const { createCityRenderer } = await import('../../src/visualization/city-renderer');
    const onEvent = vi.fn();
    const mountEl = fakeElement() as unknown as HTMLElement;
    const port = createCityRenderer(mountEl, fakeWin(), onEvent);

    // FakeWebGLRenderer.getContext() throws unconditionally (as it would for a
    // renderer whose context has already been lost or disposed) — this is exactly
    // review finding 2: debugLoseContext() called `.getContext().getExtension(...)`
    // with no guard.
    expect(() => { port.debugLoseContext(); }).not.toThrow();
  });

  it('dispose() never throws', async () => {
    const { createCityRenderer } = await import('../../src/visualization/city-renderer');
    const mountEl = fakeElement() as unknown as HTMLElement;
    const port = createCityRenderer(mountEl, fakeWin(), vi.fn());
    expect(() => { port.dispose(); }).not.toThrow();
  });
});

// Task 4. foundations/03: "A selected building receives a high-contrast outline PLUS a
// locator marker." Tested against buildCity/CityMeshes directly, not through the full
// port: CityMeshes.root is the one place the live scene graph is reachable by name —
// CityRendererPort deliberately exposes no such accessor (spec 4.2's own boundary), and
// buildCity itself touches no WebGL, so none of the FakeWebGLRenderer machinery above is
// needed here.
function selectionLayoutFixture(): LayoutResult {
  const entityId = 'repo\0file\0src/tall.ts';
  return {
    snapshotId: 's1', layoutVersion: '1',
    lots: [
      { entityId, directoryId: 'repo\0directory\0src',
        center: [0, 3, 0], dimensions: [2, 6, 2], colorKey: CATEGORY_IDS[0], metricState: 'measured' },
      { entityId: 'repo\0file\0src/short.ts', directoryId: 'repo\0directory\0src',
        center: [4, 1, 0], dimensions: [2, 2, 2], colorKey: CATEGORY_IDS[0], metricState: 'measured' },
    ],
    districts: [{
      directoryId: 'repo\0directory\0src', parentId: null, name: 'src', depth: 0,
      center: [0, 0, 0], extent: [12, 12], labelAnchor: [0, 0.2, 0], aggregated: false,
    }],
    // The tall lot (height 6) is the tallest thing in bounds (max y 6): a locator that
    // only clears ITS OWN roof, not the skyline's, would still fail to be a beacon.
    bounds: { min: [-6, 0, -6], max: [6, 6, 6] },
    scale: { metricId: 'physical-lines', name: 'Physical lines', cap: 1000, unit: 'lines', clampedCount: 0 },
  };
}

function selectionPaletteFixture(): CityPalette {
  const categories = Object.fromEntries(CATEGORY_IDS.map((id) => [id, '#4c8bf5'])) as CityPalette['categories'];
  return {
    background: '#1e1e1e', districtSurface: '#2a2a2a', districtBorder: '#3a3a3a',
    labelText: '#dddddd', selection: '#ffb020', unavailable: '#808080', categories,
    relations: { outgoing: '#53b8c4', incoming: '#d99a5b', cycle: '#d9707a' },
  };
}

// buildCity yields between chunks via `win.setTimeout` (instanced-city.ts's
// `yieldToHost`) — a stub that never invokes its callback (as this file's own fakeWin()
// above deliberately is, for the tests that never call setLayout) would hang this await
// forever. Node's real global timer is enough; no DOM is needed for buildCity itself.
// Imported from 'node:timers' as a renamed LOCAL binding, not the bare global: this is
// a node-environment test file (vitest.config.ts) with no `window` to satisfy
// obsidianmd/prefer-window-timers, and `globalThis.setTimeout` trips
// obsidianmd/no-global-this right back. A local import binding is neither — the rule's
// own "only flag global references, not local functions" carve-out applies here.
// yieldToHost never calls win.clearTimeout, so this double has none.
function realTimerWin(): Window {
  return { setTimeout: (fn: () => void, ms?: number) => scheduleTimeout(fn, ms) } as unknown as Window;
}

// Dynamic, not static: this file's `vi.mock('three', ...)` factory above references
// FakeWebGLRenderer, a class declared further down THIS file. A static top-level import
// of instanced-city.ts (which imports 'three') would run before that class declaration
// is reached and hit its TDZ — exactly what every other src import in this file already
// avoids by importing inside the test body instead.
async function buildTestCity(layout: LayoutResult): ReturnType<
  typeof import('../../src/visualization/instanced-city').buildCity
> {
  const { buildCity } = await import('../../src/visualization/instanced-city');
  return buildCity(layout, { win: realTimerWin(), superseded: () => false });
}

describe('selection encoding: outline plus locator', () => {
  it('draws both halves of the selection encoding', async () => {
    const layout = selectionLayoutFixture();
    const city = await buildTestCity(layout);
    expect(city).not.toBeNull();
    city!.setColors(selectionPaletteFixture());
    city!.setSelection(layout.lots[0]!.entityId);
    // foundations/03: two objects, because an outline alone vanishes the moment the
    // building is occluded, and a marker alone does not say WHICH building.
    expect(city!.root.getObjectByName('ci-selection-outline')).toBeDefined();
    expect(city!.root.getObjectByName('ci-selection-locator')).toBeDefined();
    city!.dispose();
  });

  it('keeps the locator legible with no camera-mode input at all — interactions/03: top-down removes height cues, and CityMeshes has no camera awareness to lose them through', async () => {
    const layout = selectionLayoutFixture();
    const city = await buildTestCity(layout);
    city!.setColors(selectionPaletteFixture());
    city!.setSelection(layout.lots[0]!.entityId);
    const locator = city!.root.getObjectByName('ci-selection-locator') as Object3D;
    // Camera mode ('3d' | 'top') lives entirely in camera-rig.ts / city-renderer.ts —
    // instanced-city.ts never receives it (renderer-port.ts's own contract notes: the
    // renderer owns the camera, the scene it builds does not). So the ONLY way this
    // object could fail to read top-down is if it were never wired to selection at all,
    // which is exactly what this asserts.
    expect(locator.visible).toBe(true);
    city!.dispose();
  });

  it('deselecting hides the locator along with the outline', async () => {
    const layout = selectionLayoutFixture();
    const city = await buildTestCity(layout);
    city!.setColors(selectionPaletteFixture());
    city!.setSelection(layout.lots[0]!.entityId);
    city!.setSelection(null);
    expect((city!.root.getObjectByName('ci-selection-outline') as Object3D).visible).toBe(false);
    expect((city!.root.getObjectByName('ci-selection-locator') as Object3D).visible).toBe(false);
    city!.dispose();
  });

  it('colours the locator from palette.selection, and only palette.selection (ruling A1: no eleventh palette member)', async () => {
    const layout = selectionLayoutFixture();
    const city = await buildTestCity(layout);
    city!.setColors(selectionPaletteFixture());
    city!.setSelection(layout.lots[0]!.entityId);
    const locator = city!.root.getObjectByName('ci-selection-locator') as unknown as
      { material: { color: { getHexString: () => string } } };
    // '#ffb020' round-trips through Color -> getHexString losslessly (no float32
    // instance-colour precision loss in play here, unlike the instanced buildings).
    expect(locator.material.color.getHexString()).toBe('ffb020');
    city!.dispose();
  });

  it('never adds the locator to a pick target (instanced-city.ts:39 — file lots only)', async () => {
    const layout = selectionLayoutFixture();
    const city = await buildTestCity(layout);
    city!.setColors(selectionPaletteFixture());
    city!.setSelection(layout.lots[0]!.entityId);
    const locator = city!.root.getObjectByName('ci-selection-locator');
    expect(city!.pickTargets).not.toContain(locator);
    city!.dispose();
  });
});

// Task 6 fix round 1: C07's `directoryFocusRequested` (CodebaseFileList.vue's group-
// focus button) sends a DIRECTORY id here. Before this fix, `focus(entityId)` resolved
// only through `city.lotOf`, built from `layout.lots` (files) alone — a directory id
// was never in that map, so the call found nothing and moved the camera nowhere,
// silently. This drives the REAL port (createCityRenderer), not CityMeshes directly,
// because the fallback lives in city-renderer.ts's own `focus()`, one layer above
// CityMeshes.
function districtFocusLayoutFixture(): LayoutResult {
  const fileId = 'repo\0file\0src/a.ts';
  const districtId = 'repo\0directory\0src';
  return {
    snapshotId: 's3', layoutVersion: '1',
    lots: [
      { entityId: fileId, directoryId: districtId,
        center: [0, 1, 0], dimensions: [2, 2, 2], colorKey: CATEGORY_IDS[0], metricState: 'measured' },
    ],
    // Centered well away from the origin (DEFAULT_CAMERA's own target) and from the
    // lot above, so a camera that never actually moved cannot pass this by accident.
    districts: [{
      directoryId: districtId, parentId: null, name: 'src', depth: 0,
      center: [10, 0, 6], extent: [8, 6], labelAnchor: [10, 0.2, 6], aggregated: false,
    }],
    bounds: { min: [0, 0, 0], max: [14, 2, 9] },
    scale: { metricId: 'physical-lines', name: 'Physical lines', cap: 1000, unit: 'lines', clampedCount: 0 },
  };
}

/** Real timers for buildCity's yield (same reason `realTimerWin` above exists), PLUS
 *  the DOM/localStorage shape `createCityRenderer` itself needs from `win` (this
 *  file's own `fakeWin()`) — no existing helper in this file combines both, because no
 *  existing test drives a full `port.setLayout()` through the real port. */
async function mountedDistrictFocusPort(): Promise<{ port: CityRendererPort; districtId: string }> {
  const { createCityRenderer } = await import('../../src/visualization/city-renderer');
  const win = {
    ...fakeWin(),
    setTimeout: (fn: () => void, ms?: number) => scheduleTimeout(fn, ms),
  } as unknown as Window;
  const mountEl = fakeElement() as unknown as HTMLElement;
  const port = createCityRenderer(mountEl, win, vi.fn());
  const layout = districtFocusLayoutFixture();
  const controller = new AbortController();
  await port.setLayout(layout, { generation: 1, signal: controller.signal });
  return { port, districtId: layout.districts[0]!.directoryId };
}

describe('directory focus: focus() completes for a district id (task 6 fix round 1)', () => {
  it('moves the camera to the district\'s own center when passed its directoryId', async () => {
    const { port, districtId } = await mountedDistrictFocusPort();
    expect(port.getCamera().target).not.toEqual([10, 0, 6]);   // sanity: not already there
    port.focus(districtId);
    // getCamera() reports the LOGICAL destination (renderer-port.ts's own contract
    // note), not a mid-tween value, so this is exact rather than eventually-consistent.
    expect(port.getCamera().target).toEqual([10, 0, 6]);
  });

  it('still focuses a FILE the same as before — the district fallback never shadows it', async () => {
    const { port } = await mountedDistrictFocusPort();
    port.focus('repo\0file\0src/a.ts');
    expect(port.getCamera().target).toEqual([0, 1, 0]);
  });
});
