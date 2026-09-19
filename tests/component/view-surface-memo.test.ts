// Phase 2c, M8 (Minor). `App.vue`'s `viewSurfaceState` computed rebuilt
// `store.snapshot.entities.filter(...).length` AND called `countPartialRead` — which
// allocates a Set of every file id and scans every observation (view-surface.ts:32-43) —
// inside a computed that also depends on `store.matchingIds`. `matchingIds` changes on
// every debounced keystroke, so both O(n) passes ran per keystroke while depending on
// nothing that had changed. At ~1,000 files / ~2,000 observations that is wasteful rather
// than wrong, which is why it is pinned by CALL COUNT rather than by a timing assertion:
// a time-based test would be flaky and would not say what the defect is.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { nextTick } from 'vue';
import '../mocks/obsidian';
import App from '../../src/ui/App.vue';
import { useCityStore } from '../../src/ui/stores/city-store';
import { computeLayout } from '../../src/domain/layout/layout';
import { buildSnapshotFixture } from '../fixtures/snapshot-builder';

vi.mock('../../src/ui/view-surface', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/ui/view-surface')>();
  return { ...actual, countPartialRead: vi.fn(actual.countPartialRead) };
});
const { countPartialRead } = await import('../../src/ui/view-surface');
const countSpy = vi.mocked(countPartialRead);

describe('M8: the snapshot-only passes do not re-run on every keystroke', () => {
  beforeEach(() => { setActivePinia(createPinia()); });
  afterEach(() => { document.body.innerHTML = ''; });

  function mountApp() {
    const leaf = document.body.createDiv({ cls: 'codebase-inspector-root' });
    leaf.getBoundingClientRect = () => ({
      width: 1000, height: 700, top: 0, left: 0, right: 1000, bottom: 700, x: 0, y: 0, toJSON: () => ({}),
    });
    const store = useCityStore();
    const snapshot = buildSnapshotFixture({ files: 12 });
    store.setCity(snapshot, computeLayout(snapshot));
    return { wrapper: mount(App, { attachTo: leaf }), store };
  }

  it('countPartialRead does not run again when only the QUERY changes', async () => {
    const { wrapper, store } = mountApp();
    await nextTick();
    expect(wrapper.text()).toBeDefined();
    countSpy.mockClear();

    // Four debounced keystrokes' worth of `matchingIds` churn. None of them changes the
    // snapshot, so none of them can change what countPartialRead would answer.
    for (const query of ['f', 'fi', 'fil', 'file']) {
      store.setQuery(query);
      await nextTick();
    }
    expect(countSpy).not.toHaveBeenCalled();
  });

  it('but it DOES run again when the snapshot itself changes', async () => {
    // The memo must be a memo, not a one-shot: a new scan has to be observed.
    const { store } = mountApp();
    await nextTick();
    countSpy.mockClear();
    const next = buildSnapshotFixture({ files: 5, repositoryId: 'second' });
    store.setCity(next, computeLayout(next));
    await nextTick();
    expect(countSpy).toHaveBeenCalled();
  });
});
