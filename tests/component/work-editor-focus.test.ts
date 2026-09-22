// Part 5 V32 (Part 4 E22 "untested editor focus moves"): Delete moves focus to the
// confirm button, Keep returns it to Delete, and deleting the item whose card opened the
// editor lands focus on the filter — never the shell, never <body>.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { nextTick } from 'vue';
import '../mocks/obsidian';
import WorkbenchScreen from '../../src/ui/screens/WorkbenchScreen.vue';
import { useCityStore } from '../../src/ui/stores/city-store';
import { useReviewStore } from '../../src/ui/stores/review-store';
import { computeLayout } from '../../src/domain/layout/layout';
import { buildSnapshotFixture } from '../fixtures/snapshot-builder';

const NOW = new Date('2026-09-22T10:00:00Z');
async function withItems(count: number): Promise<void> {
  const snap = buildSnapshotFixture({ files: 12, directories: 2 });
  useCityStore().setCity(snap, computeLayout(snap));
  const ids = snap.entities.filter((e) => e.kind === 'file').map((e) => e.id);
  for (let i = 0; i < count; i += 1) await useReviewStore().addWorkItemForFile(ids[i]!, `Item ${i + 1}`, NOW);
}
/** A focusable `.ci-shell` around the screen, as App.vue provides, so CiDialog's real
 *  fallback (focus the shell when the opener is gone) runs. */
function mountInShell() {
  const shell = document.body.createDiv({ cls: 'ci-shell' });
  shell.tabIndex = -1;
  const w = mount(WorkbenchScreen, { attachTo: shell, global: { provide: { onSelectCodebase: vi.fn() } } });
  return { w, done: () => { w.unmount(); shell.remove(); } };
}
/** Opens the first card's editor the way a keyboard user does: the card has focus. */
async function openFirstCard(w: ReturnType<typeof mountInShell>['w']): Promise<Element> {
  const card = w.find('.ci-work-card');
  (card.element as HTMLElement).focus();
  await card.trigger('click');
  await nextTick();
  return card.element;
}

describe('Work-item editor focus (Part 5 V32)', () => {
  beforeEach(() => { setActivePinia(createPinia()); });

  it('Delete moves focus to the confirm button', async () => {
    await withItems(1);
    const { w, done } = mountInShell();
    await openFirstCard(w);
    await w.find('.ci-work-editor__delete').trigger('click');
    await nextTick();
    expect(document.activeElement).toBe(w.find('.ci-work-editor__confirm-delete').element);
    done();
  });

  it('Keep returns focus to Delete', async () => {
    await withItems(1);
    const { w, done } = mountInShell();
    await openFirstCard(w);
    await w.find('.ci-work-editor__delete').trigger('click');
    await nextTick();
    await w.find('.ci-work-editor__keep').trigger('click');
    await nextTick();
    expect(document.activeElement).toBe(w.find('.ci-work-editor__delete').element);
    done();
  });

  it('deleting the item whose card opened the editor lands focus on the filter, not the shell', async () => {
    await withItems(2);
    const { w, done } = mountInShell();
    const opener = await openFirstCard(w);
    await w.find('.ci-work-editor__delete').trigger('click');
    await w.find('.ci-work-editor__confirm-delete').trigger('click');
    await flushPromises();
    expect(w.find('.ci-work-editor').exists()).toBe(false);
    expect(opener.isConnected, 'the opener card went with its item').toBe(false);
    expect(w.findAll('.ci-work-card'), 'the other item still has a card').toHaveLength(1);
    expect(document.activeElement).toBe(w.find('.ci-workbench__filter').element);
    done();
  });
});
