import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { nextTick } from 'vue';
// Side-effect import: installs the win/doc prototype extensions real Obsidian
// patches onto HTMLElement (tests/mocks/obsidian.ts) — task 9 fix round 2, item 2's
// own shell-level Escape listener (App.vue) reads `rootEl.value.doc`/`.win`, same
// as FileSearch.vue's own global listener already does (file-search.test.ts's own
// identical import).
import '../mocks/obsidian';
import App from '../../src/ui/App.vue';
import { useCityStore } from '../../src/ui/stores/city-store';
import { computeLayout } from '../../src/domain/layout/layout';
import { buildSnapshotFixture } from '../../tests/fixtures/snapshot-builder';
import type { CityRendererEvent, CityRendererPort, CreateCityRenderer } from '../../src/visualization/renderer-port';

function makeRendererDouble(): CityRendererPort {
  return {
    setLayout: vi.fn(async () => {}),
    setColors: vi.fn(), setSelection: vi.fn(), setFilter: vi.fn(), setLabels: vi.fn(),
    setCameraMode: vi.fn(), setMotion: vi.fn(),
    getCamera: vi.fn(() => ({ projection: 'orthographic' as const, mode: '3d' as const, position: [0, 0, 0] as [number, number, number], target: [0, 0, 0] as [number, number, number], up: [0, 1, 0] as [number, number, number], zoom: 1 })),
    setCamera: vi.fn(), nudgeCamera: vi.fn(), focus: vi.fn(), fit: vi.fn(), resize: vi.fn(),
    pause: vi.fn(), resume: vi.fn(), dispose: vi.fn(),
    getDiagnostics: vi.fn(() => ({ geometries: 0, textures: 0, programs: 0, drawCalls: 0, instanceCount: 0, lastFrameMs: 0, contextLost: false })),
    debugLoseContext: vi.fn(),
  };
}

class FakeResizeObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

function makeFakeWin(): Window {
  return {
    ResizeObserver: FakeResizeObserver,
    matchMedia: vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })),
    devicePixelRatio: 1,
  } as unknown as Window;
}

/** Mounts `App` with a `createCityRenderer` factory provided and the exposed
 *  `rendererHost` (CityViewport's own stage element — unchanged contract,
 *  task 9 fix round 2, item 1) wired with a fake window and a >=320px rect, so
 *  construction actually proceeds far enough to call the factory. */
function mountAppWithFactory(factory: CreateCityRenderer) {
  const wrapper = mount(App, { global: { provide: { createCityRenderer: factory } } });
  const exposed = wrapper.vm as unknown as { rendererHost: HTMLElement | null };
  const stage = exposed.rendererHost!;
  (stage as unknown as { win: Window }).win = makeFakeWin();
  stage.getBoundingClientRect = () => ({
    width: 800, height: 600, top: 0, left: 0, right: 800, bottom: 600, x: 0, y: 0, toJSON: () => ({}),
  });
  return { wrapper, stage };
}

// Task 9 replaces the task-3 welcome-shell App.vue pins here with the real C01
// shell (ten components, two stores). Every assertion below is retained UNCHANGED
// in substance — same copy, same "no disabled placeholder", same exposed
// `rendererHost` contract city-view.ts (unmodified this task) depends on — the only
// addition is `setActivePinia(createPinia())` per test, because App.vue now calls
// `useCityStore()`/`useRunStore()` directly (task 3's shell never touched Pinia).
// See task-9-report.md for the full account of what moved where.
describe('App.vue welcome-state shell', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  // Several item-7 tests below `attachTo: document.body` (focus only genuinely
  // moves for a connected element) — cleared after every test, not just those,
  // so a leftover mount never leaks DOM (or a stray `document.activeElement`)
  // into a later, unrelated test.
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('shows the first-run headline and the source action, verbatim', () => {
    const wrapper = mount(App);
    expect(wrapper.text()).toContain('Understand your codebase. Start with its structure.');
    expect(wrapper.text()).toContain('Select a codebase');
  });

  it('never renders the WP-02+ or dropped S01 strings', () => {
    const wrapper = mount(App);
    expect(wrapper.text()).not.toContain('Unused candidate');
    expect(wrapper.text()).not.toContain('Analysis reports can be added later');
  });

  it('renders no renderer-unavailable notice when nothing has reported unavailable', () => {
    // No `createCityRenderer` factory is provided at all here (CityViewport's
    // own inject default is `null`), so it stays passive and shows nothing.
    const wrapper = mount(App);
    expect(wrapper.text()).not.toContain('The 3D view is unavailable');
  });

  // Task 9 fix round 2, item 1 (ruling M68): `rendererAvailable` is now dead and
  // removed — CityViewport owns sizing entirely itself (its own `available` ref,
  // driven by its own measurement) and no longer injects an externally-fed
  // signal. These three tests (item 4's own regression guards, round 1) are
  // redone against the REAL post-consolidation mechanism: a provided factory
  // that reports `unavailable` through its `onEvent` callback, exactly as
  // `city-viewport.test.ts`'s own dedicated tests already exercise.
  it('shows the renderer-unavailable notice (COPY-14) when the renderer reports unavailable', async () => {
    let onEventCapture: ((e: CityRendererEvent) => void) | null = null;
    const factory: CreateCityRenderer = (_el, _win, onEvent) => {
      onEventCapture = onEvent;
      return makeRendererDouble();
    };
    const { wrapper } = mountAppWithFactory(factory);
    await nextTick();
    onEventCapture!({ type: 'unavailable', reason: 'unsupported' });
    await nextTick();
    expect(wrapper.text()).toContain('The 3D view is unavailable. File inspection still works.');
  });

  // Task 9 fix round 1, item 4 (Important): view-surface.ts's derivation used to
  // check renderer/root unavailability BEFORE no-source/scanning/cancelled/
  // empty-scope/no-search-matches/partial-read, as the head of a single-winner
  // priority chain — and city-view.ts initialised `rendererAvailable` to
  // `ref(false)` (only flipped true once a measurement ran), so this was worse
  // than a narrow-leaf edge case: the welcome action was hidden before the FIRST
  // size measurement, and permanently on any leaf under the 320px floor, which is
  // exactly where spec 5.2 says the view must render list-first and KEEP WORKING.
  // A regression against task 3, whose welcome button was unconditional. Still
  // pinned here (round 2) against the new mechanism.
  it('does not let renderer unavailability mask "no source selected"', async () => {
    let onEventCapture: ((e: CityRendererEvent) => void) | null = null;
    const factory: CreateCityRenderer = (_el, _win, onEvent) => {
      onEventCapture = onEvent;
      return makeRendererDouble();
    };
    const { wrapper } = mountAppWithFactory(factory);
    await nextTick();
    onEventCapture!({ type: 'unavailable', reason: 'unsupported' });
    await nextTick();
    expect(wrapper.text()).toContain('Understand your codebase. Start with its structure.');
    expect(wrapper.text()).toContain('Select a codebase');
  });

  it('prints COPY-14 exactly once, not twice, when the renderer is unavailable', async () => {
    let onEventCapture: ((e: CityRendererEvent) => void) | null = null;
    const factory: CreateCityRenderer = (_el, _win, onEvent) => {
      onEventCapture = onEvent;
      return makeRendererDouble();
    };
    const { wrapper } = mountAppWithFactory(factory);
    await nextTick();
    onEventCapture!({ type: 'unavailable', reason: 'unsupported' });
    await nextTick();
    const copy14 = 'The 3D view is unavailable. File inspection still works.';
    const occurrences = wrapper.text().split(copy14).length - 1;
    expect(occurrences).toBe(1);
  });

  it('exposes an empty renderer-host element for the host to mount into', () => {
    const wrapper = mount(App);
    const exposed = wrapper.vm as unknown as { rendererHost: HTMLElement | null };
    expect(exposed.rendererHost).toBeInstanceOf(HTMLElement);
    expect(exposed.rendererHost?.childElementCount).toBe(0);
  });

  it('renders the action as a normal, enabled control — never a disabled placeholder', () => {
    const wrapper = mount(App);
    const button = wrapper.get('button');
    expect(button.attributes('disabled')).toBeUndefined();
  });

  // Task 9 fix round 1, item 3 (Important): city-store.ts defaulted to
  // `viewMode: 'list'`, and CameraControls only renders when `viewMode !== 'list'`
  // — so the eleven WCAG 2.5.7 single-pointer controls never appeared in the
  // shipped UI at all, on any leaf, ever, until something explicitly switched
  // away from list mode. Nothing did: the only production caller of setViewMode
  // was CameraControls' own "Top" button, which was itself hidden. Default is now
  // a spatial mode; list stays reachable as the FALLBACK (spec 5.2's "list-first"
  // below the 320px floor), never the default.
  it('defaults to a spatial mode, so the WCAG 2.5.7 camera controls render out of the box', () => {
    const wrapper = mount(App);
    expect(wrapper.find('[aria-label="Fit"]').exists()).toBe(true);
    expect(wrapper.find('[aria-label="Rotate left"]').exists()).toBe(true);
  });

  it('renders the file list regardless of view mode — per the container-query layout, not per viewMode', () => {
    const wrapper = mount(App);
    // Default is a spatial mode (previous test), yet the list still renders: the
    // >=820px "list + canvas + inspector" layout needs it present unconditionally,
    // with CSS (not viewMode) deciding whether it is a static pane or a drawer.
    expect(wrapper.find('.ci-app__list').exists()).toBe(true);
  });

  // Task 10 fix round 1, fold (the implementer's own finding 5): spec 5.2 says list mode
  // creates no WebGL context at all, and browsers cap live contexts at roughly 8-16. The
  // comment that used to justify mounting it unconditionally — that city-view.ts captures
  // `rendererHost` once and keeps it for the view's lifetime — went stale with ruling
  // M68, which moved renderer ownership into CityViewport itself; `rendererHost` now
  // appears nowhere in src/host/ at all.
  it('mounts NO viewport in list mode, so no WebGL context exists there', async () => {
    const wrapper = mount(App);
    expect(wrapper.find('[data-ci-role="stage"]').exists()).toBe(true);

    await wrapper.get('[aria-label="List view"]').trigger('click');
    expect(wrapper.find('[data-ci-role="stage"]').exists()).toBe(false);

    await wrapper.get('[aria-label="Return to city view"]').trigger('click');
    expect(wrapper.find('[data-ci-role="stage"]').exists()).toBe(true);
  });

  it('makes list mode reachable, both to enter it and to return from it', async () => {
    const wrapper = mount(App);
    expect(wrapper.find('[aria-label="Fit"]').exists()).toBe(true);

    await wrapper.get('[aria-label="List view"]').trigger('click');
    // In list mode there is no renderer and no camera to control (spec 4.2: "In
    // 'list' mode no renderer exists and setCameraMode is never called").
    expect(wrapper.find('[aria-label="Fit"]').exists()).toBe(false);

    await wrapper.get('[aria-label="Return to city view"]').trigger('click');
    expect(wrapper.find('[aria-label="Fit"]').exists()).toBe(true);
  });

  // Task 9 fix round 1, item 7 (Important): the <820px layout gave both
  // .ci-app__list and .ci-inspector the identical `position: absolute; inset: 0`
  // treatment, but nothing enforced ONE OVERLAY AT A TIME, the Files overlay had
  // NO close control and NO opener at all, and neither overlay returned focus to
  // whatever opened it.
  describe('narrow-layout drawers (item 7)', () => {
    it('opens the Files drawer and closes it, returning focus to its opener', async () => {
      const wrapper = mount(App, { attachTo: document.body });
      const opener = wrapper.get('[aria-label="Files"]');
      await opener.trigger('click');
      expect(wrapper.find('[aria-label="Close files"]').exists()).toBe(true);

      await wrapper.get('[aria-label="Close files"]').trigger('click');
      expect(wrapper.find('[aria-label="Close files"]').exists()).toBe(false);
      expect(document.activeElement).toBe(opener.element);
    });

    it('makes the Files and Inspector drawers mutually exclusive — activating a row closes the Files drawer', async () => {
      const store = useCityStore();
      const snapshot = buildSnapshotFixture({ files: 1 });
      store.setCity(snapshot, computeLayout(snapshot));
      const wrapper = mount(App, { attachTo: document.body });

      await wrapper.get('[aria-label="Files"]').trigger('click');
      expect(wrapper.find('[aria-label="Close files"]').exists()).toBe(true);

      await wrapper.get('.ci-file-list__row').trigger('click');
      expect(wrapper.find('[aria-label="Close files"]').exists()).toBe(false);
      expect(wrapper.find('[aria-label="File inspector"]').exists()).toBe(true);
    });

    it('opening the inspector by activating a row returns focus to that row when it closes', async () => {
      const store = useCityStore();
      const snapshot = buildSnapshotFixture({ files: 1 });
      store.setCity(snapshot, computeLayout(snapshot));
      const wrapper = mount(App, { attachTo: document.body });

      const row = wrapper.get('.ci-file-list__row');
      await row.trigger('click');
      expect(wrapper.find('[aria-label="File inspector"]').exists()).toBe(true);

      await wrapper.get('[aria-label="Close"]').trigger('click');
      expect(wrapper.find('[aria-label="File inspector"]').exists()).toBe(false);
      expect(document.activeElement).toBe(row.element);
    });
  });

  // Task 9 fix round 2, item 2 (Fold): before this fix, escapeIntent's only
  // production consumer was FileSearch.vue (always `inSearch: true`), so only the
  // `clear-query` branch was reachable end to end -- acceptance criterion 3
  // ("Escape resolves exactly one layer, in order") was unmet. This wires the
  // shell's OWN Escape handling through the SAME `escapeIntent` chain, using real
  // state (`store.inspectorOpen`, a real container-width measurement for
  // `narrowDrawer`, and `document.activeElement` for focus), so the drawer and
  // selection branches are reachable too, in M61's spec order.
  describe('shell-level Escape handling (fix round 2, item 2)', () => {
    it('resolves exactly one layer per press, and two presses resolve two, in order', async () => {
      // A narrow (<820px) container: `escapeIntent`'s `narrowDrawer` gate is real,
      // not hardcoded, so the drawer branch below only fires because this IS narrow.
      const rectSpy = vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({
        width: 400, height: 700, top: 0, left: 0, right: 400, bottom: 700, x: 0, y: 0, toJSON: () => ({}),
      });
      try {
        const store = useCityStore();
        const snapshot = buildSnapshotFixture({ files: 1 });
        store.setCity(snapshot, computeLayout(snapshot));
        const wrapper = mount(App, { attachTo: document.body });

        const row = wrapper.get('.ci-file-list__row');
        await row.trigger('click');
        // A real click also focuses the activated element (HTML's own
        // activation behaviour); jsdom's synthetic `.click()` does not, so this
        // is made explicit -- round 3, item 1's own focus-containment gate
        // (this view must OWN focus to act) depends on it genuinely being here,
        // not merely on `document.body`.
        (row.element as HTMLElement).focus();
        expect(wrapper.find('[aria-label="File inspector"]').exists()).toBe(true);
        expect(store.selectedEntityId).not.toBeNull();

        // First press: the narrow inspector drawer is open, so it closes FIRST
        // (M61's order), preserving the selection -- not `clear-selection` yet.
        // Dispatched on `document` directly (not `wrapper.trigger`), matching
        // file-search.test.ts's own established pattern for this shell-level,
        // document-bound listener.
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        await nextTick();
        expect(wrapper.find('[aria-label="File inspector"]').exists()).toBe(false);
        expect(store.selectedEntityId).not.toBeNull();
        // Closing the drawer returns focus to its opener (the row), exactly like
        // its own Close button already does -- so the second press below
        // genuinely finds focus on the list, not by the test forcing it there.
        expect(document.activeElement).toBe(row.element);

        // Second press: no drawer is open now, so the NEXT layer resolves --
        // the selection, because focus is on the list/canvas surface.
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        await nextTick();
        expect(store.selectedEntityId).toBeNull();
      } finally {
        rectSpy.mockRestore();
      }
    });

    // Task 9 fix round 3, item 1 (Important): the handler above used to act on
    // EVERY Escape reaching `document`, regardless of where focus actually was --
    // contradicting escape-intent.ts's own stated invariant ("must not disturb...
    // a Markdown editor elsewhere in the workspace") and spec 5.2. Gated now,
    // exactly like FileSearch.vue's own `viewRoot.contains(doc.activeElement)`.
    it('does nothing, and steals no focus, when Escape is pressed outside this view', async () => {
      const rectSpy = vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({
        width: 400, height: 700, top: 0, left: 0, right: 400, bottom: 700, x: 0, y: 0, toJSON: () => ({}),
      });
      try {
        const store = useCityStore();
        const snapshot = buildSnapshotFixture({ files: 1 });
        store.setCity(snapshot, computeLayout(snapshot));
        const wrapper = mount(App, { attachTo: document.body });
        await wrapper.get('.ci-file-list__row').trigger('click');
        expect(wrapper.find('[aria-label="File inspector"]').exists()).toBe(true);

        // A stand-in for "a Markdown editor elsewhere in the workspace" --
        // outside this view's own root entirely.
        const outsideInput = document.body.createEl('input');
        outsideInput.focus();
        expect(document.activeElement).toBe(outsideInput);

        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        await nextTick();

        expect(wrapper.find('[aria-label="File inspector"]').exists()).toBe(true);
        expect(document.activeElement).toBe(outsideInput);
        outsideInput.remove();
      } finally {
        rectSpy.mockRestore();
      }
    });

    // Multiple leaves are a first-class WP-01 capability (ruling M9): two
    // CityViews both listen on the SAME `document`, so without containment a
    // row focused in leaf A satisfied leaf B's own `inCanvas` check too.
    it('does not let one leaf\'s Escape resolve a layer in another leaf', async () => {
      const rectSpy = vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({
        width: 400, height: 700, top: 0, left: 0, right: 400, bottom: 700, x: 0, y: 0, toJSON: () => ({}),
      });
      try {
        const pinia1 = createPinia();
        const pinia2 = createPinia();
        const snapshot1 = buildSnapshotFixture({ files: 1 });
        const snapshot2 = buildSnapshotFixture({ files: 1 });
        const store1 = useCityStore(pinia1);
        const store2 = useCityStore(pinia2);
        store1.setCity(snapshot1, computeLayout(snapshot1));
        store2.setCity(snapshot2, computeLayout(snapshot2));
        const entity1 = snapshot1.entities.find((e) => e.kind === 'file')!.id;
        const entity2 = snapshot2.entities.find((e) => e.kind === 'file')!.id;
        // Selected but NOT drawer-open (`close-inspector` ignores focus location
        // entirely, so it would mask this specific cross-talk with round 3's own
        // fix): a selection, cleared only by `inCanvas` focus containment.
        store1.select(entity1);
        store2.select(entity2);

        mount(App, { attachTo: document.body, global: { plugins: [pinia1] } });
        const wrapper2 = mount(App, { attachTo: document.body, global: { plugins: [pinia2] } });
        // Focus is genuinely in leaf 2's own list, never leaf 1's.
        (wrapper2.get('.ci-file-list__row').element as HTMLElement).focus();

        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        await nextTick();

        // Leaf 1's own Escape must not have resolved -- focus was in leaf 2.
        expect(store1.selectedEntityId).toBe(entity1);
        // Leaf 2's OWN Escape still resolves normally -- containment attributes
        // the press to the right leaf, it does not just suppress everything.
        expect(store2.selectedEntityId).toBeNull();
      } finally {
        rectSpy.mockRestore();
      }
    });
  });
});
