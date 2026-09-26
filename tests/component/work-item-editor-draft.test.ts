// WP-04 IP22: WorkItemEditor gains an optional `draft` prop, used in create mode only —
// Investigate's own pre-fill for the title and notes fields. Edit mode (an existing item)
// ignores it: the item's own saved title and notes always win.
import { beforeEach, describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import '../mocks/obsidian';
import WorkItemEditor from '../../src/ui/screens/workbench/WorkItemEditor.vue';
import { useCityStore } from '../../src/ui/stores/city-store';
import { useReviewStore } from '../../src/ui/stores/review-store';
import { fileSummariesFor } from '../../src/ui/read-models/file-summaries';
import { WORK_ITEM_TITLE } from '../../src/ui/inspector-copy';
import { computeLayout } from '../../src/domain/layout/layout';
import { buildSnapshotFixture } from '../fixtures/snapshot-builder';

const NOW = new Date('2026-09-25T10:00:00Z');
const DRAFT = { title: 'Investigate UN-1 in file-0.ts', notes: 'Unused exports finding (unused-export) at file-0.ts, Line 1.' };

function withFile() {
  const snap = buildSnapshotFixture({ files: 2, directories: 1 });
  useCityStore().setCity(snap, computeLayout(snap));
  return fileSummariesFor(snap)[0]!;
}

describe('WorkItemEditor draft prop (WP-04 IP22)', () => {
  beforeEach(() => { setActivePinia(createPinia()); });

  it('create mode pre-fills title and notes from the draft', () => {
    const file = withFile();
    const w = mount(WorkItemEditor, { props: { itemId: null, newFile: file, draft: DRAFT } });
    expect((w.find('.ci-work-editor__title').element as HTMLInputElement).value).toBe(DRAFT.title);
    expect((w.find('.ci-work-editor__notes').element as HTMLTextAreaElement).value).toBe(DRAFT.notes);
    w.unmount();
  });

  it('create mode without a draft keeps WORK_ITEM_TITLE(name) and empty notes', () => {
    const file = withFile();
    const w = mount(WorkItemEditor, { props: { itemId: null, newFile: file } });
    expect((w.find('.ci-work-editor__title').element as HTMLInputElement).value).toBe(WORK_ITEM_TITLE(file.name));
    expect((w.find('.ci-work-editor__notes').element as HTMLTextAreaElement).value).toBe('');
    w.unmount();
  });

  it('edit mode ignores the draft: the existing item wins', async () => {
    const file = withFile();
    const review = useReviewStore();
    const item = await review.addWorkItemForFile(file.id, 'Saved title', NOW);
    expect(item).not.toBeNull();
    const w = mount(WorkItemEditor, { props: { itemId: item!.id, newFile: null, draft: DRAFT } });
    expect((w.find('.ci-work-editor__title').element as HTMLInputElement).value).toBe('Saved title');
    expect((w.find('.ci-work-editor__notes').element as HTMLTextAreaElement).value).toBe('');
    w.unmount();
  });
});
