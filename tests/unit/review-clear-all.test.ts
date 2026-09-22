// Part 5 V32 (Part 4 E22 "the untested clearAll race and rethrow"): clearAll attempts every
// removal, reloads from the port, and rethrows the FIRST rejection in removal order; and a
// clear racing a pending update leaves neither a ghost item nor a stuck pending id.
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
  beforeEach(() => { setActivePinia(createPinia()); });

  it('attempts every removal when two reject, reloads what the port still holds, and rethrows the first in removal order', async () => {
    const { store, inner } = await seeded();
    const first = new Error('work item wi-1');
    const second = new Error('rule AR-001');
    // wi-1's rejection settles LAST in time, the rule's first: "first" means removal order.
    let failLate: ((e: Error) => void) | undefined;
    const late = new Promise<void>((_, reject) => { failLate = reject; });
    const port = {
      ...inner,
      removeWorkItem: vi.fn((id: string) => (id === 'wi-1' ? late : inner.removeWorkItem(id))),
      removeRule: vi.fn((id: string) => (id === 'AR-001' ? Promise.reject(second) : inner.removeRule(id))),
      removeDisposition: vi.fn((fingerprint: string) => inner.removeDisposition(fingerprint)),
      listWorkItems: vi.fn(() => inner.listWorkItems()),
    };
    store.setRepository(port);
    const clearing = store.clearAll();
    failLate?.(first);
    await expect(clearing).rejects.toBe(first);
    expect(port.removeWorkItem.mock.calls.map(([id]) => id).sort()).toEqual(['wi-1', 'wi-2']);
    expect(port.removeRule).toHaveBeenCalledWith('AR-001');
    expect(port.removeDisposition).toHaveBeenCalledWith('e1#CX-1');
    expect(port.listWorkItems).toHaveBeenCalledOnce();
    expect(store.workItems.map((w) => w.id)).toEqual(['wi-1']);
    expect(store.rules.map((r) => r.id)).toEqual(['AR-001']);
    expect(store.dispositions).toHaveLength(0);
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
    expect(store.pendingItemIds).toEqual([]);
    expect(store.isItemPending('wi-1')).toBe(false);
  });
});
