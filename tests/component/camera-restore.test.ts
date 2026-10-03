// Phase 2c, C1 (Critical). THE REAL RENDERER, not `setLayout: vi.fn(async () => {})`.
//
// Every other suite that claims to cover "the persisted camera survives a renderer
// reconstruction" builds a double whose `setLayout` does nothing. A double that never
// fits never emits `camera-changed`, so it cannot observe the ordering this file is
// about: `setLayout` -> `swapCity` -> `rig.fit()` -> `camera-changed` -> `store.setCamera`
// all run SYNCHRONOUSLY inside the awaited call, so by the time the `.then()` restore
// reads `store.camera` the bookmark it meant to re-apply has already been overwritten by
// the auto-fit it just caused. The review reproduced that outside the repository; this
// file reproduces it inside, against the real `createCityRenderer`, the real
// `createCameraRig` and the real `buildCity`.
//
// Only `WebGLRenderer` is faked — jsdom resolves no GL surface, and that is the ONLY
// part of the renderer that needs one. Everything the defect lives in is real.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { nextTick, shallowRef } from 'vue';
import type { ShallowRef } from 'vue';
import '../mocks/obsidian';
import CityViewport from '../../src/ui/components/CityViewport.vue';
import { useCityStore } from '../../src/ui/stores/city-store';
import { INSPECTOR_OPENER_KEY } from '../../src/ui/drawer-focus';
import {
  CITY_RENDERER_KEY, LAYOUT_GENERATION_KEY, createLayoutGenerationSource,
} from '../../src/ui/renderer-handle';
import { computeLayout } from '../../src/domain/layout/layout';
import { buildSnapshotFixture } from '../fixtures/snapshot-builder';
import { captureGetContext, stubGetContext } from '../fixtures/renderer-doubles';
import type { CameraBookmark } from '../../src/domain/model';
import type { CityRendererPort } from '../../src/visualization/renderer-port';

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

const { createCityRenderer } = await import('../../src/visualization/city-renderer');

/** A bookmark nothing auto-fits to: a hand-placed eye at a zoom far from the fitted one,
 *  so "the restore was lost" and "the restore happened to match" cannot be confused. */
const BOOKMARK: CameraBookmark = {
  projection: 'orthographic', mode: '3d',
  position: [9, 9, 9], target: [1, 2, 3], up: [0, 1, 0], zoom: 3,
};

function makeWin(): Window {
  return {
    document,
    ResizeObserver: class { observe(): void {} unobserve(): void {} disconnect(): void {} },
    matchMedia: () => ({ matches: false, addEventListener: () => {}, removeEventListener: () => {} }),
    requestAnimationFrame: (cb: FrameRequestCallback) => window.setTimeout(() => { cb(0); }, 0),
    cancelAnimationFrame: (h: number) => { window.clearTimeout(h); },
    setTimeout: (fn: () => void, ms: number) => window.setTimeout(fn, ms),
    clearTimeout: (h: number) => { window.clearTimeout(h); },
    devicePixelRatio: 1,
    localStorage: { getItem: () => null },
  } as unknown as Window;
}

/** Drains the microtask queue AND the macrotask `buildCity` yields on, so the awaited
 *  `setLayout` and its `.then()` restore have both completed when this returns. */
async function settle(): Promise<void> {
  for (let i = 0; i < 12; i += 1) {
    await new Promise<void>((resolve) => { window.setTimeout(resolve, 0); });
    await nextTick();
  }
}

async function mountWithStoreState(): Promise<ShallowRef<CityRendererPort | null>> {
  const store = useCityStore();
  const snapshot = buildSnapshotFixture({ files: 6 });
  store.setCity(snapshot, computeLayout(snapshot));
  // Exactly the state every reconstruction path starts from — a WebGL context loss, a
  // sub-320px round trip, a pop-out migration, a list <-> 3D round trip: the store
  // already holds BOTH the layout and the persisted bookmark before the new renderer
  // exists. That is what `applyStoreState`'s `.then()` was written for.
  store.setCamera({ ...BOOKMARK, position: [...BOOKMARK.position], target: [...BOOKMARK.target] });

  const handle = shallowRef<CityRendererPort | null>(null);
  const wrapper = mount(CityViewport, {
    global: {
      provide: {
        createCityRenderer,
        [CITY_RENDERER_KEY as symbol]: handle,
        [INSPECTOR_OPENER_KEY as symbol]: shallowRef<HTMLElement | null>(null),
        [LAYOUT_GENERATION_KEY as symbol]: createLayoutGenerationSource(),
      },
    },
  });
  const stage = wrapper.get('[data-ci-role="stage"]').element as HTMLElement;
  (stage as unknown as { win: Window }).win = makeWin();
  await settle();
  return handle;
}

describe('C1: a reconstructed renderer lands on the PERSISTED camera, not its own auto-fit', () => {
  let restoreGetContext: () => void;

  beforeEach(() => {
    setActivePinia(createPinia());
    restoreGetContext = captureGetContext();
    stubGetContext('ok');
  });

  afterEach(() => { restoreGetContext(); });

  it('leaves store.camera equal to the bookmark it was reconstructed from', async () => {
    await mountWithStoreState();
    const store = useCityStore();
    expect(store.camera).not.toBeNull();
    // The auto-fit's own camera is nowhere near this: fit() zooms to the layout's
    // bounds and re-centres the target. If the restore lost the race, `zoom` is the
    // fitted value (order 1e-2) and the target is the layout centre.
    expect(store.camera!.zoom).toBeCloseTo(BOOKMARK.zoom, 6);
    expect(store.camera!.position).toEqual(BOOKMARK.position);
    expect(store.camera!.target).toEqual(BOOKMARK.target);
  });

  it('leaves the RENDERER on that camera too, not merely the store', async () => {
    const handle = await mountWithStoreState();
    // Read it back through the port: `getCamera()` reports the LOGICAL bookmark, so
    // this is the renderer's own answer to "where am I", independent of the store.
    const camera = handle.value!.getCamera();
    expect(camera.zoom).toBeCloseTo(BOOKMARK.zoom, 6);
    expect(camera.position[0]).toBeCloseTo(BOOKMARK.position[0], 6);
  });

  it('keeps previous3dCamera as the restored bookmark, not the auto-fit one', async () => {
    await mountWithStoreState();
    const store = useCityStore();
    // `previous3dCamera` is persisted into workspace.json alongside `camera` and is
    // spec 4.1's load-bearing "Top -> 3D restores the saved 3D camera" state. The
    // auto-fit's own mode is '3d', so a lost restore clobbers this one too.
    expect(store.previous3dCamera).not.toBeNull();
    expect(store.previous3dCamera!.zoom).toBeCloseTo(BOOKMARK.zoom, 6);
  });
});
