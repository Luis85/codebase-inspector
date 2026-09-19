import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { nextTick } from 'vue';
// Side-effect import: installs the jsdom gaps (tests/mocks/jsdom-gaps.ts) and the
// win/doc prototype extensions real Obsidian patches onto HTMLElement.
import '../mocks/obsidian';
import { installControllableResizeObserver } from '../mocks/window-harness';
import App from '../../src/ui/App.vue';
import CityViewport from '../../src/ui/components/CityViewport.vue';
import { CONTEXT_LOST_NOTICE } from '../../src/ui/copy';
import type { CityRendererEvent, CreateCityRenderer } from '../../src/visualization/renderer-port';
import { useCityStore } from '../../src/ui/stores/city-store';
import { computeLayout } from '../../src/domain/layout/layout';
import { buildSnapshotFixture } from '../../tests/fixtures/snapshot-builder';

/** Phase 2c, I5: what a real renderer's FIRST setLayout reports on its way past — the
 *  auto-fit's own camera. Deliberately unlike any bookmark these tests set. */
const AUTO_FIT_CAMERA = {
  projection: 'orthographic' as const, mode: '3d' as const,
  position: [77, 77, 77] as [number, number, number], target: [5, 5, 5] as [number, number, number],
  up: [0, 1, 0] as [number, number, number], zoom: 0.01,
};

function setRect(el: HTMLElement, width: number, height: number): void {
  el.getBoundingClientRect = () => ({
    width, height, top: 0, left: 0, right: width, bottom: height, x: 0, y: 0, toJSON: () => ({}),
  });
}

describe('jsdom rect stub (M11)', () => {
  afterEach(() => { document.body.innerHTML = ''; });

  it('a nested element with no rect of its own measures its nearest overridden ancestor', () => {
    const container = document.body.createDiv();
    setRect(container, 200, 700);
    const child = container.createDiv();
    const grandchild = child.createDiv();

    expect(child.getBoundingClientRect().width).toBe(200);
    expect(grandchild.getBoundingClientRect().width).toBe(200);
  });
});

// Phase 2 fix wave, I2 (Important). Spec 5.2: "Below a hard floor of 320 CSS px
// inline size the view renders LIST-FIRST and creates no WebGL context at all …
// Switching to the HTML inventory preserves query, selection and camera bookmark."
// Only the second half shipped: CityViewport disposed the renderer and created none
// (well pinned — mutation P23 reddens six tests), but NOTHING switched presentation.
// `viewMode` stayed '3d', CityViewport stayed mounted showing COPY-14 in an empty
// pane, and below 819 px styles.css gives the list wrapper `display: none` unless it
// is open — so the inventory the spec says should already be there sat behind the
// Files drawer opener. Spec 5.2 names this exact case: "a leaf dragged into a
// sidebar can be ~150 px".
//
// The rule lives in App.vue, NOT in CityViewport.applySize: switching to list mode
// UNMOUNTS CityViewport (App.vue's own `v-if`), which disconnects the very
// ResizeObserver that would have to notice the leaf coming back — a one-way door,
// which is the defect class this branch keeps paying for. App.vue's observer is on
// the leaf container and survives the switch.
describe('the 320 px floor renders list-first (I2)', () => {
  let resizeObserver: { trigger: () => void; restore: () => void };

  beforeEach(() => {
    setActivePinia(createPinia());
    resizeObserver = installControllableResizeObserver();
  });
  afterEach(() => {
    resizeObserver.restore();
    document.body.innerHTML = '';
  });

  function mountInLeaf(width: number) {
    const leaf = document.body.createDiv({ cls: 'codebase-inspector-root' });
    setRect(leaf, width, 700);
    const store = useCityStore();
    const snapshot = buildSnapshotFixture({ files: 3 });
    store.setCity(snapshot, computeLayout(snapshot));
    const wrapper = mount(App, { attachTo: leaf });
    return { wrapper, leaf, store };
  }

  it('switches to list mode and shows the inventory below the floor', async () => {
    const { wrapper, store } = mountInLeaf(200);
    await nextTick();

    expect(store.viewMode).toBe('list');
    expect(wrapper.find('[data-ci-role="stage"]').exists()).toBe(false);
    // The list wrapper is `display: none` below 819 px unless it carries this
    // modifier, so its presence is what "the list is on screen" means here.
    expect(wrapper.find('.ci-app__list-wrapper--open').exists()).toBe(true);
    expect(wrapper.findAll('.ci-file-list__row').length).toBe(3);
  });

  it('preserves query, selection and camera bookmark across the switch', async () => {
    const { store } = mountInLeaf(200);
    const bookmark = {
      projection: 'orthographic' as const, mode: '3d' as const,
      position: [9, 9, 9] as [number, number, number], target: [0, 0, 0] as [number, number, number],
      up: [0, 1, 0] as [number, number, number], zoom: 3,
    };
    store.setCamera(bookmark);
    const fileId = store.snapshot!.entities.find((e) => e.kind === 'file')!.id;
    store.select(fileId);
    store.setQuery('file');
    await nextTick();

    expect(store.viewMode).toBe('list');
    expect(store.selectedEntityId).toBe(fileId);
    expect(store.query).toBe('file');
    expect(store.camera).toEqual(bookmark);
  });

  it('returns to the spatial mode it came from when the leaf widens again', async () => {
    const { wrapper, leaf, store } = mountInLeaf(1000);
    await nextTick();
    expect(store.viewMode).toBe('3d');

    setRect(leaf, 200, 700);
    resizeObserver.trigger();
    await nextTick();
    expect(store.viewMode).toBe('list');

    setRect(leaf, 1000, 700);
    resizeObserver.trigger();
    await nextTick();
    expect(store.viewMode).toBe('3d');
    expect(wrapper.find('[data-ci-role="stage"]').exists()).toBe(true);
    expect(wrapper.find('.ci-app__list-wrapper--open').exists()).toBe(false);
  });

  it('returns to TOP view, not 3D, when that is where the user was', async () => {
    const { leaf, store } = mountInLeaf(1000);
    store.setViewMode('top');
    await nextTick();

    setRect(leaf, 200, 700);
    resizeObserver.trigger();
    await nextTick();
    expect(store.viewMode).toBe('list');

    setRect(leaf, 1000, 700);
    resizeObserver.trigger();
    await nextTick();
    expect(store.viewMode).toBe('top');
  });

  // Spec 4.2's pause/resume invariant: a leaf hidden behind a sibling tab collapses
  // to a 0x0 box and must SUSPEND, never be re-presented as something else. A zero
  // box is not "narrow".
  it('leaves a hidden (0x0) leaf alone', async () => {
    const { store } = mountInLeaf(0);
    await nextTick();
    expect(store.viewMode).toBe('3d');
  });
});

// Phase 2 fix wave, re-review round 2 (R1, Important): a STALE-OPEN Files drawer.
// Nothing reset `filesDrawerOpen` when the leaf grew back past 820 px, and the
// Escape branch this wave added was not gated on `narrowDrawer` the way its Inspector
// neighbour is -- so after opening Files narrow and widening the pane (a plain drag,
// or a pop-out), Escape resolved a layer that is NOT ON SCREEN: the press was
// swallowed instead of clearing the selection, and `closeFilesDrawer()` parked focus
// on the opener button, which the container query sets to `display: none` at >= 820 px
// (so in the real host `activeElement` falls to <body> and the user loses their place
// in the tab order). The same wrong-layer class as I1, non-destructive but reachable
// by a plain drag -- and the manual checkpoint performs exactly this gesture.
describe('a stale-open Files drawer (R1)', () => {
  let resizeObserver: { trigger: () => void; restore: () => void };

  beforeEach(() => {
    setActivePinia(createPinia());
    resizeObserver = installControllableResizeObserver();
  });
  afterEach(() => {
    resizeObserver.restore();
    document.body.innerHTML = '';
  });

  /** Opens the Files drawer at a genuinely narrow width, with a selection already
   *  made, and then widens the leaf past the 820 px drawer threshold. */
  async function openDrawerNarrowThenWiden() {
    const leaf = document.body.createDiv({ cls: 'codebase-inspector-root' });
    setRect(leaf, 400, 700);                    // narrow: the drawer IS a drawer
    const store = useCityStore();
    const snapshot = buildSnapshotFixture({ files: 2 });
    store.setCity(snapshot, computeLayout(snapshot));
    const wrapper = mount(App, { attachTo: leaf });
    await nextTick();

    const row = wrapper.get('.ci-file-list__row');
    await row.trigger('click');
    const selected = store.selectedEntityId;
    expect(selected).not.toBeNull();

    const opener = wrapper.get('[aria-label="Files"]');
    await opener.trigger('click');
    expect(wrapper.find('.ci-app__list-wrapper--open').exists()).toBe(true);

    // The user drags the pane wide. In the real host the drawer STOPS being a drawer
    // here -- the list becomes a permanent column and the opener is display:none.
    setRect(leaf, 1000, 700);
    resizeObserver.trigger();
    await nextTick();

    return { wrapper, store, row, opener, selected };
  }

  it('R1: widening past the drawer threshold closes it, so the state cannot go stale', async () => {
    const { wrapper } = await openDrawerNarrowThenWiden();

    expect(wrapper.find('.ci-app__list-wrapper--open').exists()).toBe(false);
    expect(wrapper.find('[aria-label="Close files"]').exists()).toBe(false);
  });

  it('R1: Escape then clears the SELECTION, and never parks focus on a hidden control', async () => {
    const { store, row, opener } = await openDrawerNarrowThenWiden();
    (row.element as HTMLElement).focus();

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await nextTick();

    // The layer that is actually on screen is the selection; the drawer is not.
    expect(store.selectedEntityId).toBeNull();
    // `closeFilesDrawer()` focuses the opener, which at >= 820 px is display:none in
    // the real host -- focus must have stayed where the user put it.
    expect(document.activeElement).not.toBe(opener.element);
    expect(document.activeElement).toBe(row.element);
  });
});

// Phase 2 fix wave, M1 (ruling M89). Ruling M83 decided not to force the
// context-loss notice to be visible, on the stated ground that M80's self-healing
// reconstruction clears it within the same microtask drain so it is "never painted".
// That is right for the case a human can trigger with debugLoseContext() on a visible
// leaf, and NOT absolute: when `applySize()` returns early -- a 0x0 box (a leaf hidden
// behind a sibling tab) or a box below the 320 px floor -- the reason is never cleared
// and the branch DOES render. Deleting the whole `v-else-if` left the suite green at
// 751; these three assert the branch and document M83's true boundary.
// Phase 2c, I5 (Important): the double FITS on its first setLayout, exactly as the
// frozen 4.2 contract says the real port does ("the FIRST layout frames itself"), and
// therefore emits `camera-changed`. A double that never fits cannot observe C1's
// ordering at all; this one can. `emit` is wired by the factory below.
function makeRendererDouble(emit: (e: CityRendererEvent) => void) {
  let hasFitted = false;
  return {
    setLayout: vi.fn(async () => {
      if (hasFitted) return;
      hasFitted = true;
      emit({ type: 'camera-changed', camera: AUTO_FIT_CAMERA });
    }),
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
      geometries: 0, textures: 0, programs: 0, drawCalls: 0, instanceCount: 0, lastFrameMs: 0, contextLost: false,
    })),
    debugLoseContext: vi.fn(),
  };
}

function makeFakeWin(): Window {
  class NoopResizeObserver {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  }
  return {
    ResizeObserver: NoopResizeObserver,
    matchMedia: vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })),
    devicePixelRatio: 1,
  } as unknown as Window;
}

async function mountViewport(width: number, height: number) {
  let onEvent: ((e: CityRendererEvent) => void) | null = null;
  const factory = vi.fn((_el: HTMLElement, _win: Window, handler: (e: CityRendererEvent) => void) => {
    onEvent = handler;
    return makeRendererDouble(handler);
  }) as unknown as CreateCityRenderer;
  const wrapper = mount(CityViewport, { global: { provide: { createCityRenderer: factory } } });
  const stage = wrapper.get('[data-ci-role="stage"]').element as HTMLElement;
  (stage as unknown as { win: Window }).win = makeFakeWin();
  setRect(stage, width, height);
  await nextTick();
  return { wrapper, stage, factory, loseContext: (): void => { onEvent!({ type: 'unavailable', reason: 'context-lost' }); } };
}

const settle = async (): Promise<void> => { await nextTick(); await nextTick(); await nextTick(); };

describe('the context-loss notice, where the self-heal cannot run (M1)', () => {
  beforeEach(() => { setActivePinia(createPinia()); });
  afterEach(() => { document.body.innerHTML = ''; });

  it('M1: paints it when the box is below the 320 px floor', async () => {
    const { wrapper, stage, loseContext } = await mountViewport(800, 600);
    setRect(stage, 200, 600);
    loseContext();
    await settle();
    expect(wrapper.text()).toContain(CONTEXT_LOST_NOTICE);
  });

  it('M1: paints it when the leaf is hidden behind a sibling tab (a 0x0 box)', async () => {
    const { wrapper, stage, loseContext } = await mountViewport(800, 600);
    setRect(stage, 0, 0);
    loseContext();
    await settle();
    expect(wrapper.text()).toContain(CONTEXT_LOST_NOTICE);
  });

  it('M1: does NOT paint it where the self-heal CAN run -- M83 boundary', async () => {
    const { wrapper, factory, loseContext } = await mountViewport(800, 600);
    expect(factory).toHaveBeenCalledTimes(1);
    loseContext();
    await settle();
    expect(factory).toHaveBeenCalledTimes(2);          // disposed and reconstructed
    expect(wrapper.text()).not.toContain(CONTEXT_LOST_NOTICE);
  });
});

// Checkpoint #3 defect 1 -- "when opening the city view, the canvas grows in height all
// the time." `applySize()` measured the stage with `getBoundingClientRect()`, which
// ALWAYS returns the BORDER box regardless of `box-sizing`; `.ci-viewport__stage` carries
// `border: 1px solid` (styles.css), so the figure handed to `resize()` was the content
// box + 2px. `city-renderer.ts`'s `resize()` calls `setSize(w, h, true)`, and Three writes
// that straight to `canvas.style.height` -- and the canvas is the stage's only in-flow
// block child, so the stage's CONTENT height became the PREVIOUS BORDER-box height. The
// ResizeObserver fired, `applySize()` re-measured, +2px. A ratchet, forever.
//
// jsdom has no layout engine, so the real feedback loop is not reproducible here and the
// 801-test suite never saw it. What IS pinnable is the MEASUREMENT CONTRACT: make the two
// boxes differ and assert which one reaches the port. The second test then models the one
// layout rule that closes the loop (canvas CSS height -> stage content height) and asserts
// the sequence reaches a FIXED POINT instead of ratcheting.
function setContentBox(el: HTMLElement, width: number, height: number): void {
  Object.defineProperty(el, 'clientWidth', { value: width, configurable: true });
  Object.defineProperty(el, 'clientHeight', { value: height, configurable: true });
}

function makeTriggerableWin(): { win: Window; triggerResize: () => void } {
  const callbacks: (() => void)[] = [];
  class TriggerableResizeObserver {
    constructor(cb: () => void) { callbacks.push(cb); }
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  }
  const win = {
    ResizeObserver: TriggerableResizeObserver,
    matchMedia: vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })),
    devicePixelRatio: 1,
  } as unknown as Window;
  return { win, triggerResize: () => { callbacks.forEach((cb) => { cb(); }); } };
}

describe('the stage is measured by its CONTENT box (checkpoint #3 defect 1)', () => {
  beforeEach(() => { setActivePinia(createPinia()); });
  afterEach(() => { document.body.innerHTML = ''; });

  async function mountStage(): Promise<{
    double: ReturnType<typeof makeRendererDouble>; stage: HTMLElement; triggerResize: () => void;
  }> {
    let onEvent: ((e: CityRendererEvent) => void) | null = null;
    const double = makeRendererDouble((e) => { onEvent?.(e); });
    const factory = vi.fn((_el: HTMLElement, _win: Window, handler: (e: CityRendererEvent) => void) => {
      onEvent = handler;
      return double;
    }) as unknown as CreateCityRenderer;
    const wrapper = mount(CityViewport, { global: { provide: { createCityRenderer: factory } } });
    const stage = wrapper.get('[data-ci-role="stage"]').element as HTMLElement;
    const { win, triggerResize } = makeTriggerableWin();
    (stage as unknown as { win: Window }).win = win;
    return { double, stage, triggerResize };
  }

  it('hands the renderer the content box, never the border box', async () => {
    const { double, stage } = await mountStage();
    setRect(stage, 402, 242);          // border box: content + the stage's 1px border, both sides
    setContentBox(stage, 400, 240);    // content box: the only size the canvas may be given
    await nextTick();

    expect(double.resize).toHaveBeenCalledWith(400, 240, expect.any(Number));
    expect(double.resize).not.toHaveBeenCalledWith(402, 242, expect.any(Number));
  });

  it('settles on a fixed point instead of ratcheting +2px per observer tick', async () => {
    const { double, stage, triggerResize } = await mountStage();
    // The one layout rule that closes the real loop, modelled: the canvas is the stage's
    // only in-flow child, so whatever height `resize()` writes to it becomes the stage's
    // content height on the next pass -- and the border box is that plus 2px.
    let contentHeight = 240;
    Object.defineProperty(stage, 'clientWidth', { get: () => 400, configurable: true });
    Object.defineProperty(stage, 'clientHeight', { get: () => contentHeight, configurable: true });
    stage.getBoundingClientRect = () => ({
      width: 402, height: contentHeight + 2, top: 0, left: 0,
      right: 402, bottom: contentHeight + 2, x: 0, y: 0, toJSON: () => ({}),
    });
    double.resize.mockImplementation((_w: number, h: number) => { contentHeight = h; });

    await nextTick();
    for (let tick = 0; tick < 5; tick += 1) { triggerResize(); }

    expect(contentHeight).toBe(240);
    const heights = double.resize.mock.calls.map((call: unknown[]) => call[1]);
    expect(new Set(heights)).toEqual(new Set([240]));
  });
});
