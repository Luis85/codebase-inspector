import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { nextTick } from 'vue';
import CodebaseFileList from '../../src/ui/components/CodebaseFileList.vue';
import { useCityStore } from '../../src/ui/stores/city-store';
import { computeLayout } from '../../src/domain/layout/layout';
import { buildSnapshotFixture } from '../../tests/fixtures/snapshot-builder';
import { CITY_RENDERER_KEY } from '../../src/ui/renderer-handle';
import type { CityRendererPort } from '../../src/visualization/renderer-port';

function makeRendererDouble() {
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

function mountWithRenderer(rendererDouble: CityRendererPort) {
  return mount(CodebaseFileList, {
    global: { provide: { [CITY_RENDERER_KEY as symbol]: { value: rendererDouble } } },
  });
}

describe('CodebaseFileList.vue (C07)', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('renders rows as NATIVE BUTTONS', () => {
    const store = useCityStore();
    const snapshot = buildSnapshotFixture({ files: 3 });
    store.setCity(snapshot, computeLayout(snapshot));
    const rendererDouble = makeRendererDouble();
    const wrapper = mountWithRenderer(rendererDouble);
    const row = wrapper.get('.ci-file-list__row');
    expect(row.element.tagName).toBe('BUTTON');
  });

  // Phase 2 fix wave, M7: `rovingTabIndex` returning 0 for EVERY row left the suite
  // green. A stated accessibility decision ("moving focus with the keyboard never
  // selects") depends on exactly one row being in the tab order -- making every row
  // tabbable would put thousands of stops in it with nothing to notice.
  it('M7: exactly ONE row is in the tab order, and it follows the roving focus', async () => {
    const store = useCityStore();
    const snapshot = buildSnapshotFixture({ files: 3 });
    store.setCity(snapshot, computeLayout(snapshot));
    const wrapper = mountWithRenderer(makeRendererDouble());
    const tabIndexes = (): (string | undefined)[] =>
      wrapper.findAll('.ci-file-list__row').map((row) => row.attributes('tabindex'));

    // No roving focus yet: the FIRST row is the single entry point.
    expect(tabIndexes()).toEqual(['0', '-1', '-1']);

    const ids = snapshot.entities.filter((e) => e.kind === 'file').map((e) => e.id);
    store.focusRow(ids[2]!);
    await nextTick();
    expect(tabIndexes()).toEqual(['-1', '-1', '0']);
    // ...and moving focus did NOT select (spec: activation is Enter/click only).
    expect(store.selectedEntityId).toBeNull();
  });

  it('puts no role=tree on an incomplete implementation', () => {
    const store = useCityStore();
    const snapshot = buildSnapshotFixture({ files: 3, directories: 2 });
    store.setCity(snapshot, computeLayout(snapshot));
    const wrapper = mountWithRenderer(makeRendererDouble());
    expect(wrapper.find('[role="tree"]').exists()).toBe(false);
  });

  // Task 10 fix round 1, item 2: REDIRECTED, not deleted. This used to assert that
  // activating a row called the renderer's setSelection directly from this component.
  // That ad-hoc call was the SECOND path to the port — a canvas pick had no equivalent,
  // so the two surfaces disagreed — and it is gone. What a row activation owes is
  // unchanged: it writes the store of record. The canvas half of the guarantee moved to
  // tests/component/city-viewport-wiring.test.ts ("mirrors the store selection onto the
  // renderer, whichever surface set it") and is still proved end to end through a real
  // CityView in tests/host/city-view-store-wiring.test.ts. The renderer assertion stays,
  // inverted, so reintroducing a direct command here fails this test.
  it('drives the canvas through the store, the single selection path', async () => {
    const store = useCityStore();
    const snapshot = buildSnapshotFixture({ files: 2 });
    store.setCity(snapshot, computeLayout(snapshot));
    const rendererDouble = makeRendererDouble();
    const wrapper = mountWithRenderer(rendererDouble);
    const row = wrapper.get('.ci-file-list__row');
    await row.trigger('click');
    const fileEntity = snapshot.entities.find((e) => e.kind === 'file')!;
    expect(store.selectedEntityId).toBe(fileEntity.id);
    expect(rendererDouble.setSelection).not.toHaveBeenCalled();
  });

  it('does not select on mere focus movement', async () => {
    const store = useCityStore();
    const snapshot = buildSnapshotFixture({ files: 2 });
    store.setCity(snapshot, computeLayout(snapshot));
    const rendererDouble = makeRendererDouble();
    const wrapper = mountWithRenderer(rendererDouble);
    const row = wrapper.get('.ci-file-list__row');
    await row.trigger('focus');
    expect(store.selectedEntityId).toBeNull();
    // Vacuous against this component since item 2 (it commands no renderer at all now),
    // but kept deliberately as the structural guard the test above names: focus must
    // never select, by EITHER path.
    expect(rendererDouble.setSelection).not.toHaveBeenCalled();
  });

  it('shows COPY-11 when nothing matches', () => {
    const store = useCityStore();
    const snapshot = buildSnapshotFixture({ files: 4 });
    store.setCity(snapshot, computeLayout(snapshot));
    store.setQuery('nothing-matches-any-of-these');
    const wrapper = mountWithRenderer(makeRendererDouble());
    expect(wrapper.text()).toContain('No matching files. The snapshot still contains');
  });

  // Phase 2c, ruling M102. The rows now carry `v-memo`, so each one is re-patched only
  // when one of its listed dependencies changes -- which is exactly the optimisation that
  // can silently stop a row from updating if a dependency is missing from that list. The
  // three existing tests above all assert the FIRST render (they set the store up before
  // mounting), so none of them could see such a bug. These assert the UPDATE path: every
  // state a row's rendering depends on, changed AFTER mount.
  it('M102: a row re-renders when the dimming, selection or focus changes after mount', async () => {
    const store = useCityStore();
    const snapshot = buildSnapshotFixture({ files: 4 });
    store.setCity(snapshot, computeLayout(snapshot));
    const files = snapshot.entities.filter((e) => e.kind === 'file');
    const wrapper = mountWithRenderer(makeRendererDouble());
    const dimmedCount = (): number =>
      wrapper.findAll('.ci-file-list__row').filter((r) => r.classes().includes('ci-file-list__row--dimmed')).length;

    expect(dimmedCount()).toBe(0);
    store.setQuery(files[0]!.path);
    await nextTick();
    expect(dimmedCount()).toBe(3);                       // dimming reaches the rows
    store.setQuery('');
    await nextTick();
    expect(dimmedCount()).toBe(0);                       // ...and comes back off again

    store.select(files[2]!.id);
    await nextTick();
    const selected = wrapper.findAll('.ci-file-list__row')
      .filter((r) => r.classes().includes('ci-file-list__row--selected'));
    expect(selected).toHaveLength(1);
    expect(selected[0]!.attributes('aria-pressed')).toBe('true');

    store.focusRow(files[3]!.id);
    await nextTick();
    const tabbable = wrapper.findAll('.ci-file-list__row').filter((r) => r.attributes('tabindex') === '0');
    expect(tabbable).toHaveLength(1);
    expect(tabbable[0]!.text()).toBe(files[3]!.path);
  });

  it('dims non-matches in place rather than hiding rows', () => {
    const store = useCityStore();
    const snapshot = buildSnapshotFixture({ files: 3 });
    store.setCity(snapshot, computeLayout(snapshot));
    const files = snapshot.entities.filter((e) => e.kind === 'file');
    store.setQuery(files[0]!.path);
    const wrapper = mountWithRenderer(makeRendererDouble());
    const rows = wrapper.findAll('.ci-file-list__row');
    expect(rows).toHaveLength(3);   // never hidden
    const dimmed = rows.filter((r) => r.classes().includes('ci-file-list__row--dimmed'));
    expect(dimmed.length).toBe(2);
  });
});
