import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
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

  it('puts no role=tree on an incomplete implementation', () => {
    const store = useCityStore();
    const snapshot = buildSnapshotFixture({ files: 3, directories: 2 });
    store.setCity(snapshot, computeLayout(snapshot));
    const wrapper = mountWithRenderer(makeRendererDouble());
    expect(wrapper.find('[role="tree"]').exists()).toBe(false);
  });

  it('drives the canvas through setSelection when a row is activated', async () => {
    const store = useCityStore();
    const snapshot = buildSnapshotFixture({ files: 2 });
    store.setCity(snapshot, computeLayout(snapshot));
    const rendererDouble = makeRendererDouble();
    const wrapper = mountWithRenderer(rendererDouble);
    const row = wrapper.get('.ci-file-list__row');
    await row.trigger('click');
    const fileEntity = snapshot.entities.find((e) => e.kind === 'file')!;
    expect(rendererDouble.setSelection).toHaveBeenCalledWith(fileEntity.id);
    expect(store.selectedEntityId).toBe(fileEntity.id);
  });

  it('does not select on mere focus movement', async () => {
    const store = useCityStore();
    const snapshot = buildSnapshotFixture({ files: 2 });
    store.setCity(snapshot, computeLayout(snapshot));
    const rendererDouble = makeRendererDouble();
    const wrapper = mountWithRenderer(rendererDouble);
    const row = wrapper.get('.ci-file-list__row');
    await row.trigger('focus');
    expect(rendererDouble.setSelection).not.toHaveBeenCalled();
    expect(store.selectedEntityId).toBeNull();
  });

  it('shows COPY-11 when nothing matches', () => {
    const store = useCityStore();
    const snapshot = buildSnapshotFixture({ files: 4 });
    store.setCity(snapshot, computeLayout(snapshot));
    store.setQuery('nothing-matches-any-of-these');
    const wrapper = mountWithRenderer(makeRendererDouble());
    expect(wrapper.text()).toContain('No matching files. The snapshot still contains');
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
