import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { nextTick } from 'vue';
import FileInspector from '../../src/ui/components/FileInspector.vue';
import { useCityStore } from '../../src/ui/stores/city-store';
import { computeLayout } from '../../src/domain/layout/layout';
import { buildSnapshotFixture } from '../../tests/fixtures/snapshot-builder';
import { CITY_RENDERER_KEY } from '../../src/ui/renderer-handle';

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

function openWithFile(measuredZero = 0, unavailable = 0) {
  const store = useCityStore();
  const snapshot = buildSnapshotFixture({ files: 3, measuredZero, unavailable });
  store.setCity(snapshot, computeLayout(snapshot));
  const files = snapshot.entities.filter((e) => e.kind === 'file');
  const target = unavailable > 0 ? files[measuredZero]! : files[0]!;
  store.select(target.id);
  store.openInspector();
  return { store, snapshot, target };
}

describe('FileInspector.vue (C10)', () => {
  let clipboardDouble: { writeText: ReturnType<typeof vi.fn> };
  let rendererDouble: ReturnType<typeof makeRendererDouble>;

  beforeEach(() => {
    setActivePinia(createPinia());
    clipboardDouble = { writeText: vi.fn(async () => {}) };
    rendererDouble = makeRendererDouble();
  });

  function mountInspector() {
    return mount(FileInspector, {
      global: {
        provide: {
          clipboard: clipboardDouble,
          [CITY_RENDERER_KEY as symbol]: { value: rendererDouble },
        },
      },
    });
  }

  it('shows the RAW values, always — raw lines and bytes, not scaled height', () => {
    openWithFile();
    const wrapper = mountInspector();
    // file-0.ts gets 10 lines from buildSnapshotFixture's own default formula
    // (10 + i, i = 0), and 200 bytes (lines * 20) — both raw source-unit counts,
    // never the sqrt-scaled scene height layout.ts computed for the same file.
    expect(wrapper.text()).toContain('10 lines');
    expect(wrapper.text()).toContain('200 bytes');
  });

  it('surfaces the REASON for an unavailable measurement', () => {
    openWithFile(0, 1);
    const wrapper = mountInspector();
    expect(wrapper.text()).toContain('Not measured.');
    expect(wrapper.text()).toContain('binary content: physical lines are not defined');
  });

  it('offers Focus and Copy relative path, and NOTHING that opens the source', () => {
    openWithFile();
    const wrapper = mountInspector();
    expect(wrapper.find('[aria-label="Copy relative path"]').exists()).toBe(true);
    expect(wrapper.find('[aria-label="Focus"]').exists()).toBe(true);
    expect(wrapper.text()).not.toMatch(/open in|reveal in|editor/i);
  });

  it('Focus drives the renderer with the selected entity', async () => {
    const { target } = openWithFile();
    const wrapper = mountInspector();
    await wrapper.get('[aria-label="Focus"]').trigger('click');
    expect(rendererDouble.focus).toHaveBeenCalledWith(target.id);
  });

  it('shows COPY-27 after a successful copy', async () => {
    openWithFile();
    const wrapper = mountInspector();
    await wrapper.get('[aria-label="Copy relative path"]').trigger('click');
    await nextTick();
    const live = wrapper.get('[aria-live]');
    expect(live.text()).toContain('Relative path copied.');
  });

  it('offers a USABLE ALTERNATIVE when the clipboard fails', async () => {
    const { target } = openWithFile();
    clipboardDouble.writeText.mockRejectedValue(new Error('denied'));
    const wrapper = mountInspector();
    await wrapper.get('[aria-label="Copy relative path"]').trigger('click');
    await nextTick();
    const fallback = wrapper.get('input[readonly]');
    expect((fallback.element as HTMLInputElement).value).toBe(target.path);
  });

  it('closing it PRESERVES the selection', async () => {
    const { store } = openWithFile();
    const wrapper = mountInspector();
    await wrapper.get('[aria-label="Close"]').trigger('click');
    expect(store.inspectorOpen).toBe(false);
    expect(store.selectedEntityId).not.toBeNull();
  });
});
