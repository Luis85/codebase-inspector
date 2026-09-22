// Part 5 V16: replacing the whole review state with an imported one, and the report's restore.
// Part 5 P1 (T19): clearAll is pending-aware, the same rule as replaceAll.
import { beforeEach, describe, expect, it } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { useReviewStore } from '../../src/ui/stores/review-store';
import { useReportStore } from '../../src/ui/stores/report-store';
import {
  NO_CHECKS, createInMemoryReviewRepository, type BoundaryRule, type FindingDisposition, type WorkItem,
} from '../../src/ui/stores/ports/review-repository';

const NOW = new Date('2026-09-22T10:00:00.000Z');
const AT = NOW.toISOString();
const ITEMS: WorkItem[] = [
  { id: 'wi-12', target: { kind: 'module', module: 'src' }, intent: 'documentation', title: 'Document src', status: 'planned', priority: 'low', notes: '', checks: NO_CHECKS, createdAt: AT },
  { id: 'wi-4', target: { kind: 'package', name: '@scope/pkg' }, intent: 'review', title: 'Review pkg', status: 'verified', priority: 'high', notes: 'ok', checks: [true, true, true], createdAt: AT, updatedAt: AT },
];
const RULES: BoundaryRule[] = [{ id: 'AR-007', from: 'ui', to: 'domain', rationale: 'Layering', createdAt: AT }];
const DECISIONS: FindingDisposition[] = [{ fingerprint: 'imported-fp', status: 'dismissed', reason: 'Generated', decidedAt: AT }];
const IMPORTED = { workItems: ITEMS, rules: RULES, dispositions: DECISIONS };
const hang = (): Promise<void> => new Promise<void>(() => {});
type Store = ReturnType<typeof useReviewStore>;

async function seeded(store: Store): Promise<void> {
  await store.addWorkItem({ kind: 'package', name: 'old' }, 'review', 'Old item', NOW);
  await store.addRule('a', 'b', 'Old rule', NOW);
  await store.acknowledge('old-fp', NOW);
}

describe('review store replaceAll (Part 5 V16)', () => {
  beforeEach(() => { setActivePinia(createPinia()); });

  it('replaces every item, rule and decision through the port, and new ids continue after the imported ones', async () => {
    const repo = createInMemoryReviewRepository();
    const store = useReviewStore();
    store.setRepository(repo);
    await seeded(store);
    expect(await store.replaceAll(IMPORTED)).toBe(true);
    expect(store.workItems).toEqual(ITEMS);
    expect(store.rules).toEqual(RULES);
    expect(store.dispositions).toEqual(DECISIONS);
    expect(await repo.listWorkItems()).toEqual(ITEMS);
    expect(await repo.listRules()).toEqual(RULES);
    expect(await repo.listDispositions()).toEqual(DECISIONS);
    expect((await store.addWorkItem({ kind: 'package', name: 'new' }, 'review', 'New', NOW))?.id).toBe('wi-13');
    expect((await store.addRule('x', 'y', 'New rule', NOW))?.id).toBe('AR-008');
  });

  it('keeps an imported item whose id a current item already had: removals finish before saves start', async () => {
    const store = useReviewStore();
    await store.addWorkItem({ kind: 'package', name: 'old' }, 'review', 'Old item', NOW);
    expect(await store.replaceAll({ workItems: [{ ...ITEMS[0]!, id: 'wi-1' }], rules: [], dispositions: [] })).toBe(true);
    expect(store.workItems.map((w) => [w.id, w.title])).toEqual([['wi-1', 'Document src']]);
    expect(await store.repository.listWorkItems()).toHaveLength(1);
  });

  it.each<[string, (s: Store) => void]>([
    ['a new work item', (s) => { void s.addWorkItem({ kind: 'package', name: 'slow' }, 'review', 'Slow', NOW); }],
    ['a rule', (s) => { void s.addRule('p', 'q', 'Slow', NOW); }],
    ['a decision', (s) => { void s.acknowledge('slow-fp', NOW); }],
  ])('refuses (false) and changes nothing while %s is still saving', async (_name, start) => {
    const repo = createInMemoryReviewRepository();
    const store = useReviewStore();
    store.setRepository({ ...repo, saveWorkItem: hang, saveRule: hang, saveDisposition: hang });
    start(store);
    expect(await store.replaceAll(IMPORTED)).toBe(false);
    expect(await repo.listWorkItems()).toEqual([]);
    expect(await repo.listRules()).toEqual([]);
    expect(await repo.listDispositions()).toEqual([]);
  });

  it('refuses (false) while an update is in flight', async () => {
    const repo = createInMemoryReviewRepository();
    const store = useReviewStore();
    store.setRepository(repo);
    const item = await store.addWorkItem({ kind: 'package', name: 'p' }, 'review', 'P', NOW);
    store.setRepository({ ...repo, saveWorkItem: hang });
    void store.updateWorkItem(item!.id, { title: 'Renamed' }, NOW);
    expect(await store.replaceAll(IMPORTED)).toBe(false);
    expect(store.workItems.map((w) => w.title)).toEqual(['P']);
  });

  it('a partial failure still attempts every save, reloads from the port, and rethrows the first rejection', async () => {
    const repo = createInMemoryReviewRepository();
    const store = useReviewStore();
    store.setRepository({ ...repo, saveRule: () => Promise.reject(new Error('disk full')) });
    await store.addWorkItem({ kind: 'package', name: 'old' }, 'review', 'Old item', NOW);
    await expect(store.replaceAll(IMPORTED)).rejects.toThrow('disk full');
    expect(await repo.listWorkItems()).toEqual(ITEMS);
    expect(await repo.listDispositions()).toEqual(DECISIONS);
    expect(store.workItems).toEqual(ITEMS);
    expect(store.dispositions).toEqual(DECISIONS);
    expect(store.rules).toEqual([]);
  });
});

describe('review store clearAll (Part 5 P1/T19)', () => {
  beforeEach(() => { setActivePinia(createPinia()); });

  it.each<[string, (s: Store) => void]>([
    ['a new work item is still saving', (s) => { void s.addWorkItem({ kind: 'package', name: 'slow' }, 'review', 'Slow', NOW); }],
    ['a rule is still saving', (s) => { void s.addRule('p', 'q', 'Slow', NOW); }],
    ['a decision is still saving', (s) => { void s.acknowledge('slow-fp', NOW); }],
  ])('refuses (false) and leaves the port untouched while %s', async (_name, start) => {
    const repo = createInMemoryReviewRepository();
    const store = useReviewStore();
    store.setRepository({ ...repo, saveWorkItem: hang, saveRule: hang, saveDisposition: hang });
    start(store);
    expect(await store.clearAll()).toBe(false);
    expect(await repo.listWorkItems()).toEqual([]);
    expect(await repo.listRules()).toEqual([]);
    expect(await repo.listDispositions()).toEqual([]);
  });

  it('refuses (false) and leaves the port untouched while an update is in flight', async () => {
    const repo = createInMemoryReviewRepository();
    const store = useReviewStore();
    store.setRepository(repo);
    const item = await store.addWorkItem({ kind: 'package', name: 'p' }, 'review', 'P', NOW);
    store.setRepository({ ...repo, saveWorkItem: hang });
    void store.updateWorkItem(item!.id, { title: 'Renamed' }, NOW);
    expect(await store.clearAll()).toBe(false);
    expect(await repo.listWorkItems()).toEqual([item]);
    expect(store.workItems.map((w) => w.title)).toEqual(['P']);
  });

  it('clears (true) through the port when nothing is pending', async () => {
    const repo = createInMemoryReviewRepository();
    const store = useReviewStore();
    store.setRepository(repo);
    await seeded(store);
    expect(await store.clearAll()).toBe(true);
    expect(store.workItems).toHaveLength(0);
    expect(store.rules).toHaveLength(0);
    expect(store.dispositions).toHaveLength(0);
    expect(await repo.listWorkItems()).toHaveLength(0);
  });
});

describe('review store bulk gate (Part 5 E18)', () => {
  beforeEach(() => { setActivePinia(createPinia()); });

  it('refuses an addWorkItem started during a gated replaceAll, and every imported item survives intact', async () => {
    const repo = createInMemoryReviewRepository();
    const store = useReviewStore();
    store.setRepository(repo);
    const running = store.replaceAll(IMPORTED);
    // Started synchronously while replaceAll's bulkBusy flag is set but its removal and
    // save phases have not settled yet: must not reserve an id an imported item could collide with.
    expect(await store.addWorkItem({ kind: 'package', name: 'during' }, 'review', 'During', NOW)).toBeNull();
    expect(await running).toBe(true);
    expect(store.workItems).toEqual(ITEMS);
    expect(await repo.listWorkItems()).toEqual(ITEMS);
  });

  it('refuses a second replaceAll, and a clearAll, started while the first is still running', async () => {
    const repo = createInMemoryReviewRepository();
    const store = useReviewStore();
    store.setRepository(repo);
    // All three start synchronously, back to back, before any of them can settle: the
    // in-memory repo resolves fast enough that awaiting one in between would let the
    // first finish (and clear bulkBusy) before the next call is even made.
    const first = store.replaceAll(IMPORTED);
    const second = store.replaceAll(IMPORTED);
    const clear = store.clearAll();
    expect(await second).toBe(false);
    expect(await clear).toBe(false);
    expect(await first).toBe(true);
    expect(store.workItems).toEqual(ITEMS);
    expect(await repo.listWorkItems()).toEqual(ITEMS);
  });
});

describe('report store restore (Part 5 V16)', () => {
  beforeEach(() => { setActivePinia(createPinia()); });

  it('takes the imported sections and note for the bound codebase, and keeps them across a round trip', () => {
    const report = useReportStore();
    report.bindRepository('repo-a');
    const sections = { summary: false, architecture: true, hotspots: true, security: false, plan: true };
    report.restore(sections, 'Imported note.');
    expect(report.sections).toEqual(sections);
    expect(report.note).toBe('Imported note.');
    report.bindRepository('repo-b');
    report.bindRepository('repo-a');
    expect(report.note).toBe('Imported note.');
    expect(report.sections).toEqual(sections);
  });
});
