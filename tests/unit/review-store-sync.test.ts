// Part 6 Y10, Y12, Y14, Y15: the review store over a shared repository — ids from the port,
// leaves kept in step by notifications, the unbound bucket refusing bulk writes, and the
// pending keys kept per codebase. Two Pinia instances stand in for two leaves.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises } from '@vue/test-utils';
import { createPinia, setActivePinia, type Pinia } from 'pinia';
import { makeEntityId } from '../../src/domain/entity-id';
import { useReviewStore } from '../../src/ui/stores/review-store';
import { createInMemoryReviewRepository, type ReviewIdKind, type ReviewRepository } from '../../src/ui/stores/ports/review-repository';

const NOW = new Date('2026-09-23T10:00:00.000Z');
const fileIn = (repo: string, path: string) => ({ kind: 'file' as const, entityId: makeEntityId(repo, 'file', path) });
const noop = (): void => {};

function deferred(): { promise: Promise<void>; resolve: () => void; reject: (e: Error) => void } {
  let resolve: () => void = noop;
  let reject: (e: Error) => void = noop;
  const promise = new Promise<void>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

/** A leaf: its own Pinia, its review store wired to `factory` the way the host wires it (Y11). */
function leaf(factory: (id: string) => ReviewRepository, pinia: Pinia = createPinia()) {
  const store = useReviewStore(pinia);
  store.setRepositoryFactory(factory);
  return store;
}

describe('review store over a shared repository (Part 6 Y10, Y12)', () => {
  beforeEach(() => { setActivePinia(createPinia()); });

  it('takes ids from the port, so two leaves on one codebase never hand out the same one', async () => {
    const shared = createInMemoryReviewRepository();
    const a = leaf(() => shared);
    const b = leaf(() => shared);
    await a.bindRepository('repo-a');
    await b.bindRepository('repo-a');
    const one = await a.addWorkItem(fileIn('repo-a', 'src/a.ts'), 'refactor', 'A', NOW);
    const two = await b.addWorkItem(fileIn('repo-a', 'src/b.ts'), 'refactor', 'B', NOW);
    expect([one?.id, two?.id]).toEqual(['wi-1', 'wi-2']);
    expect((await a.addRule('x', 'y', 'r', NOW))?.id).toBe('AR-001');
    expect((await b.addRule('y', 'z', 'r', NOW))?.id).toBe('AR-002');
  });

  it('another leaf\'s write reloads this one, so a stale leaf cannot act on a removed item', async () => {
    const shared = createInMemoryReviewRepository();
    const a = leaf(() => shared);
    const b = leaf(() => shared);
    await a.bindRepository('repo-a');
    await b.bindRepository('repo-a');
    const added = await a.addWorkItem(fileIn('repo-a', 'src/a.ts'), 'refactor', 'A', NOW);
    await flushPromises();
    expect(b.workItems.map((w) => w.id)).toEqual([added!.id]);
    expect(await b.removeWorkItem(added!.id)).toBe(true);
    await flushPromises();
    expect(a.workItems).toEqual([]);
    expect(await a.updateWorkItem(added!.id, { title: 'Resurrected' }, NOW)).toBeNull();
    expect(await shared.listWorkItems()).toEqual([]);
  });

  it('its own writes never reload it', async () => {
    const shared = createInMemoryReviewRepository();
    const listWorkItems = vi.fn(() => shared.listWorkItems());
    const a = leaf(() => ({ ...shared, listWorkItems }));
    await a.bindRepository('repo-a');
    const item = await a.addWorkItem(fileIn('repo-a', 'src/a.ts'), 'refactor', 'A', NOW);
    await a.updateWorkItem(item!.id, { title: 'A2' }, NOW);
    const rule = await a.addRule('x', 'y', 'r', NOW);
    await a.removeRule(rule!.id);
    await a.acknowledge('fp', NOW);
    await a.reopen('fp');
    await a.removeWorkItem(item!.id);
    await flushPromises();
    expect(listWorkItems).toHaveBeenCalledTimes(1);
    await a.clearAll(); // one port replaceAll, one skipped notification, then its own reload
    await flushPromises();
    expect(listWorkItems).toHaveBeenCalledTimes(2);
  });

  it('a rejected own write gives its notification back: the next foreign write still reloads', async () => {
    const shared = createInMemoryReviewRepository();
    const a = leaf(() => ({ ...shared, saveRule: () => Promise.reject(new Error('disk')) }));
    const b = leaf(() => shared);
    await a.bindRepository('repo-a');
    await b.bindRepository('repo-a');
    await expect(a.addRule('x', 'y', 'r', NOW)).rejects.toThrow('disk');
    await b.addWorkItem(fileIn('repo-a', 'src/b.ts'), 'refactor', 'B', NOW);
    await flushPromises();
    expect(a.workItems.map((w) => w.title)).toEqual(['B']);
  });

  it('a foreign write that lands while its own write is in flight is caught up, even when its own write then fails', async () => {
    const shared = createInMemoryReviewRepository();
    const gate = deferred();
    const a = leaf(() => ({ ...shared, saveWorkItem: () => gate.promise }));
    const b = leaf(() => shared);
    await a.bindRepository('repo-a');
    await b.bindRepository('repo-a');
    const adding = a.addWorkItem(fileIn('repo-a', 'src/a.ts'), 'refactor', 'A', NOW);
    await b.addWorkItem(fileIn('repo-a', 'src/b.ts'), 'refactor', 'B', NOW);
    await flushPromises();
    gate.reject(new Error('disk'));
    await expect(adding).rejects.toThrow('disk');
    await flushPromises();
    expect(a.workItems.map((w) => w.title)).toEqual(['B']);
  });

  it('drops its subscription on a switch, listens again on the way back, and stops on detach', async () => {
    const inner = createInMemoryReviewRepository();
    const offs: (() => void)[] = [];
    const counted: ReviewRepository = {
      ...inner,
      subscribe: (listener) => { const off = vi.fn(inner.subscribe(listener)); offs.push(off); return off; },
    };
    const a = leaf((id) => (id === 'repo-a' ? counted : createInMemoryReviewRepository()));
    await a.bindRepository('repo-a');
    expect(offs).toHaveLength(1);
    await a.bindRepository('repo-b');
    expect(offs[0]).toHaveBeenCalledTimes(1);
    await a.bindRepository('repo-a');
    expect(offs).toHaveLength(2);
    a.detach();
    expect(offs[1]).toHaveBeenCalledTimes(1);
  });
});

describe('review store readiness and diagnostics (Part 6 Y10, Y7)', () => {
  beforeEach(() => { setActivePinia(createPinia()); });

  it('refuses adds (null), spending no id, until the bound codebase\'s first load has finished', async () => {
    const inner = createInMemoryReviewRepository();
    const gate = deferred();
    const allocateId = vi.fn((kind: ReviewIdKind) => inner.allocateId(kind));
    const a = leaf(() => ({ ...inner, allocateId, listWorkItems: async () => { await gate.promise; return inner.listWorkItems(); } }));
    const binding = a.bindRepository('repo-a');
    expect(a.ready).toBe(false);
    expect(await a.addWorkItem(fileIn('repo-a', 'src/a.ts'), 'refactor', 'A', NOW)).toBeNull();
    expect(await a.addRule('x', 'y', 'r', NOW)).toBeNull();
    expect(allocateId).not.toHaveBeenCalled();
    gate.resolve();
    await binding;
    expect(a.ready).toBe(true);
    expect((await a.addWorkItem(fileIn('repo-a', 'src/a.ts'), 'refactor', 'A', NOW))?.id).toBe('wi-1');
  });

  it('marks loadFailed while the bound codebase cannot be read, and clears it on the next good load (R1)', async () => {
    const inner = createInMemoryReviewRepository();
    let failing = true;
    const a = leaf(() => ({
      ...inner,
      listRules: () => (failing ? Promise.reject(new Error('read failed')) : inner.listRules()),
    }));
    await expect(a.bindRepository('repo-a')).rejects.toThrow('read failed');
    expect(a.loadFailed).toBe(true);
    expect(a.ready).toBe(false);
    expect(await a.addWorkItem(fileIn('repo-a', 'src/a.ts'), 'refactor', 'A', NOW)).toBeNull();
    failing = false;
    await a.load();
    expect(a.loadFailed).toBe(false);
    expect(a.ready).toBe(true);
  });

  it('mirrors the bound repository\'s diagnostics after each load, and starts each bind clean', async () => {
    const odd: ReviewRepository = { ...createInMemoryReviewRepository(), diagnostics: () => ({ skipped: 2, unsupported: true }) };
    const a = leaf((id) => (id === 'repo-a' ? odd : createInMemoryReviewRepository()));
    await a.bindRepository('repo-a');
    expect(a.storageDiagnostics).toEqual({ skipped: 2, unsupported: true });
    const binding = a.bindRepository('repo-b');
    expect(a.storageDiagnostics).toEqual({ skipped: 0, unsupported: false });
    await binding;
    expect(a.storageDiagnostics).toEqual({ skipped: 0, unsupported: false });
  });

  it('keeps the unbound bucket in memory: the factory is never asked for it', async () => {
    const factory = vi.fn(() => createInMemoryReviewRepository());
    const a = leaf(factory);
    expect(await a.addWorkItem(fileIn('x', 'src/a.ts'), 'refactor', 'A', NOW)).not.toBeNull();
    expect(factory).not.toHaveBeenCalled();
    await a.bindRepository('repo-a');
    expect(factory).toHaveBeenCalledWith('repo-a');
  });
});

describe('review store bulk writes and pending keys (Part 6 Y14, Y15)', () => {
  beforeEach(() => { setActivePinia(createPinia()); });

  it('refuses replaceAll and clearAll while unbound, touching nothing (Y14)', async () => {
    const store = useReviewStore();
    await store.addWorkItemForFile('e1', 'Unbound', NOW);
    const item = store.workItems[0]!;
    expect(await store.replaceAll({ workItems: [], rules: [], dispositions: [] })).toBe(false);
    expect(await store.clearAll()).toBe(false);
    expect(await store.repository.listWorkItems()).toEqual([item]);
    expect(store.workItems).toEqual([item]);
    expect(store.bulkBusy).toBe(false);
  });

  it('keeps pending keys per codebase: a save in flight in one never blocks another (Y15)', async () => {
    const store = useReviewStore();
    await store.bindRepository('repo-a');
    const inner = createInMemoryReviewRepository();
    const gate = deferred();
    store.setRepository({ ...inner, saveWorkItem: async (w) => { await gate.promise; await inner.saveWorkItem(w); } });
    const target = fileIn('repo-a', 'src/a.ts');
    const adding = store.addWorkItem(target, 'refactor', 'A', NOW);
    expect(store.isPendingFor(target.entityId)).toBe(true);
    expect(store.hasPendingChanges).toBe(true);

    await store.bindRepository('repo-b');
    expect(store.isPendingFor(target.entityId)).toBe(false);
    expect(store.hasPendingChanges).toBe(false);
    expect(await store.clearAll()).toBe(true);

    await store.bindRepository('repo-a');
    expect(store.isPendingFor(target.entityId)).toBe(true);
    gate.resolve();
    expect((await adding)?.title).toBe('A');
    expect(store.isPendingFor(target.entityId)).toBe(false);
    expect(store.hasPendingChanges).toBe(false);
  });
});
