// Task 10 fix round 1, items 2 and 3: the LAST HOP. The port implements selection
// highlighting, filter dimming and label visibility correctly and tests them well, but
// before this round `setSelection` had exactly one ad-hoc caller (CodebaseFileList) and
// `setFilter`/`setLabels` had NONE — so a canvas pick highlighted nothing, and spec
// 5.2's "dims non-matches in place" was absent from the product entirely.
//
// CityViewport is the single owner of the renderer (ruling M68), so it is also the
// single place the store's view state is mirrored onto it. These tests are about that
// mirror: one path per concern, re-applied after a reconstruct, in a file of its own so
// city-viewport.test.ts stays inside the tests/** line budget.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { nextTick, shallowRef } from 'vue';
import '../mocks/obsidian';
import CityViewport from '../../src/ui/components/CityViewport.vue';
import { useCityStore } from '../../src/ui/stores/city-store';
import { INSPECTOR_OPENER_KEY } from '../../src/ui/drawer-focus';
import { computeLayout } from '../../src/domain/layout/layout';
import { buildSnapshotFixture } from '../fixtures/snapshot-builder';
import type { CityRendererEvent, CreateCityRenderer } from '../../src/visualization/renderer-port';

function makeRendererDouble() {
  return {
    setLayout: vi.fn(async (_layout: unknown, _opts: { generation: number; signal: AbortSignal }) => {}),
    setColors: vi.fn(), setSelection: vi.fn(), setFilter: vi.fn(), setLabels: vi.fn(),
    setCameraMode: vi.fn(), setMotion: vi.fn(),
    getCamera: vi.fn(() => ({
      projection: 'orthographic' as const, mode: '3d' as const,
      position: [0, 0, 0] as [number, number, number], target: [0, 0, 0] as [number, number, number],
      up: [0, 1, 0] as [number, number, number], zoom: 1,
    })),
    setCamera: vi.fn(), nudgeCamera: vi.fn(), focus: vi.fn(), fit: vi.fn(), resize: vi.fn(),
    pause: vi.fn(), resume: vi.fn(), dispose: vi.fn(),
    getDiagnostics: vi.fn(() => ({
      geometries: 0, textures: 0, programs: 0, drawCalls: 0, instanceCount: 0,
      lastFrameMs: 0, contextLost: false,
    })),
    debugLoseContext: vi.fn(),
  };
}

type RendererDouble = ReturnType<typeof makeRendererDouble>;

function makeFakeWin(): { win: Window; triggerResize: () => void } {
  let observed: (() => void) | null = null;
  class FakeResizeObserver {
    constructor(cb: () => void) { observed = cb; }
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  }
  const win = {
    ResizeObserver: FakeResizeObserver,
    matchMedia: () => ({ matches: false, addEventListener: () => {}, removeEventListener: () => {} }),
    devicePixelRatio: 1,
  } as unknown as Window;
  return { win, triggerResize: () => observed?.() };
}

interface Harness {
  renderers: RendererDouble[];
  events: (e: CityRendererEvent) => void;
  stage: HTMLElement;
  opener: ReturnType<typeof shallowRef<HTMLElement | null>>;
  triggerResize: () => void;
}

async function mountViewport(): Promise<Harness> {
  const renderers: RendererDouble[] = [];
  let emit: ((e: CityRendererEvent) => void) | null = null;
  const factory = vi.fn((_el: HTMLElement, _win: Window, onEvent: (e: CityRendererEvent) => void) => {
    emit = onEvent;
    const next = makeRendererDouble();
    renderers.push(next);
    return next;
  }) as unknown as CreateCityRenderer;
  const opener = shallowRef<HTMLElement | null>(null);
  const { win, triggerResize } = makeFakeWin();
  const wrapper = mount(CityViewport, {
    global: { provide: { createCityRenderer: factory, [INSPECTOR_OPENER_KEY as symbol]: opener } },
  });
  const stage = wrapper.get('[data-ci-role="stage"]').element as HTMLElement;
  (stage as unknown as { win: Window }).win = win;
  stage.getBoundingClientRect = () => ({
    width: 800, height: 600, top: 0, left: 0, right: 800, bottom: 600, x: 0, y: 0, toJSON: () => ({}),
  });
  await nextTick();   // CityViewport defers its first measurement one microtask
  await nextTick();   // ...and the handle watcher's own flush is one tick after that
  return { renderers, events: (e) => emit?.(e), stage, opener, triggerResize };
}

function seedSnapshot(): { id: string; otherId: string } {
  const store = useCityStore();
  const snapshot = buildSnapshotFixture({ files: 3 });
  store.setCity(snapshot, computeLayout(snapshot));
  const files = snapshot.entities.filter((e) => e.kind === 'file');
  return { id: files[0]!.id, otherId: files[1]!.id };
}

describe('CityViewport: the store-to-port mirror', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('mirrors the store selection onto the renderer, whichever surface set it', async () => {
    const h = await mountViewport();
    const { id } = seedSnapshot();
    useCityStore().select(id);
    await nextTick();
    expect(h.renderers[0]!.setSelection).toHaveBeenCalledWith(id);
  });

  it('clears the renderer selection when the store clears it', async () => {
    const h = await mountViewport();
    const { id } = seedSnapshot();
    const store = useCityStore();
    store.select(id);
    await nextTick();
    store.clearSelection();
    await nextTick();
    expect(h.renderers[0]!.setSelection).toHaveBeenLastCalledWith(null);
  });

  it('mirrors the search match set onto the renderer, so search dims the city', async () => {
    const h = await mountViewport();
    seedSnapshot();
    const store = useCityStore();
    store.setQuery('file-0');
    await nextTick();
    const matching = h.renderers[0]!.setFilter.mock.calls.at(-1)![0] as ReadonlySet<string>;
    expect(matching).toBeInstanceOf(Set);
    expect(matching.size).toBeGreaterThan(0);
  });

  it('passes null for an unfiltered store, distinct from an empty match set', async () => {
    const h = await mountViewport();
    seedSnapshot();
    const store = useCityStore();
    store.setQuery('nothing-matches-this');
    await nextTick();
    expect((h.renderers[0]!.setFilter.mock.calls.at(-1)![0] as ReadonlySet<string>).size).toBe(0);
    store.setQuery('   ');
    await nextTick();
    expect(h.renderers[0]!.setFilter).toHaveBeenLastCalledWith(null);
  });

  it('drives setLabels, so label visibility is a decision the port is told about', async () => {
    const h = await mountViewport();
    expect(h.renderers[0]!.setLabels).toHaveBeenCalledWith(true);
  });

  it('RE-APPLIES selection, filter and labels to a reconstructed renderer', async () => {
    // A context loss disposes and reconstructs (spec 4.2). Without this the rebuilt
    // renderer comes back with no selection outline and an undimmed city, silently
    // losing whatever the user had set.
    const h = await mountViewport();
    const { id } = seedSnapshot();
    const store = useCityStore();
    store.select(id);
    store.setQuery('file-0');
    await nextTick();

    h.events({ type: 'unavailable', reason: 'context-lost' });
    await nextTick();
    h.triggerResize();
    await nextTick();

    expect(h.renderers).toHaveLength(2);
    const rebuilt = h.renderers[1]!;
    expect(rebuilt.setSelection).toHaveBeenCalledWith(id);
    expect(rebuilt.setFilter.mock.calls.at(-1)![0]).toBeInstanceOf(Set);
    expect(rebuilt.setLabels).toHaveBeenCalledWith(true);
  });

  it('RE-SENDS the current layout to a reconstructed renderer, so the city is not empty', async () => {
    // The hazard the list-mode v-if turns from rare into routine: nothing else re-sends
    // a layout. `city-view.ts` calls setLayout only when a snapshot is PUBLISHED, so a
    // renderer rebuilt afterwards — by a context loss (spec 4.2's mandated
    // dispose-and-reconstruct) or by leaving and re-entering list mode — came back with
    // an empty scene and no way to refill it short of a rescan.
    // Seeded BEFORE the mount, which is also the real reopen path: spec 4.5's retained
    // in-memory state means a view can open with a snapshot already in the store and no
    // scan to authorise.
    seedSnapshot();
    const h = await mountViewport();
    expect(h.renderers[0]!.setLayout).toHaveBeenCalled();

    h.events({ type: 'unavailable', reason: 'context-lost' });
    await nextTick();
    h.triggerResize();
    await nextTick();

    const rebuilt = h.renderers[1]!;
    expect(rebuilt.setLayout).toHaveBeenCalledTimes(1);
    const [layout, opts] = rebuilt.setLayout.mock.calls[0]!;
    expect(layout).toBe(useCityStore().layout);
    expect(opts.generation).toBeGreaterThan(
      h.renderers[0]!.setLayout.mock.calls[0]![1].generation,
    );
  });

  it('opens the inspector on a canvas pick, with the stage as the focus-return opener', async () => {
    // Spec 5.2: "A click selects and opens the inspector", and it does not say the two
    // surfaces differ. The opener is the stage, so the narrow drawer's close returns
    // focus to the canvas — where the user was, and where F/T/arrows work.
    const h = await mountViewport();
    const { id } = seedSnapshot();
    const store = useCityStore();
    h.events({ type: 'entity-picked', entityId: id, snapshotId: 's1' });
    await nextTick();
    expect(store.selectedEntityId).toBe(id);
    expect(store.inspectorOpen).toBe(true);
    expect(h.opener.value).toBe(h.stage);
    expect(h.renderers[0]!.setSelection).toHaveBeenCalledWith(id);
  });

  it('mirrors camera-changed into the store without commanding the renderer back', async () => {
    // The event and the setCamera COMMAND are separate so host synchronisation does not
    // loop (spec 4.2) — mirroring must not turn into a round trip.
    const h = await mountViewport();
    const camera = {
      projection: 'orthographic' as const, mode: '3d' as const,
      position: [1, 2, 3] as [number, number, number], target: [0, 1, 0] as [number, number, number],
      up: [0, 1, 0] as [number, number, number], zoom: 0.5,
    };
    h.events({ type: 'camera-changed', camera });
    await nextTick();
    expect(useCityStore().camera).toEqual(camera);
    expect(h.renderers[0]!.setCamera).not.toHaveBeenCalled();
  });
});
