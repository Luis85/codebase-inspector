import { beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { nextTick } from 'vue';
import FileInspector from '../../src/ui/components/FileInspector.vue';
import { useCityStore } from '../../src/ui/stores/city-store';
import { useReviewStore } from '../../src/ui/stores/review-store';
import { createInMemoryReviewRepository } from '../../src/ui/stores/ports/review-repository';
import { computeLayout } from '../../src/domain/layout/layout';
import { buildSnapshotFixture } from '../../tests/fixtures/snapshot-builder';
import { CITY_RENDERER_KEY } from '../../src/ui/renderer-handle';

function makeRendererDouble() {
  return {
    setLayout: vi.fn(async () => {}),
    setColors: vi.fn(), setSelection: vi.fn(), setFilter: vi.fn(), setReported: vi.fn(), setRelations: vi.fn(), setLabels: vi.fn(),
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

  it('adds the selected file to the refactor plan once', async () => {
    const { target } = openWithFile();
    const wrapper = mountInspector();
    // Selects by class, not aria-label (fix round 1, Minor 2): the label flips to
    // "In refactor plan" once added, so aria-label must flip with it (WCAG 2.5.3) —
    // an aria-label selector would stop matching after the click.
    const add = wrapper.find('.ci-inspector__plan-button');
    await add.trigger('click');
    await nextTick();
    expect(useReviewStore().hasWorkItemFor(target.id)).toBe(true);
    const addAfter = wrapper.find('.ci-inspector__plan-button');
    expect(addAfter.attributes('disabled')).toBeDefined();
    expect(addAfter.attributes('aria-label')).toBe('In refactor plan');
    expect(wrapper.text()).toContain('In refactor plan');
  });

  it('shows a failure message and stays enabled when the repository rejects the add', async () => {
    const { target } = openWithFile();
    useReviewStore().setRepository({ ...createInMemoryReviewRepository(), saveWorkItem: () => Promise.reject(new Error('disk full')) });
    const wrapper = mountInspector();
    await wrapper.find('.ci-inspector__plan-button').trigger('click');
    await flushPromises();
    expect(useReviewStore().hasWorkItemFor(target.id)).toBe(false);
    expect(wrapper.find('.ci-inspector__plan-button').attributes('disabled')).toBeUndefined();
    expect(wrapper.get('[aria-live]').text()).toContain('Could not add this file to the refactor plan.');
  });

  // Fix round 2 (Important, regression from round 1): the store now refuses a second
  // overlapping call, but the BUTTON must reflect that too — otherwise a real
  // double-click still fires `addToPlan` twice from the UI's own point of view before
  // either resolves. Verifies the pending-disable wiring, not the store's own guard
  // (that's tests/unit/review-store.test.ts's job).
  it('disables the plan button while the save is pending, so a double click cannot fire it twice', async () => {
    const { target } = openWithFile();
    let releaseSave: (() => void) | undefined;
    const gate = new Promise<void>((resolve) => { releaseSave = resolve; });
    useReviewStore().setRepository({ ...createInMemoryReviewRepository(), saveWorkItem: () => gate });
    const wrapper = mountInspector();
    const button = wrapper.find('.ci-inspector__plan-button');
    await button.trigger('click');
    expect(wrapper.find('.ci-inspector__plan-button').attributes('disabled')).toBeDefined();
    await wrapper.find('.ci-inspector__plan-button').trigger('click');
    releaseSave?.();
    await flushPromises();
    expect(useReviewStore().workItemCount).toBe(1);
    expect(useReviewStore().hasWorkItemFor(target.id)).toBe(true);
  });

  // Task 9: "Investigate file" opens the File detail screen for the selected entity,
  // keeping the selection and never moving the camera — the same invariant every
  // other path into File detail (palette, hotspot row) holds.
  it('Investigate file navigates to File detail, keeping the selection and the camera', async () => {
    const { store, target } = openWithFile();
    const wrapper = mountInspector();
    await wrapper.find('.ci-inspector__investigate').trigger('click');
    expect(store.route).toBe('file');
    expect(store.selectedEntityId).toBe(target.id);
    expect(store.camera).toBeNull();
  });

  // Task 9 (F12): C10's own contract says "Keep exact raw values and scope", and
  // foundations/04 says "Preserve the full path through wrapping, a copy action, and
  // accessible text. Do not expose crucial content only in an ellipsis tooltip." The
  // inspector used to show only `selectedEntity.name` (the basename) in its header —
  // never the full relative path, and never the scope those measurements were taken in.
  describe('the full path and scope (F12, C10, foundations/04)', () => {
    it('shows the full path, wrapped, not only the basename', () => {
      // `directories: 1` (unlike `openWithFile`'s flat default) so `target.path`
      // ("dir-0/file-0.ts") genuinely differs from `target.name` ("file-0.ts") —
      // a flat fixture would let a basename-only regression pass this test by
      // accident, since the two strings would be identical either way.
      const store = useCityStore();
      const snapshot = buildSnapshotFixture({ files: 2, directories: 1 });
      store.setCity(snapshot, computeLayout(snapshot));
      const target = snapshot.entities.find((e) => e.kind === 'file')!;
      store.select(target.id);
      store.openInspector();
      const wrapper = mountInspector();
      // `toBe`, not `toContain` — a substring check cannot fail against a basename
      // that happens to be a suffix of the full path (the hazard note's own shape).
      expect(wrapper.find('.ci-inspector__path').text()).toBe(target.path);
      expect(target.path).not.toBe(target.name);
    });

    it('keeps the full path as accessible text rather than an ellipsis tooltip', () => {
      // foundations/04: "Do not expose crucial content only in an ellipsis tooltip."
      openWithFile();
      const wrapper = mountInspector();
      const el = wrapper.find('.ci-inspector__path').element as HTMLElement;
      expect(getComputedStyle(el).textOverflow).not.toBe('ellipsis');
    });

    it('names the scope the values were measured in, redacted to a basename', () => {
      // C10: "Keep exact raw values and scope." A line count with no scope is a
      // number whose denominator the user cannot check. Redacted the same way
      // SnapshotStatus.vue's own scope line is (interactions/04-microcopy.md:
      // "redact local absolute paths by default") — `toBe`, not `toContain('root')`,
      // because `toContain('root')` would pass whether this is correctly redacted to
      // "Scope: root" or leaks the raw "/fixture/root" (both contain "root").
      openWithFile();
      const wrapper = mountInspector();
      const scope = wrapper.find('.ci-inspector__scope');
      expect(scope.exists()).toBe(true);
      expect(scope.text()).toBe('Scope: root');
      expect(scope.text()).not.toContain('/fixture');
    });

    it('offers Copy relative path ALONGSIDE the visible path, not instead of it', () => {
      // foundations/04 asks for wrapping AND a copy action, not one or the other —
      // the existing Copy action must still be present once the path is shown.
      openWithFile();
      const wrapper = mountInspector();
      expect(wrapper.find('.ci-inspector__path').exists()).toBe(true);
      expect(wrapper.find('[aria-label="Copy relative path"]').exists()).toBe(true);
    });
  });
});
