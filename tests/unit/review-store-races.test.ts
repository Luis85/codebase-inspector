// Polish E3, E4: the review store refuses a decision before its codebase is read, and never puts
// back what another leaf removed while its own write was in flight.
import { describe, expect, it, vi } from 'vitest';
import { flushPromises } from '@vue/test-utils';
import { createPinia } from 'pinia';
import { useReviewStore } from '../../src/ui/stores/review-store';
import {
  createInMemoryReviewRepository, type FindingDisposition, type ReviewRepository, type WorkItem,
} from '../../src/ui/stores/ports/review-repository';

const AT = '2026-09-23T10:00:00.000Z';
const DECISION: FindingDisposition = { fingerprint: 'src/a.ts#f1', status: 'acknowledged', decidedAt: AT };
const noop = (): void => {};

function gate(): { promise: Promise<void>; open: () => void } {
  let open: () => void = noop;
  const promise = new Promise<void>((resolve) => { open = resolve; });
  return { promise, open: () => { open(); } };
}

/** The same repository, whose saves resolve only when `until` opens: the window a slow disk
 *  opens. A save lands (and notifies) at once, or with `late` only once `until` opens, so a
 *  load during the write lists without it. */
function delayedSaves(inner: ReviewRepository, until: Promise<void>, late = false): ReviewRepository {
  const slowly = async (write: () => Promise<void>): Promise<void> => {
    if (late) await until;
    await write();
    await until;
  };
  return {
    listWorkItems: () => inner.listWorkItems(), removeWorkItem: (id) => inner.removeWorkItem(id),
    saveWorkItem: (i) => slowly(() => inner.saveWorkItem(i)),
    listRules: () => inner.listRules(), removeRule: (id) => inner.removeRule(id),
    saveRule: (r) => slowly(() => inner.saveRule(r)),
    listDispositions: () => inner.listDispositions(),
    saveDisposition: (d) => slowly(() => inner.saveDisposition(d)),
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

/** Leaf A writes through a repository whose saves resolve only when `slow` opens (and, with
 *  `late`, land only then); leaf B shares the same stored state and writes straight through.
 *  Both are bound and read. */
async function twoLeaves(late = false) {
  const shared = createInMemoryReviewRepository();
  const slow = gate();
  const a = useReviewStore(createPinia());
  const b = useReviewStore(createPinia());
  a.setRepositoryFactory(() => delayedSaves(shared, slow.promise, late));
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

const FILE_A = { kind: 'file', entityId: 'file:src/a.ts' } as const;
const FILE_B = { kind: 'file', entityId: 'file:src/b.ts' } as const;

/** Holds leaf A's work-item and rule lists until the returned gate opens (or fails them). */
function holdListsOf(store: ReturnType<typeof useReviewStore>, fail = false): () => void {
  const held = gate();
  const repo = store.repository;
  const items = repo.listWorkItems.bind(repo);
  const rules = repo.listRules.bind(repo);
  const hold = async (): Promise<void> => { await held.promise; if (fail) throw new Error('read failed'); };
  repo.listWorkItems = async () => { await hold(); return items(); };
  repo.listRules = async () => { await hold(); return rules(); };
  return held.open;
}

const targets = (items: readonly WorkItem[]): string[] => items.map((w) => (w.target.kind === 'file' ? w.target.entityId : '')).sort();

describe('Polish E4 fix round 1: the add stays reserved until its reload settles', () => {
  it('a second add of the same work item while the reload is in flight is refused, so nothing is saved twice', async () => {
    const { shared, slow, a, b } = await twoLeaves(true);
    const adding = a.addWorkItem(FILE_A, 'refactor', 'Split a.ts', new Date(AT));
    await flushPromises();
    // Another leaf's write lands first. A's own write, landing later, then finds its
    // notification slot used up and reloads (Y12), so a load starts during the write.
    expect(await b.addWorkItem(FILE_B, 'refactor', 'Split b.ts', new Date(AT))).not.toBeNull();
    await flushPromises();
    const release = holdListsOf(a);
    slow.open();
    await flushPromises();
    expect(await a.addWorkItem(FILE_A, 'refactor', 'Split a.ts', new Date(AT))).toBeNull();
    release();
    expect(await adding).not.toBeNull();
    await flushPromises();
    expect(targets(await shared.listWorkItems())).toEqual([FILE_A.entityId, FILE_B.entityId]);
    expect(targets(a.workItems)).toEqual([FILE_A.entityId, FILE_B.entityId]);
  });

  it('a second add of the same rule while the reload is in flight is refused', async () => {
    const { shared, slow, a, b } = await twoLeaves(true);
    const adding = a.addRule('src/ui', 'src/host', 'The UI never reaches the host.', new Date(AT));
    await flushPromises();
    expect(await b.addRule('src/host', 'src/ui', 'Nor the host the UI.', new Date(AT))).not.toBeNull();
    await flushPromises();
    const release = holdListsOf(a);
    slow.open();
    await flushPromises();
    expect(await a.addRule('src/ui', 'src/host', 'The UI never reaches the host.', new Date(AT))).toBeNull();
    release();
    expect(await adding).not.toBeNull();
    await flushPromises();
    expect(await shared.listRules()).toHaveLength(2);
    expect(a.rules).toHaveLength(2);
  });

  it('a reload that fails after the save returns the saved item and marks the read failed', async () => {
    const { shared, slow, a, b } = await twoLeaves(true);
    const adding = a.addWorkItem(FILE_A, 'refactor', 'Split a.ts', new Date(AT));
    await flushPromises();
    expect(await b.addWorkItem(FILE_B, 'refactor', 'Split b.ts', new Date(AT))).not.toBeNull();
    await flushPromises();
    const release = holdListsOf(a, true);
    slow.open();
    await flushPromises();
    release();
    expect((await adding)?.target).toEqual(FILE_A);   // it was saved: a failure here would invite a duplicate retry
    expect(a.loadFailed).toBe(true);                  // R1: Settings says the read failed
    expect(await shared.listWorkItems()).toHaveLength(2);
  });
});
