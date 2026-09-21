import { beforeEach, describe, expect, it } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { useReviewStore } from '../../src/ui/stores/review-store';
import { createInMemoryReviewRepository } from '../../src/ui/stores/ports/review-repository';

const NOW = new Date('2026-09-21T10:00:00.000Z');

describe('review store', () => {
  beforeEach(() => { setActivePinia(createPinia()); });

  it('adds one work item per file and persists it through the port', async () => {
    const repo = createInMemoryReviewRepository();
    const store = useReviewStore();
    store.setRepository(repo);
    const item = await store.addWorkItemForFile('e1', 'Investigate a.ts', NOW);
    expect(item?.status).toBe('investigate');
    expect(item?.createdAt).toBe(NOW.toISOString());
    expect(store.workItemCount).toBe(1);
    expect(store.hasWorkItemFor('e1')).toBe(true);
    expect(await repo.listWorkItems()).toHaveLength(1);
  });

  it('refuses a duplicate for the same file', async () => {
    const store = useReviewStore();
    await store.addWorkItemForFile('e1', 'x', NOW);
    expect(await store.addWorkItemForFile('e1', 'y', NOW)).toBeNull();
    expect(store.workItemCount).toBe(1);
  });

  it('loads what the repository already holds, and removes through it', async () => {
    const repo = createInMemoryReviewRepository();
    await repo.saveWorkItem({ id: 'w1', entityId: 'e9', title: 't', status: 'planned', createdAt: NOW.toISOString() });
    const store = useReviewStore();
    store.setRepository(repo);
    await store.load();
    expect(store.hasWorkItemFor('e9')).toBe(true);
    await store.removeWorkItem('w1');
    expect(store.workItemCount).toBe(0);
    expect(await repo.listWorkItems()).toHaveLength(0);
  });

  it('generates the next ID correctly when repository has gaps in numeric suffixes', async () => {
    const repo = createInMemoryReviewRepository();
    await repo.saveWorkItem({ id: 'wi-3', entityId: 'e1', title: 't1', status: 'investigate', createdAt: NOW.toISOString() });
    await repo.saveWorkItem({ id: 'wi-5', entityId: 'e2', title: 't2', status: 'investigate', createdAt: NOW.toISOString() });
    const store = useReviewStore();
    store.setRepository(repo);
    await store.load();
    const newItem = await store.addWorkItemForFile('e3', 't3', NOW);
    expect(newItem?.id).toBe('wi-6');
    expect(await repo.listWorkItems()).toHaveLength(3);
  });

  // Fix round 1 (Important): a rejecting repository must leave local state untouched
  // and the rejection must propagate — the port is the source of truth, not an
  // afterthought fired off after the UI has already committed to showing the item.
  it('leaves state unchanged and rejects when the repository refuses to save', async () => {
    const repo = createInMemoryReviewRepository();
    const store = useReviewStore();
    store.setRepository({ ...repo, saveWorkItem: () => Promise.reject(new Error('save failed')) });
    await expect(store.addWorkItemForFile('e1', 't', NOW)).rejects.toThrow('save failed');
    expect(store.workItemCount).toBe(0);
    expect(store.hasWorkItemFor('e1')).toBe(false);
    // A retry after the failure must not have consumed an id/skipped a slot.
    store.setRepository(repo);
    const item = await store.addWorkItemForFile('e1', 't', NOW);
    expect(item?.id).toBe('wi-1');
  });

  it('leaves state unchanged and rejects when the repository refuses to remove', async () => {
    const repo = createInMemoryReviewRepository();
    const store = useReviewStore();
    store.setRepository(repo);
    await store.addWorkItemForFile('e1', 't', NOW);
    store.setRepository({ ...repo, removeWorkItem: () => Promise.reject(new Error('remove failed')) });
    await expect(store.removeWorkItem('wi-1')).rejects.toThrow('remove failed');
    expect(store.workItemCount).toBe(1);
    expect(store.hasWorkItemFor('e1')).toBe(true);
  });
});
