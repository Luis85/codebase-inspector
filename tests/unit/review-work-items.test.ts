import { beforeEach, describe, expect, it } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { useReviewStore } from '../../src/ui/stores/review-store';
import {
  createInMemoryReviewRepository, NO_CHECKS, WORK_NOTES_MAX, WORK_TITLE_MAX, workItemProblem, type ReviewRepository,
} from '../../src/ui/stores/ports/review-repository';

const NOW = new Date('2026-09-22T10:00:00Z');
const LATER = new Date('2026-09-22T11:00:00Z');
const file = (entityId: string) => ({ kind: 'file' as const, entityId });

async function withItem() {
  const store = useReviewStore();
  const item = await store.addWorkItemForFile('e1', 'Split the parser', NOW);
  return { store, id: item!.id };
}

describe('editable work items (Part 4 W8/W9)', () => {
  beforeEach(() => { setActivePinia(createPinia()); });

  it('creates items with medium priority, empty notes and no checks, or with the given init', async () => {
    const store = useReviewStore();
    const a = await store.addWorkItemForFile('e1', 't', NOW);
    expect(a).toMatchObject({ priority: 'medium', notes: '', checks: NO_CHECKS, status: 'investigate' });
    const b = await store.addWorkItem(file('e1'), 'tests', 't2', NOW, { priority: 'high', notes: 'why' });
    expect(b).toMatchObject({ priority: 'high', notes: 'why' });
    const c = await store.addWorkItem(file('e1'), 'documentation', 't3', NOW, { status: 'verified', checks: [true, false, false] });
    expect(c).toBeNull();
    const d = await store.addWorkItem(file('e1'), 'documentation', 't3', NOW, { status: 'verified', checks: [true, true, true] });
    expect(d).toMatchObject({ status: 'verified' });
  });

  it('updates title, status, priority, notes and checks, trimming the title and stamping updatedAt', async () => {
    const { store, id } = await withItem();
    const next = await store.updateWorkItem(id, { title: '  Split parser  ', status: 'planned', priority: 'low', notes: 'n', checks: [true, false, false] }, LATER);
    expect(next).toMatchObject({ title: 'Split parser', status: 'planned', priority: 'low', notes: 'n', checks: [true, false, false], updatedAt: LATER.toISOString() });
    expect(store.workItems[0]).toEqual(next);
  });

  it('refuses verified until all three checks are done, in the store', async () => {
    const { store, id } = await withItem();
    expect(await store.updateWorkItem(id, { status: 'verified', checks: [true, true, false] }, LATER)).toBeNull();
    expect(store.workItems[0]!.status).toBe('investigate');
    expect(await store.updateWorkItem(id, { status: 'verified', checks: [true, true, true] }, LATER)).not.toBeNull();
  });

  it('refuses an empty or over-long title and over-long notes', async () => {
    const { store, id } = await withItem();
    expect(await store.updateWorkItem(id, { title: '   ' }, LATER)).toBeNull();
    expect(await store.updateWorkItem(id, { title: 'x'.repeat(WORK_TITLE_MAX + 1) }, LATER)).toBeNull();
    expect(await store.updateWorkItem(id, { notes: 'x'.repeat(WORK_NOTES_MAX + 1) }, LATER)).toBeNull();
    expect(await store.updateWorkItem('nope', { title: 'a' }, LATER)).toBeNull();
    expect(workItemProblem({ title: 'a', notes: '', status: 'verified', checks: NO_CHECKS })).toBe('unverified');
  });

  it('persists before mutating: a rejecting port leaves the item unchanged and the rejection propagates', async () => {
    const { store, id } = await withItem();
    const repo: ReviewRepository = { ...createInMemoryReviewRepository(), saveWorkItem: () => Promise.reject(new Error('disk')) };
    store.setRepository(repo);
    await expect(store.updateWorkItem(id, { title: 'b' }, LATER)).rejects.toThrow('disk');
    expect(store.workItems[0]!.title).toBe('Split the parser');
    expect(store.isItemPending(id)).toBe(false);
  });

  it('is pending-aware per id for update and remove', async () => {
    // Both guard checks below are made synchronously, in the same tick as the pending
    // reservation, rather than after an intervening `await`: Pinia wraps every action's
    // returned promise in its own `.then()` (for $onAction), which adds a tick to a
    // refused call's resolution that a call already past its own internal await does not
    // pay again — awaiting one guard check before issuing the next let that extra tick
    // change which one observed the guard first.
    const { store, id } = await withItem();
    const first = store.updateWorkItem(id, { title: 'b' }, LATER);
    expect(store.isItemPending(id)).toBe(true);
    const secondUpdate = store.updateWorkItem(id, { title: 'c' }, LATER);
    const removedWhilePending = store.removeWorkItem(id);
    expect(await secondUpdate).toBeNull();
    expect(await removedWhilePending).toBe(false);
    await first;
    expect(await store.removeWorkItem(id)).toBe(true);
    expect(store.workItems).toHaveLength(0);
  });

  it('counts open (not verified) items and clears everything through the port', async () => {
    const { store, id } = await withItem();
    await store.addWorkItemForFile('e2', 't', NOW);
    await store.updateWorkItem(id, { status: 'verified', checks: [true, true, true] }, LATER);
    expect(store.openWorkItemCount).toBe(1);
    await store.addRule('a', 'b', 'why', NOW);
    await store.acknowledge('e1#CX-1', NOW);
    await store.clearAll();
    expect(store.workItems).toHaveLength(0);
    expect(store.rules).toHaveLength(0);
    expect(store.dispositions).toHaveLength(0);
    expect(await store.repository.listWorkItems()).toHaveLength(0);
  });
});
