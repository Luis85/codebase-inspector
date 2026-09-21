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
});
