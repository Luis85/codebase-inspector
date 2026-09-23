// Polish E3, E4: the review store refuses a decision before its codebase is read, and never puts
// back what another leaf removed while its own write was in flight.
import { describe, expect, it, vi } from 'vitest';
import { flushPromises } from '@vue/test-utils';
import { createPinia } from 'pinia';
import { useReviewStore } from '../../src/ui/stores/review-store';
import {
  createInMemoryReviewRepository, type FindingDisposition, type ReviewRepository,
} from '../../src/ui/stores/ports/review-repository';

const AT = '2026-09-23T10:00:00.000Z';
const DECISION: FindingDisposition = { fingerprint: 'src/a.ts#f1', status: 'acknowledged', decidedAt: AT };
const noop = (): void => {};

function gate(): { promise: Promise<void>; open: () => void } {
  let open: () => void = noop;
  const promise = new Promise<void>((resolve) => { open = resolve; });
  return { promise, open: () => { open(); } };
}

/** The same repository, whose saves land (and notify) at once but resolve only when `until`
 *  opens: the notification window a slow disk opens. */
function delayedSaves(inner: ReviewRepository, until: Promise<void>): ReviewRepository {
  return {
    listWorkItems: () => inner.listWorkItems(), removeWorkItem: (id) => inner.removeWorkItem(id),
    saveWorkItem: async (i) => { await inner.saveWorkItem(i); await until; },
    listRules: () => inner.listRules(), removeRule: (id) => inner.removeRule(id),
    saveRule: async (r) => { await inner.saveRule(r); await until; },
    listDispositions: () => inner.listDispositions(),
    saveDisposition: async (d) => { await inner.saveDisposition(d); await until; },
    removeDisposition: (fp) => inner.removeDisposition(fp), replaceAll: (s) => inner.replaceAll(s),
    allocateId: (k) => inner.allocateId(k), subscribe: (l) => inner.subscribe(l), diagnostics: () => inner.diagnostics(),
  };
}

describe('Polish E3: decide waits for the bound codebase to be read', () => {
  it('a decision before the read lands is refused, and nothing is saved', async () => {
    const repo = createInMemoryReviewRepository();
    const read = gate();
    const list = repo.listDispositions.bind(repo);
    repo.listDispositions = async () => { await read.promise; return list(); };
    const save = vi.spyOn(repo, 'saveDisposition');
    const store = useReviewStore(createPinia());
    store.setRepositoryFactory(() => repo);
    const binding = store.bindRepository('c1');
    expect(store.ready).toBe(false);
    expect(await store.decide(DECISION)).toBeNull();
    expect(save).not.toHaveBeenCalled();
    read.open();
    await binding;
    expect(await store.decide(DECISION)).toEqual(DECISION);
  });
});

/** Leaf A writes through a repository whose saves resolve only when `slow` opens; leaf B
 *  shares the same stored state and writes straight through. Both are bound and read. */
async function twoLeaves() {
  const shared = createInMemoryReviewRepository();
  const slow = gate();
  const a = useReviewStore(createPinia());
  const b = useReviewStore(createPinia());
  a.setRepositoryFactory(() => delayedSaves(shared, slow.promise));
  b.setRepositoryFactory(() => shared);
  await a.bindRepository('c1');
  await b.bindRepository('c1');
  return { shared, slow, a, b };
}

describe('Polish E4: an own write never resurrects what another leaf removed', () => {
  it('a decision another leaf reopened during this leaf\'s save is not put back', async () => {
    const { shared, slow, a, b } = await twoLeaves();
    const deciding = a.decide(DECISION);
    await flushPromises();
    expect(b.dispositions).toEqual([DECISION]);
    expect(await b.reopen(DECISION.fingerprint)).toBe(true);
    await flushPromises();
    slow.open();
    expect(await deciding).toEqual(DECISION);
    await flushPromises();
    expect(a.dispositions).toEqual([]);
    expect(await shared.listDispositions()).toEqual([]);
  });

  it('a work item another leaf removed during this leaf\'s save is not put back', async () => {
    const { shared, slow, a, b } = await twoLeaves();
    const adding = a.addWorkItem({ kind: 'file', entityId: 'file:src/a.ts' }, 'refactor', 'Split a.ts', new Date(AT));
    await flushPromises();
    const id = b.workItems[0]?.id ?? '';
    expect(id).not.toBe('');
    expect(await b.removeWorkItem(id)).toBe(true);
    await flushPromises();
    slow.open();
    expect((await adding)?.id).toBe(id);
    await flushPromises();
    expect(a.workItems).toEqual([]);
    expect(await shared.listWorkItems()).toEqual([]);
  });

  it('a rule another leaf removed during this leaf\'s save is not put back', async () => {
    const { shared, slow, a, b } = await twoLeaves();
    const adding = a.addRule('src/ui', 'src/host', 'The UI never reaches the host.', new Date(AT));
    await flushPromises();
    const id = b.rules[0]?.id ?? '';
    expect(id).not.toBe('');
    await b.removeRule(id);
    await flushPromises();
    slow.open();
    expect((await adding)?.id).toBe(id);
    await flushPromises();
    expect(a.rules).toEqual([]);
    expect(await shared.listRules()).toEqual([]);
  });
});
