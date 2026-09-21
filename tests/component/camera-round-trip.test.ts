// Final whole-branch review, item 7: leaving the city for another screen UNMOUNTS it
// (App.vue's route switch), so coming back builds a brand-new renderer whose first
// setLayout auto-fits and reports that fit as `camera-changed`. The selection and the
// persisted camera bookmark must both survive the city -> overview -> city round trip,
// and the new renderer must be put back on the bookmark (CityViewport's
// applyStoreState restore), not left on its own auto-fit.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { nextTick } from 'vue';
import '../mocks/obsidian';
import App from '../../src/ui/App.vue';
import { useCityStore } from '../../src/ui/stores/city-store';
import { computeLayout } from '../../src/domain/layout/layout';
import { buildSnapshotFixture } from '../fixtures/snapshot-builder';
import type { CameraBookmark } from '../../src/domain/model';
import type { CityRendererEvent, CreateCityRenderer } from '../../src/visualization/renderer-port';

const BOOKMARK: CameraBookmark = {
  projection: 'orthographic', mode: '3d',
  position: [9, 9, 9], target: [1, 2, 3], up: [0, 1, 0], zoom: 3,
};
const AUTO_FIT: CameraBookmark = {
  projection: 'orthographic', mode: '3d',
  position: [77, 77, 77], target: [5, 5, 5], up: [0, 1, 0], zoom: 0.01,
};

/** Like city-viewport-wiring.test.ts's double: every FRESH renderer fits on its first
 *  setLayout and reports it, exactly as the real port does. */
function makeRendererDouble(emit: (e: CityRendererEvent) => void) {
  let hasFitted = false;
  return {
    setLayout: vi.fn(async () => {
      if (hasFitted) return;
      hasFitted = true;
      emit({ type: 'camera-changed', camera: AUTO_FIT });
    }),
    setColors: vi.fn(), setSelection: vi.fn(), setFilter: vi.fn(), setLabels: vi.fn(),
    setCameraMode: vi.fn(), setMotion: vi.fn(), getCamera: vi.fn(() => AUTO_FIT),
    setCamera: vi.fn(), nudgeCamera: vi.fn(), focus: vi.fn(), fit: vi.fn(), resize: vi.fn(),
    pause: vi.fn(), resume: vi.fn(), dispose: vi.fn(),
    getDiagnostics: vi.fn(() => ({
      geometries: 0, textures: 0, programs: 0, drawCalls: 0, instanceCount: 0, lastFrameMs: 0, contextLost: false,
    })),
    debugLoseContext: vi.fn(),
  };
}

/** jsdom lays nothing out, so every content box is 0x0 and CityViewport (correctly)
 *  builds no renderer. A leaf-sized box for every element stands in for layout. */
function giveEveryElementABox(): () => void {
  const proto = HTMLElement.prototype;
  const originals = ['clientWidth', 'clientHeight'].map((k) => [k, Object.getOwnPropertyDescriptor(proto, k)] as const);
  Object.defineProperty(proto, 'clientWidth', { configurable: true, get: () => 900 });
  Object.defineProperty(proto, 'clientHeight', { configurable: true, get: () => 600 });
  return () => { for (const [k, d] of originals) if (d) Object.defineProperty(proto, k, d); };
}

async function settle(): Promise<void> {
  for (let i = 0; i < 4; i += 1) { await flushPromises(); await nextTick(); }
}

describe('city -> overview -> city', () => {
  let restoreBoxes: () => void;
  beforeEach(() => { setActivePinia(createPinia()); useCityStore().navigate('city'); restoreBoxes = giveEveryElementABox(); });
  afterEach(() => { restoreBoxes(); document.body.innerHTML = ''; });

  it('keeps the selection and the camera bookmark, and restores the new renderer onto it', async () => {
    const renderers: ReturnType<typeof makeRendererDouble>[] = [];
    const factory = vi.fn((_el: HTMLElement, _win: Window, onEvent: (e: CityRendererEvent) => void) => {
      const next = makeRendererDouble(onEvent);
      renderers.push(next);
      return next;
    }) as unknown as CreateCityRenderer;

    const store = useCityStore();
    const snapshot = buildSnapshotFixture({ files: 6 });
    store.setCity(snapshot, computeLayout(snapshot));
    const fileId = snapshot.entities.find((e) => e.kind === 'file')!.id;
    store.select(fileId);
    store.setCamera(structuredClone(BOOKMARK));

    const w = mount(App, {
      attachTo: document.body,
      global: { provide: { onSelectCodebase: vi.fn(), createCityRenderer: factory } },
    });
    await settle();
    expect(renderers).toHaveLength(1);
    expect(store.camera).toEqual(BOOKMARK);

    store.navigate('overview');
    await settle();
    expect(w.find('.ci-app').exists()).toBe(false);
    expect(renderers[0]!.dispose).toHaveBeenCalled();

    store.navigate('city');
    await settle();
    expect(renderers).toHaveLength(2);
    expect(store.selectedEntityId).toBe(fileId);
    expect(store.camera).toEqual(BOOKMARK);
    // The fresh renderer auto-fit on its way in; the restore put it back on the bookmark.
    expect(renderers[1]!.setCamera).toHaveBeenLastCalledWith(BOOKMARK);
    expect(renderers[1]!.setSelection).toHaveBeenLastCalledWith(fileId);
    w.unmount();
  });
});
