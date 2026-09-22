import { beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { nextTick } from 'vue';
import '../mocks/obsidian';

vi.mock('../../src/ui/export/download', () => ({ downloadText: vi.fn() }));
import { downloadText } from '../../src/ui/export/download';
import WorkbenchScreen from '../../src/ui/screens/WorkbenchScreen.vue';
import { useCityStore } from '../../src/ui/stores/city-store';
import { useReviewStore } from '../../src/ui/stores/review-store';
import { computeLayout } from '../../src/domain/layout/layout';
import { buildSnapshotFixture } from '../fixtures/snapshot-builder';

const NOW = new Date('2026-09-22T10:00:00Z');
const flush = flushPromises;
function withSnapshot() {
  const snap = buildSnapshotFixture({ files: 12, directories: 2 });
  useCityStore().setCity(snap, computeLayout(snap));
  return snap.entities.filter((e) => e.kind === 'file').map((e) => e.id);
}
const mountW = () => mount(WorkbenchScreen, { attachTo: document.body, global: { provide: { onSelectCodebase: vi.fn() } } });

describe('WorkbenchScreen (Part 4)', () => {
  beforeEach(() => { setActivePinia(createPinia()); vi.mocked(downloadText).mockClear(); });

  it('shows the empty state and four collected cards without any item', () => {
    const w = mountW();
    expect(w.find('.ci-workbench__empty').text()).toContain('No work items yet');
    expect(w.findAll('.ci-metric-card')).toHaveLength(4);
    expect(w.find('.ci-provenance--sample').exists()).toBe(false);
    w.unmount();
  });

  it('shows items on the board by status, and as table rows in the list view', async () => {
    const ids = withSnapshot();
    const review = useReviewStore();
    await review.addWorkItemForFile(ids[0]!, 'A', NOW);
    await review.addWorkItem({ kind: 'file', entityId: ids[1]! }, 'tests', 'B', NOW, { status: 'in-progress' });
    const w = mountW();
    const columns = w.findAll('.ci-work-board__column');
    expect(columns).toHaveLength(4);
    expect(columns[0]!.findAll('.ci-work-card')).toHaveLength(1);
    expect(columns[2]!.findAll('.ci-work-card')).toHaveLength(1);
    await w.find('.ci-workbench__view--list').trigger('click');
    expect(w.find('.ci-workbench__view--list').attributes('aria-pressed')).toBe('true');
    expect(w.findAll('.ci-table__row')).toHaveLength(2);
    await w.find('.ci-workbench__filter').setValue('B');
    expect(w.findAll('.ci-table__row')).toHaveLength(1);
    w.unmount();
  });

  it('edits an item and announces the saved outcome', async () => {
    const ids = withSnapshot();
    await useReviewStore().addWorkItemForFile(ids[0]!, 'A', NOW);
    const w = mountW();
    await w.find('.ci-work-card').trigger('click');
    await w.find('.ci-work-editor__title').setValue('Split the parser');
    await w.find('.ci-work-editor__priority').setValue('high');
    await w.find('.ci-work-editor').trigger('submit');
    await flush();
    expect(useReviewStore().workItems[0]).toMatchObject({ title: 'Split the parser', priority: 'high' });
    expect(w.find('.ci-work-editor').exists()).toBe(false);
    expect(w.find('.ci-workbench__live').text()).toBe('wi-1 updated.');
    w.unmount();
  });

  // E17-style repeat: closing the editor with an identical outcome twice in a row must
  // still be announced (WorkbenchScreen's closeEditor clears liveMessage, then sets it
  // after a tick), not silently kept as unchanged text.
  it('re-announces the same saved outcome on a second identical edit', async () => {
    const ids = withSnapshot();
    await useReviewStore().addWorkItemForFile(ids[0]!, 'A', NOW);
    const w = mountW();
    await w.find('.ci-work-card').trigger('click');
    await w.find('.ci-work-editor__title').setValue('Split the parser');
    await w.find('.ci-work-editor').trigger('submit');
    await flush();
    expect(w.find('.ci-workbench__live').text()).toBe('wi-1 updated.');
    await w.find('.ci-work-card').trigger('click');
    await w.find('.ci-work-editor').trigger('submit');
    await flush();
    expect(w.find('.ci-workbench__live').text()).toBe('wi-1 updated.');
    w.unmount();
  });

  it('refuses Verified until all three checks are done', async () => {
    const ids = withSnapshot();
    await useReviewStore().addWorkItemForFile(ids[0]!, 'A', NOW);
    const w = mountW();
    await w.find('.ci-work-card').trigger('click');
    await w.find('.ci-work-editor__status').setValue('verified');
    await w.find('.ci-work-editor').trigger('submit');
    await flush();
    expect(w.find('.ci-work-editor__error').text()).toBe('Complete all three checks before marking the item Verified.');
    expect(useReviewStore().workItems[0]!.status).toBe('investigate');
    const boxes = w.findAll('.ci-work-editor__check input');
    expect(boxes).toHaveLength(3);
    for (const b of boxes) await b.setValue(true);
    await w.find('.ci-work-editor').trigger('submit');
    await flush();
    expect(useReviewStore().workItems[0]!.status).toBe('verified');
    w.unmount();
  });

  // Fix round 1 (Minor 5): a second, identical refusal must still be announced, not
  // silently kept as unchanged text.
  it('re-announces the same refusal on a second identical submit', async () => {
    const ids = withSnapshot();
    await useReviewStore().addWorkItemForFile(ids[0]!, 'A', NOW);
    const w = mountW();
    await w.find('.ci-work-card').trigger('click');
    await w.find('.ci-work-editor__status').setValue('verified');
    await w.find('.ci-work-editor').trigger('submit');
    await flush();
    expect(w.find('.ci-work-editor__error').text()).toBe('Complete all three checks before marking the item Verified.');
    await w.find('.ci-work-editor').trigger('submit');
    await flush();
    expect(w.find('.ci-work-editor__error').text()).toBe('Complete all three checks before marking the item Verified.');
    w.unmount();
  });

  it('deletes only after the inline confirmation', async () => {
    const ids = withSnapshot();
    await useReviewStore().addWorkItemForFile(ids[0]!, 'A', NOW);
    const w = mountW();
    await w.find('.ci-work-card').trigger('click');
    await w.find('.ci-work-editor__delete').trigger('click');
    expect(useReviewStore().workItems).toHaveLength(1);
    await w.find('.ci-work-editor__keep').trigger('click');
    expect(w.find('.ci-work-editor__delete').exists()).toBe(true);
    await w.find('.ci-work-editor__delete').trigger('click');
    await w.find('.ci-work-editor__confirm-delete').trigger('click');
    await flush();
    expect(useReviewStore().workItems).toHaveLength(0);
    expect(w.find('.ci-workbench__live').text()).toBe('wi-1 deleted.');
    w.unmount();
  });

  it('New work item is aria-disabled without a file selection, and creates for the selection', async () => {
    const ids = withSnapshot();
    const w = mountW();
    const button = w.find('.ci-workbench__new');
    expect(button.attributes('aria-disabled')).toBe('true');
    expect(button.attributes('disabled')).toBeUndefined();
    await button.trigger('click');
    expect(w.find('.ci-work-editor').exists()).toBe(false);
    useCityStore().select(ids[0]!);
    await nextTick();
    expect(w.find('.ci-workbench__new').attributes('aria-disabled')).toBeUndefined();
    await w.find('.ci-workbench__new').trigger('click');
    await w.find('.ci-work-editor__intent').setValue('tests');
    await w.find('.ci-work-editor').trigger('submit');
    await flush();
    expect(useReviewStore().workItems[0]).toMatchObject({ intent: 'tests', target: { kind: 'file', entityId: ids[0] } });
    await w.find('.ci-workbench__new').trigger('click');
    await w.find('.ci-work-editor__intent').setValue('tests');
    await w.find('.ci-work-editor').trigger('submit');
    await flush();
    expect(w.find('.ci-work-editor__error').text()).toBe('This file already has a work item with that intent.');
    expect(useReviewStore().workItems).toHaveLength(1);
    w.unmount();
  });

  // Fix round 1 (Important 1): pinning the create target at the moment "New work item"
  // is pressed. A live `:new-file="selectedFile"` would let a later selection change
  // (a rescan losing the entity, the palette selecting a directory, or just picking a
  // different file) either silently unmount the dialog with `creating` left stuck true
  // (so a LATER selection popped a stale blank editor) or retarget the save mid-edit.
  // Pinning fixes both: the dialog stays open and keeps saving against the file that
  // was selected when it opened, and once it is properly closed a later selection does
  // not reopen it.
  it('pins the create target: a later selection change does not retarget the save, and closing leaves no stuck create flag', async () => {
    const ids = withSnapshot();
    const w = mountW();
    useCityStore().select(ids[0]!);
    await nextTick();
    await w.find('.ci-workbench__new').trigger('click');
    expect(w.find('.ci-work-editor').exists()).toBe(true);
    useCityStore().clearSelection();
    await flush();
    expect(w.find('.ci-work-editor').exists()).toBe(true);
    useCityStore().select(ids[1]!);
    await flush();
    await w.find('.ci-work-editor').trigger('submit');
    await flush();
    expect(useReviewStore().workItems[0]).toMatchObject({ target: { kind: 'file', entityId: ids[0] } });
    expect(w.find('.ci-work-editor').exists()).toBe(false);
    useCityStore().select(ids[2]!);
    await nextTick();
    expect(w.find('.ci-work-editor').exists()).toBe(false);
    w.unmount();
  });

  // Final fix wave: in create mode `busy` used to stay false for the whole save, so a
  // double submit raced past the `hasWorkItem` guard and briefly flashed WORK_DUPLICATE
  // (a false "this file already has a work item" while the FIRST save was still in
  // flight, not because one actually existed). `busy` now also tracks
  // `review.isPending` for the pinned create target, so `save()`'s own `if (busy) return`
  // guard turns the second submit into a no-op and the Save button reads aria-disabled.
  it('does not flash WORK_DUPLICATE on a double submit while creating; the Save button is aria-disabled meanwhile', async () => {
    const ids = withSnapshot();
    const review = useReviewStore();
    let releaseSave: (() => void) | undefined;
    const gate = new Promise<void>((resolve) => { releaseSave = resolve; });
    review.setRepository({
      listWorkItems: () => Promise.resolve([]),
      saveWorkItem: () => gate,
      removeWorkItem: () => Promise.resolve(),
      listRules: () => Promise.resolve([]),
      saveRule: () => Promise.resolve(),
      removeRule: () => Promise.resolve(),
      listDispositions: () => Promise.resolve([]),
      saveDisposition: () => Promise.resolve(),
      removeDisposition: () => Promise.resolve(),
    });
    const w = mountW();
    useCityStore().select(ids[0]!);
    await nextTick();
    await w.find('.ci-workbench__new').trigger('click');
    await w.find('.ci-work-editor__intent').setValue('tests');
    const submit = w.find('.ci-work-editor').trigger('submit');
    await nextTick();
    expect(w.find('.ci-work-editor__save').attributes('aria-disabled')).toBe('true');
    await w.find('.ci-work-editor').trigger('submit');
    await nextTick();
    expect(w.find('.ci-work-editor__error').exists()).toBe(false);
    releaseSave?.();
    await submit;
    await flush();
    expect(review.workItems).toHaveLength(1);
    w.unmount();
  });

  it('exports the plan as Markdown through the leaf document', async () => {
    const ids = withSnapshot();
    await useReviewStore().addWorkItemForFile(ids[0]!, 'A', NOW);
    const w = mountW();
    await w.find('.ci-workbench__export').trigger('click');
    const [host, name, text, mime] = vi.mocked(downloadText).mock.calls[0]!;
    expect(host.classList.contains('ci-screen--workbench')).toBe(true);
    expect(name).toBe('refactor-plan.md');
    expect(text).toContain('## wi-1 — A');
    expect(mime).toBe('text/markdown;charset=utf-8');
    w.unmount();
  });
});
