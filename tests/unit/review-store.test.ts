import { beforeEach, describe, expect, it } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { useReviewStore } from '../../src/ui/stores/review-store';
import { createInMemoryReviewRepository } from '../../src/ui/stores/ports/review-repository';
import type { ReviewRepository, WorkItem } from '../../src/ui/stores/ports/review-repository';

const NOW = new Date('2026-09-21T10:00:00.000Z');
const noop = (): void => {};

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
    await repo.saveWorkItem({
      id: 'w1', target: { kind: 'file', entityId: 'e9' }, intent: 'refactor', title: 't', status: 'planned', createdAt: NOW.toISOString(),
      priority: 'medium', notes: '', checks: [false, false, false],
    });
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
    await repo.saveWorkItem({
      id: 'wi-3', target: { kind: 'file', entityId: 'e1' }, intent: 'refactor', title: 't1', status: 'investigate', createdAt: NOW.toISOString(),
      priority: 'medium', notes: '', checks: [false, false, false],
    });
    await repo.saveWorkItem({
      id: 'wi-5', target: { kind: 'file', entityId: 'e2' }, intent: 'refactor', title: 't2', status: 'investigate', createdAt: NOW.toISOString(),
      priority: 'medium', notes: '', checks: [false, false, false],
    });
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
  it('leaves state unchanged, clears the pending flag, and rejects when the repository refuses to save', async () => {
    const repo = createInMemoryReviewRepository();
    const store = useReviewStore();
    store.setRepository({ ...repo, saveWorkItem: () => Promise.reject(new Error('save failed')) });
    await expect(store.addWorkItemForFile('e1', 't', NOW)).rejects.toThrow('save failed');
    expect(store.workItemCount).toBe(0);
    expect(store.hasWorkItemFor('e1')).toBe(false);
    expect(store.isPendingFor('e1')).toBe(false);
    // Fix round 2: the id/nextId advance is reserved SYNCHRONOUSLY, before the save
    // is even attempted (so two overlapping calls can never race to the same id —
    // see the "double click" test below). A failed save therefore leaves a GAP
    // (wi-1 skipped) rather than the id being reused — an accepted tradeoff.
    store.setRepository(repo);
    const item = await store.addWorkItemForFile('e1', 't', NOW);
    expect(item?.id).toBe('wi-2');
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

  // Fix round 2 (Important, regression from round 1): round 1 made `addWorkItemForFile`
  // await the repository before touching state, but the guard and the `wi-${nextId}`
  // id were both still computed BEFORE that await — so two overlapping calls for the
  // SAME file (e.g. a double-click before the first save settles) both passed the
  // guard and both got id 'wi-1'. Models that race directly: two calls fired without
  // awaiting either, against a repository whose save only resolves once released.
  it('a second overlapping call for the same file is refused, not raced, while the first save is pending', async () => {
    const store = useReviewStore();
    let releaseSave: (() => void) | undefined;
    const gate = new Promise<void>((resolve) => { releaseSave = resolve; });
    store.setRepository({
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
    const first = store.addWorkItemForFile('e1', 'first', NOW);
    expect(store.isPendingFor('e1')).toBe(true);
    const second = store.addWorkItemForFile('e1', 'second', NOW);
    releaseSave?.();
    const [firstItem, secondItem] = await Promise.all([first, second]);
    expect([firstItem, secondItem].filter((i) => i !== null)).toHaveLength(1);
    expect([firstItem, secondItem].filter((i) => i === null)).toHaveLength(1);
    expect(store.workItemCount).toBe(1);
    expect(store.isPendingFor('e1')).toBe(false);
    // The refused call never reserved an id, so the next DIFFERENT file still gets
    // the very next id rather than skipping one for the call that was turned away.
    const third = await store.addWorkItemForFile('e2', 'third', NOW);
    expect(third?.id).toBe('wi-2');
  });

  it('adds boundary rules with sequential AR ids, persisted through the port', async () => {
    const repo = createInMemoryReviewRepository();
    const store = useReviewStore();
    store.setRepository(repo);
    const a = await store.addRule('domain', 'storage', 'Keep domain pure', NOW);
    const b = await store.addRule('ui', 'storage', 'Go through the port', NOW);
    expect([a?.id, b?.id]).toEqual(['AR-001', 'AR-002']);
    expect(a).toMatchObject({ from: 'domain', to: 'storage', rationale: 'Keep domain pure', createdAt: NOW.toISOString() });
    expect(store.ruleCount).toBe(2);
    expect(await repo.listRules()).toHaveLength(2);
  });

  it('refuses a self-rule, an empty rationale and a duplicate pair', async () => {
    const store = useReviewStore();
    expect(await store.addRule('a', 'a', 'x', NOW)).toBeNull();
    expect(await store.addRule('a', 'b', '   ', NOW)).toBeNull();
    await store.addRule('a', 'b', 'x', NOW);
    expect(await store.addRule('a', 'b', 'again', NOW)).toBeNull();
    expect(store.hasRule('a', 'b')).toBe(true);
    expect(store.hasRule('b', 'a')).toBe(false);
    expect(store.ruleCount).toBe(1);
  });

  it('refuses an overlapping add for the same pair while the first save is in flight', async () => {
    let release: () => void = noop;
    const base = createInMemoryReviewRepository();
    const slow: ReviewRepository = { ...base, saveRule: (r) => new Promise((res) => { release = () => { void base.saveRule(r).then(res); }; }) };
    const store = useReviewStore();
    store.setRepository(slow);
    const first = store.addRule('a', 'b', 'x', NOW);
    expect(await store.addRule('a', 'b', 'x', NOW)).toBeNull();
    release();
    expect((await first)?.id).toBe('AR-001');
  });

  it('removes a rule through the port', async () => {
    const repo = createInMemoryReviewRepository();
    const store = useReviewStore();
    store.setRepository(repo);
    const rule = await store.addRule('a', 'b', 'x', NOW);
    await store.removeRule(rule!.id);
    expect(store.ruleCount).toBe(0);
    expect(await repo.listRules()).toHaveLength(0);
  });

  it('load never moves nextId below a reservation an in-flight add already holds', async () => {
    let release: () => void = noop;
    const base = createInMemoryReviewRepository();
    const slow: ReviewRepository = {
      ...base,
      saveWorkItem: (item: WorkItem) => new Promise((res) => { release = () => { void base.saveWorkItem(item).then(res); }; }),
    };
    const store = useReviewStore();
    store.setRepository(slow);
    const pending = store.addWorkItemForFile('e1', 't', NOW);   // reserves wi-1
    await store.load();                                          // lists nothing yet
    release();
    await pending;
    store.setRepository(base);
    expect((await store.addWorkItemForFile('e2', 't', NOW))?.id).toBe('wi-2');
    expect(store.workItems.filter((w) => w.id === 'wi-1')).toHaveLength(1);
  });

  it('loads rules and continues their numbering', async () => {
    const repo = createInMemoryReviewRepository();
    await repo.saveRule({ id: 'AR-007', from: 'a', to: 'b', rationale: 'x', createdAt: NOW.toISOString() });
    const store = useReviewStore();
    store.setRepository(repo);
    await store.load();
    expect(store.hasRule('a', 'b')).toBe(true);
    expect((await store.addRule('b', 'c', 'y', NOW))?.id).toBe('AR-008');
  });
});
