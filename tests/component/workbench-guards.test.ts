// Part 5 V32: the X6 `removing` guard under a real concurrent removal, New work item's
// description, and the observed '' between two identical outcomes (Part 4 E18).
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { nextTick } from 'vue';
import '../mocks/obsidian';
import WorkbenchScreen from '../../src/ui/screens/WorkbenchScreen.vue';
import { useCityStore } from '../../src/ui/stores/city-store';
import { useReviewStore } from '../../src/ui/stores/review-store';
import { createInMemoryReviewRepository } from '../../src/ui/stores/ports/review-repository';
import { computeLayout } from '../../src/domain/layout/layout';
import { buildSnapshotFixture } from '../fixtures/snapshot-builder';
import { WORKBENCH_NEW_HINT } from '../../src/ui/inspector-copy';

const NOW = new Date('2026-09-22T10:00:00Z');
function withSnapshot() {
  const snap = buildSnapshotFixture({ files: 12, directories: 2 });
  useCityStore().setCity(snap, computeLayout(snap));
  return snap.entities.filter((e) => e.kind === 'file').map((e) => e.id);
}
const mountW = () => mount(WorkbenchScreen, { attachTo: document.body, global: { provide: { onSelectCodebase: vi.fn() } } });

/** Every text the region was set to, in order. It is read from the mutation records
 *  themselves (the nodes each write added), not from the live DOM when the callback
 *  runs, so two writes that land before one callback are still two entries. A write
 *  that empties the region adds no node and is recorded as ''. */
function textHistory(el: Element): { seen: string[]; stop: () => void } {
  const seen: string[] = [];
  const take = (records: MutationRecord[]): void => {
    for (const r of records) {
      if (r.type === 'characterData') seen.push((r.target.textContent ?? '').trim());
      else seen.push(Array.from(r.addedNodes).map((n) => n.textContent ?? '').join('').trim());
    }
  };
  const observer = new MutationObserver(take);
  observer.observe(el, { childList: true, characterData: true, subtree: true });
  return { seen, stop: () => { take(observer.takeRecords()); observer.disconnect(); } };
}

describe('Workbench guards (Part 5 V32)', () => {
  beforeEach(() => { setActivePinia(createPinia()); });

  // Controller ruling Part 5 E3 (amendment P1, Task 14(e)): does NOT use clearAll to make
  // the item vanish by another path — clearAll now refuses while a delete is pending
  // (Task 8), so it could no longer stand in for a concurrent removal here. The store's
  // `workItems` is mutated directly instead, the same observable effect a second path's
  // removal (e.g. WP-05's durable adapter reconciling from disk) would have.
  it('X6: an item removed by another path while its delete is in flight is still announced exactly once, and the editor closes', async () => {
    const ids = withSnapshot();
    const review = useReviewStore();
    const inner = createInMemoryReviewRepository();
    let release: (() => void) | undefined;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    let removals = 0;
    // The editor's own removal waits on the gate.
    review.setRepository({
      ...inner,
      removeWorkItem: (id) => { removals += 1; return gate.then(() => inner.removeWorkItem(id)); },
    });
    await review.addWorkItemForFile(ids[0]!, 'A', NOW);
    const w = mountW();
    const live = w.find('.ci-workbench__live').element;
    const history = textHistory(live);
    await w.find('.ci-work-card').trigger('click');
    await w.find('.ci-work-editor__delete').trigger('click');
    await w.find('.ci-work-editor__confirm-delete').trigger('click');
    expect(review.isItemPending('wi-1')).toBe(true);
    // Another path takes the item away first, while the editor's own delete is still gated.
    review.workItems = review.workItems.filter((item) => item.id !== 'wi-1');
    await nextTick();
    expect(w.find('.ci-work-editor').exists(), 'the X6 guard keeps the removing editor open').toBe(true);
    release?.();
    await flushPromises();
    history.stop();
    expect(removals).toBe(1);
    expect(w.find('.ci-work-editor').exists()).toBe(false);
    expect(live.textContent?.trim()).toBe('wi-1 deleted.');
    expect(history.seen.filter((t) => t === 'wi-1 deleted.')).toHaveLength(1);
    w.unmount();
  });

  it('New work item is described by its hint: aria-describedby names the hint paragraph\'s id', () => {
    const w = mountW();
    const hint = w.find('.ci-workbench__new-hint');
    const id = hint.attributes('id') ?? '';
    expect(id).not.toBe('');
    expect(w.find('.ci-workbench__new').attributes('aria-describedby')).toBe(id);
    expect(hint.text()).toBe(WORKBENCH_NEW_HINT);
    w.unmount();
  });

  it('Part 4 E18: a second identical outcome passes through an empty live region before it is set again', async () => {
    const ids = withSnapshot();
    await useReviewStore().addWorkItemForFile(ids[0]!, 'A', NOW);
    const w = mountW();
    await w.find('.ci-work-card').trigger('click');
    await w.find('.ci-work-editor').trigger('submit');
    await flushPromises();
    const live = w.find('.ci-workbench__live').element;
    expect(live.textContent?.trim()).toBe('wi-1 updated.');
    const history = textHistory(live);
    await w.find('.ci-work-card').trigger('click');
    await w.find('.ci-work-editor').trigger('submit');
    await flushPromises();
    history.stop();
    expect(history.seen).toEqual(['', 'wi-1 updated.']);
    w.unmount();
  });
});
