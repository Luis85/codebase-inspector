import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { nextTick } from 'vue';
import '../mocks/obsidian';
import App from '../../src/ui/App.vue';
import StatusBanner from '../../src/ui/components/StatusBanner.vue';
import EmptyState from '../../src/ui/components/EmptyState.vue';
import { COPY_30 } from '../../src/ui/copy';
import { useCityStore } from '../../src/ui/stores/city-store';
import { computeLayout } from '../../src/domain/layout/layout';
import { buildSnapshotFixture } from '../fixtures/snapshot-builder';
import type { ViewSurfaceState } from '../../src/ui/view-surface';

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
      { kind: 'no-source' }, { kind: 'cancelled' }, { kind: 'context-lost' },
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
describe('I4: COPY-30 reaches the user when the selection is outside the filter', () => {
  beforeEach(() => { setActivePinia(createPinia()); });
  afterEach(() => { document.body.innerHTML = ''; });

  function mountApp() {
    const leaf = document.body.createDiv({ cls: 'codebase-inspector-root' });
    leaf.getBoundingClientRect = () => ({
      width: 1000, height: 700, top: 0, left: 0, right: 1000, bottom: 700, x: 0, y: 0, toJSON: () => ({}),
    });
    const store = useCityStore();
    const snapshot = buildSnapshotFixture({ files: 3 });
    store.setCity(snapshot, computeLayout(snapshot));
    return { wrapper: mount(App, { attachTo: leaf }), store };
  }

  it('renders the explanation when the selected file is not among the matches', async () => {
    const { wrapper, store } = mountApp();
    const file = store.snapshot!.entities.find((e) => e.kind === 'file')!;
    store.select(file.id);
    store.setQuery('nothing-matches-this');
    await nextTick();
    expect(wrapper.text()).toContain(COPY_30);
  });

  it('says nothing while unfiltered, or while the selection IS among the matches', async () => {
    const { wrapper, store } = mountApp();
    const file = store.snapshot!.entities.find((e) => e.kind === 'file')!;
    store.select(file.id);
    await nextTick();
    expect(wrapper.text()).not.toContain(COPY_30);

    store.setQuery(file.path);
    await nextTick();
    expect(wrapper.text()).not.toContain(COPY_30);
  });
});
