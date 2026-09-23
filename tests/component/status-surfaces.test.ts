import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { nextTick } from 'vue';
import '../mocks/obsidian';
import App from '../../src/ui/App.vue';
import StatusBanner from '../../src/ui/components/StatusBanner.vue';
import EmptyState from '../../src/ui/components/EmptyState.vue';
import { COPY_30_CLEAR_LABEL, COPY_30_EXPLANATION, COPY_30_REVEAL_LABEL } from '../../src/ui/copy';
import { useCityStore } from '../../src/ui/stores/city-store';
import { computeLayout } from '../../src/domain/layout/layout';
import { buildSnapshotFixture } from '../fixtures/snapshot-builder';
import { CITY_RENDERER_KEY } from '../../src/ui/renderer-handle';
import type { ViewSurfaceState } from '../../src/ui/view-surface';

/** Same shape as file-inspector.test.ts's own local double (CityRendererPort) —
 *  each component-test file that needs to assert a renderer command keeps its own
 *  copy rather than sharing one, the established pattern in this suite. Only
 *  `focus` is asserted against here (the Reveal control's own job). */
function makeRendererDouble() {
  return {
    setLayout: vi.fn(async () => {}),
    setColors: vi.fn(), setSelection: vi.fn(), setFilter: vi.fn(), setReported: vi.fn(), setLabels: vi.fn(),
    setCameraMode: vi.fn(), setMotion: vi.fn(),
    getCamera: vi.fn(() => ({ projection: 'orthographic' as const, mode: '3d' as const, position: [0, 0, 0] as [number, number, number], target: [0, 0, 0] as [number, number, number], up: [0, 1, 0] as [number, number, number], zoom: 1 })),
    setCamera: vi.fn(), nudgeCamera: vi.fn(), focus: vi.fn(), fit: vi.fn(), resize: vi.fn(),
    pause: vi.fn(), resume: vi.fn(), dispose: vi.fn(),
    getDiagnostics: vi.fn(() => ({ geometries: 0, textures: 0, programs: 0, drawCalls: 0, instanceCount: 0, lastFrameMs: 0, contextLost: false })),
    debugLoseContext: vi.fn(),
  };
}

function renderBoth(state: ViewSurfaceState): string {
  const banner = mount(StatusBanner, { props: { state } });
  const empty = mount(EmptyState, { props: { state } });
  return `${banner.text()} ${empty.text()}`;
}

// Acceptance criterion 2: "every view-level state has a surface". Defect D24
// (task-9-context.md §5) resolves the brief's own table two ways: adds
// 'failed-refresh' (spec §7 lists it separately from cancellation; finding 3 —
// run-state.ts's failureBanner has no COPY id and does not say the previous
// snapshot is retained); drops 'scanning, known total' (WP-01's walk never
// pre-counts files — InventoryRunState's `running` variant has no total
// denominator anywhere in this codebase, so a surface for a known-denominator
// state has no producer; spec §1 forbids a control for unimplemented behaviour).
describe('StatusBanner.vue (C16) + EmptyState.vue (C17) — every view-level state has a surface', () => {
  it.each<[string, ViewSurfaceState, string | RegExp]>([
    ['no source selected', { kind: 'no-source' }, 'Understand your codebase. Start with its structure.'],
    ['invalid directory', { kind: 'invalid-directory', detail: 'x' }, /directory/i],
    ['read not approved', { kind: 'read-not-approved' }, /Review scope and read access/],
    ['scanning, unknown total', { kind: 'scanning-unknown-total', processedFiles: 7 },
      /Reading included files\. \d+ files read so far\./],
    ['cancelled', { kind: 'cancelled' }, 'Scan cancelled. The incomplete result was discarded.'],
    ['cancelling over a snapshot (Part 6 Y1)', { kind: 'cancelling', hasSnapshot: true }, 'Cancelling the scan… The current snapshot stays available.'],
    ['cancelling a first scan (Part 6 Y1)', { kind: 'cancelling', hasSnapshot: false }, 'Cancelling the scan…'],
    ['failed refresh', { kind: 'failed-refresh', message: 'disk error' }, /previous snapshot is unchanged/],
    ['empty included scope', { kind: 'empty-scope' },
      'No files are included in this scope. Review the selected directory and exclusions.'],
    ['no search matches', { kind: 'no-search-matches', matchingFileCount: 4, query: 'x' },
      'No matching files. The snapshot still contains'],
    ['partial read evidence', { kind: 'partial-read', measured: 3, included: 5 },
      'Some files could not be read. Measurements cover'],
    ['root moved or unavailable', { kind: 'root-unavailable' },
      'The saved source directory is unavailable on this machine. The stored snapshot can still be inspected.'],
    ['3D unavailable', { kind: 'renderer-unavailable' },
      'The 3D view is unavailable. File inspection still works.'],
    ['WebGL context lost', { kind: 'context-lost' }, /rebuild|reconstruct/i],
  ])('gives %s a surface', (_name, state, copy) => {
    const text = renderBoth(state);
    if (typeof copy === 'string') expect(text).toContain(copy);
    else expect(text).toMatch(copy);
  });

  it('renders neither component for "none"', () => {
    const text = renderBoth({ kind: 'none' });
    expect(text.trim()).toBe('');
  });

  // Task 9 fix round 1, item 8 (fold): DELETED, not fixed in place. This used to
  // `provide` a `startScan` key neither component ever injects, then assert it
  // was not called — nothing could ever fail. Unlike SnapshotStatus.vue (which
  // at least touches `cityStore` and could plausibly grow a scan-triggering
  // path someday, so its own analogous test was rewritten instead to check the
  // run store's real, observable status), StatusBanner and EmptyState are
  // PURE functions of their `state` prop: no injects, no store access, no event
  // handlers, nothing capable of starting a scan by construction. There is no
  // observable signal left to assert against, so — per this item's own explicit
  // "make it assert something that can fail, or delete it and say why" — this
  // is deleted rather than kept as a test that documents intent but pins
  // nothing.

  it('StatusBanner and EmptyState never both render text for the same state', () => {
    const states: ViewSurfaceState[] = [
      { kind: 'no-source' }, { kind: 'cancelled' }, { kind: 'cancelling', hasSnapshot: false }, { kind: 'context-lost' },
      { kind: 'empty-scope' }, { kind: 'renderer-unavailable' },
    ];
    for (const state of states) {
      const banner = mount(StatusBanner, { props: { state } }).text().trim();
      const empty = mount(EmptyState, { props: { state } }).text().trim();
      expect(banner === '' || empty === '').toBe(true);
    }
  });
});

// Phase 2c, I4 (Important) -- the EIGHTH no-production-caller instance, and the first to
// survive by being REFERENCED from dead code: `city-store.ts`'s `banner` getter imports
// COPY_30 and nothing reads the getter, so a sweep counting unused EXPORTS missed it.
//
// The brief asks which way to resolve it. The spec answers, so the dead getter is not the
// bug -- the MISSING SURFACE is:
//   * spec line 913 adopts COPY-30 as one of the WP-01 strings, explicitly;
//   * spec 5.2 (line 860): "A filter-hidden selection stays selected and is EXPLAINED
//     ..., never silently replaced";
//   * 04-microcopy.md:36 (rank-4 handoff) gives it verbatim, for "Selection outside
//     filter".
// So the getter is rendered rather than deleted.
/** A wide (1000 px) leaf with a seeded snapshot — the ordinary three-column case.
 *  `rendererDouble` is optional: most of this file's tests never need to assert a
 *  renderer command, and App.vue's own `useCityRendererHandle()`-style fallback
 *  (a local, unshared ref) tolerates a plain `mount()` with nothing provided. */
function mountApp(files: number, rendererDouble?: ReturnType<typeof makeRendererDouble>) {
  const leaf = document.body.createDiv({ cls: 'codebase-inspector-root' });
  leaf.getBoundingClientRect = () => ({
    width: 1000, height: 700, top: 0, left: 0, right: 1000, bottom: 700, x: 0, y: 0, toJSON: () => ({}),
  });
  const store = useCityStore();
  store.navigate('city'); // WP-01 city behaviour: a fresh leaf now opens on Overview
  const snapshot = buildSnapshotFixture({ files });
  store.setCity(snapshot, computeLayout(snapshot));
  const options = rendererDouble
    ? { attachTo: leaf, global: { provide: { [CITY_RENDERER_KEY as symbol]: { value: rendererDouble } } } }
    : { attachTo: leaf };
  return { wrapper: mount(App, options), store };
}

describe('I4: COPY-30 reaches the user when the selection is outside the filter', () => {
  beforeEach(() => { setActivePinia(createPinia()); });
  afterEach(() => { document.body.innerHTML = ''; });

  it('renders the explanation when the selected file is not among the matches', async () => {
    const { wrapper, store } = mountApp(3);
    const file = store.snapshot!.entities.find((e) => e.kind === 'file')!;
    store.select(file.id);
    store.setQuery('nothing-matches-this');
    await nextTick();
    expect(wrapper.text()).toContain(COPY_30_EXPLANATION);
  });

  it('says nothing while unfiltered, or while the selection IS among the matches', async () => {
    const { wrapper, store } = mountApp(3);
    const file = store.snapshot!.entities.find((e) => e.kind === 'file')!;
    store.select(file.id);
    await nextTick();
    expect(wrapper.text()).not.toContain(COPY_30_EXPLANATION);

    store.setQuery(file.path);
    await nextTick();
    expect(wrapper.text()).not.toContain(COPY_30_EXPLANATION);
  });
});

// Task 9 (F13): the notice used to name two actions as PROSE — "Reveal file or clear
// selection." — and a user reading it had nothing to press. These pin the two real
// controls it becomes, and that they are genuinely separate actions (foundations/04,
// escape-intent.test.ts's own "clearing a selection is not clearing a search").
describe('F13: the filter notice becomes two real controls', () => {
  beforeEach(() => { setActivePinia(createPinia()); });
  afterEach(() => { document.body.innerHTML = ''; });

  function mountAppWithOutsideSelection(rendererDouble?: ReturnType<typeof makeRendererDouble>) {
    const mounted = mountApp(3, rendererDouble);
    const file = mounted.store.snapshot!.entities.find((e) => e.kind === 'file')!;
    mounted.store.select(file.id);
    mounted.store.setQuery('main');   // a nonempty query the seeded fixture never matches
    return { ...mounted, file };
  }

  it('turns the filter notice into the two actions it names', async () => {
    const { wrapper } = mountAppWithOutsideSelection();
    await nextTick();
    const reveal = wrapper.find('.ci-selection-notice__reveal');
    const clear = wrapper.find('.ci-selection-notice__clear');
    expect(reveal.exists()).toBe(true);
    expect(clear.exists()).toBe(true);
    // A3 fix (whole-branch review, I3): the rendered labels are checked against
    // COPY_30's own derived exports, not a retyped literal -- Ruling 30 pinned the
    // explanation half of COPY-30 this way, but left these two buttons hard-coded,
    // so a retitle of COPY_30 and a button together could previously drift apart
    // with every existing check (including this describe block) still green.
    expect(reveal.text()).toBe(COPY_30_REVEAL_LABEL);
    expect(clear.text()).toBe(COPY_30_CLEAR_LABEL);
    // The tail COPY_30 used to render as PROSE is gone as literal text — replaced by
    // the two buttons above, not restated beside them.
    expect(wrapper.text()).not.toContain('Reveal file or clear selection.');
    // Polish F4: the derivation is string surgery on COPY_30; a catalogue reword must fail
    // here, not produce a nonsense label.
    expect(COPY_30_REVEAL_LABEL).toBe('Reveal file');
    expect(COPY_30_CLEAR_LABEL).toBe('Clear selection');
  });

  it('clearing selection from the notice keeps the query', async () => {
    const { wrapper, store } = mountAppWithOutsideSelection();
    await nextTick();
    await wrapper.find('.ci-selection-notice__clear').trigger('click');
    expect(store.selectedEntityId).toBeNull();
    expect(store.query).toBe('main');
  });

  it('Reveal re-selects and focuses the file through the renderer, without touching the query', async () => {
    const rendererDouble = makeRendererDouble();
    const { wrapper, store, file } = mountAppWithOutsideSelection(rendererDouble);
    await nextTick();
    await wrapper.find('.ci-selection-notice__reveal').trigger('click');
    expect(rendererDouble.focus).toHaveBeenCalledWith(file.id);
    expect(store.selectedEntityId).toBe(file.id);
    expect(store.query).toBe('main');
  });
});
