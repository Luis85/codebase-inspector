// Part 5 V32 (Part 4 E22 "the untested clearAll race and rethrow"), amended by Part 6 R1:
// clearAll is one atomic port replace that reloads from the port and rethrows its rejection;
// and a clear racing a pending update leaves neither a ghost item nor a stuck pending id.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { useReviewStore } from '../../src/ui/stores/review-store';
import { createInMemoryReviewRepository } from '../../src/ui/stores/ports/review-repository';

const NOW = new Date('2026-09-22T10:00:00Z');

/** Two work items (wi-1, wi-2), one rule (AR-001) and one disposition, held by `inner`. */
async function seeded() {
  const inner = createInMemoryReviewRepository();
  const store = useReviewStore();
  store.setRepository(inner);
  await store.addWorkItemForFile('e1', 'One', NOW);
  await store.addWorkItemForFile('e2', 'Two', NOW);
  await store.addRule('a', 'b', 'why', NOW);
  await store.acknowledge('e1#CX-1', NOW);
  return { store, inner };
}

describe('review-store clearAll (Part 5 V32)', () => {
  beforeEach(async () => { setActivePinia(createPinia()); await useReviewStore().bindRepository('repo-t'); }); // Part 6 Y14

  // Part 6 R1: ONE port replace with empty arrays, all or nothing. A rejection leaves every
  // record in the port, the reload shows them, and the rejection propagates. (Until Part 6
  // this pinned per-removal allSettled: two rejections, first in removal order.)
  it('clears through one port replace; a rejection keeps everything, reloads it and rethrows', async () => {
    const { store, inner } = await seeded();
    const failure = new Error('disk full');
    const port = {
      ...inner,
      replaceAll: vi.fn(() => Promise.reject(failure)),
      removeWorkItem: vi.fn((id: string) => inner.removeWorkItem(id)),
      listWorkItems: vi.fn(() => inner.listWorkItems()),
    };
    store.setRepository(port);
    await expect(store.clearAll()).rejects.toBe(failure);
    expect(port.replaceAll).toHaveBeenCalledOnce();
    expect(port.replaceAll).toHaveBeenCalledWith({ workItems: [], rules: [], dispositions: [] });
    expect(port.removeWorkItem).not.toHaveBeenCalled();
    expect(port.listWorkItems).toHaveBeenCalledOnce();
    expect(store.workItems.map((w) => w.id)).toEqual(['wi-1', 'wi-2']);
    expect(store.rules.map((r) => r.id)).toEqual(['AR-001']);
    expect(store.dispositions.map((d) => d.fingerprint)).toEqual(['e1#CX-1']);
    expect(store.bulkBusy).toBe(false);
  });

  // Controller ruling Part 5 E3 (amendment P1, Task 14(b)): clearAll() now REFUSES while
  // a change is pending (Task 8), so this no longer races clearAll against the port — it
  // asserts the refusal itself, that the port is left untouched, and that nothing reappears
  // (or goes missing) once the pending save settles and the store reloads.
  it('a clear during a pending update is refused; the port keeps both items and nothing reappears after load()', async () => {
    const { store, inner } = await seeded();
    let release: (() => void) | undefined;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    store.setRepository({ ...inner, saveWorkItem: (item) => gate.then(() => inner.saveWorkItem(item)) });
    const update = store.updateWorkItem('wi-1', { title: 'Renamed' }, NOW);
    expect(store.isItemPending('wi-1')).toBe(true);
    expect(await store.clearAll()).toBe(false);
    expect((await inner.listWorkItems()).map((w) => w.id).sort()).toEqual(['wi-1', 'wi-2']);
    expect(store.workItems.map((w) => w.id).sort(), 'clearAll must not have touched the port or the state').toEqual(['wi-1', 'wi-2']);
    release?.();
    await update;
    await flushPromises();
    await store.load();
    expect(store.workItems.map((w) => w.id).sort(), 'nothing reappears and nothing goes missing').toEqual(['wi-1', 'wi-2']);
    expect(store.hasPendingChanges).toBe(false);
    expect(store.isItemPending('wi-1')).toBe(false);
  });
});
