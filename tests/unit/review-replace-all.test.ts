// Part 5 V16: replacing the whole review state with an imported one, and the report's restore.
// Part 5 P1 (T19): clearAll is pending-aware, the same rule as replaceAll.
import { beforeEach, describe, expect, it } from 'vitest';
import { flushPromises } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { useReviewStore } from '../../src/ui/stores/review-store';
import { useReportStore } from '../../src/ui/stores/report-store';
import {
  NO_CHECKS, createInMemoryReviewRepository, type BoundaryRule, type FindingDisposition, type ReviewReplaceState, type WorkItem,
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
// oxlint consistent-function-scoping: a no-arg closure that captures nothing is hoisted.
const noop = (): void => {};
type Store = ReturnType<typeof useReviewStore>;

async function seeded(store: Store): Promise<void> {
  await store.addWorkItem({ kind: 'package', name: 'old' }, 'review', 'Old item', NOW);
  await store.addRule('a', 'b', 'Old rule', NOW);
  await store.acknowledge('old-fp', NOW);
}

describe('review store replaceAll (Part 5 V16)', () => {
  // Part 6 Y14: replaceAll and clearAll refuse while unbound, so each test starts bound.
  beforeEach(async () => { setActivePinia(createPinia()); await useReviewStore().bindRepository('repo-t'); });

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

  it('keeps an imported item whose id a current item already had (one atomic port replace, Part 6 R1)', async () => {
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

  // Part 6 R1: the port replaces atomically, so a failure changes nothing. (Until Part 6 this
  // pinned Part 5's per-record partial failure: every other save landed, the rule did not.)
  it('a rejected replace changes nothing, reloads what the port still holds, and rethrows it', async () => {
    const repo = createInMemoryReviewRepository();
    const store = useReviewStore();
    store.setRepository({ ...repo, replaceAll: () => Promise.reject(new Error('disk full')) });
    const old = await store.addWorkItem({ kind: 'package', name: 'old' }, 'review', 'Old item', NOW);
    await expect(store.replaceAll(IMPORTED)).rejects.toThrow('disk full');
    expect(await repo.listWorkItems()).toEqual([old]);
    expect(await repo.listRules()).toEqual([]);
    expect(await repo.listDispositions()).toEqual([]);
    expect(store.workItems).toEqual([old]);
    expect(store.bulkBusy).toBe(false);
  });

  // Fix round 3, minor 1: bulkBusy used to clear one `await` BEFORE the reload that
  // advances nextId/nextRuleId past the imported ids, so an addWorkItem in that window
  // could reserve an id the import already used. It now clears only once the reload has
  // settled (a nested try/finally around the reload). listWorkItems is gated so the
  // reload is caught still in flight, after the write phase (removals + saves) has
  // already resolved and the imported item is already sitting in the port.
  it('refuses an addWorkItem started after the write phase settles but before the reload does (fix round 3, minor 1)', async () => {
    const repo = createInMemoryReviewRepository();
    const store = useReviewStore();
    let releaseList: (() => void) | undefined;
    const listGate = new Promise<void>((resolve) => { releaseList = resolve; });
    store.setRepository({ ...repo, listWorkItems: () => listGate.then(() => repo.listWorkItems()) });
    const imported = { workItems: [{ ...ITEMS[0]!, id: 'wi-1' }], rules: [], dispositions: [] };
    const running = store.replaceAll(imported);
    await flushPromises();
    // The write phase has settled — the imported item is already in the port — and the
    // reload is stuck behind the gated listWorkItems(). This is exactly the window the
    // old ordering left open: bulkBusy was already false here.
    expect(store.bulkBusy, 'bulkBusy must still be true while the reload is in flight').toBe(true);
    expect(await store.addWorkItem({ kind: 'package', name: 'during' }, 'review', 'During', NOW)).toBeNull();
    releaseList?.();
    expect(await running).toBe(true);
    expect(await repo.listWorkItems()).toEqual([{ ...ITEMS[0]!, id: 'wi-1' }]);
    // nextId continues from the imported id, not from the refused attempt.
    expect((await store.addWorkItem({ kind: 'package', name: 'after' }, 'review', 'After', NOW))?.id).toBe('wi-2');
  });

  // Part 6 Y16 (Part 5 E25's parked test): now that a port can reject, replaceAll's own
  // reload can too. bulkBusy still clears, that rejection is what the caller sees, and the
  // store stays usable. Verified RED before Task 2 (Part 6 E6): it failed on the id line,
  // since the rejected reload never advanced the old counter. No TDD-RED exception applies.
  it('clears bulkBusy and surfaces the rejection when its own reload rejects (Y16)', async () => {
    const repo = createInMemoryReviewRepository();
    const store = useReviewStore();
    store.setRepository({ ...repo, listRules: () => Promise.reject(new Error('read failed')) });
    await expect(store.replaceAll(IMPORTED)).rejects.toThrow('read failed');
    expect(store.bulkBusy).toBe(false);
    expect(store.hasPendingChanges).toBe(false);
    expect(await repo.listWorkItems()).toEqual(ITEMS);
    expect((await store.addWorkItem({ kind: 'package', name: 'after' }, 'review', 'After', NOW))?.id).toBe('wi-13');
  });

  // Part 5 E20: a codebase switch (bindRepository) that lands while replaceAll is still
  // running writes to the codebase it started for — correct, and it stays — but that
  // codebase is no longer the one on screen, so the call did not apply to what is now
  // bound. It resolves false, the same shape a caller already treats as "did not apply".
  it('resolves false, without touching the newly bound codebase, when a codebase switch lands mid-run', async () => {
    const repoA = createInMemoryReviewRepository();
    const store = useReviewStore();
    await store.bindRepository('repo-a');
    let release: () => void = noop;
    const gate = new Promise<void>((r) => { release = r; });
    store.setRepository({ ...repoA, replaceAll: async (state: ReviewReplaceState) => { await gate; await repoA.replaceAll(state); } });
    const running = store.replaceAll(IMPORTED);
    await store.bindRepository('repo-b');
    release();
    expect(await running).toBe(false);
    expect(store.workItems).toEqual([]);
    expect(await repoA.listWorkItems()).toEqual(ITEMS);
    expect(await repoA.listRules()).toEqual(RULES);
    expect(await repoA.listDispositions()).toEqual(DECISIONS);
  });

  // Fix round 3, minor 2: a rejection in the OLD codebase's writes used to be rethrown
  // even when the codebase had already changed mid-run, so the dialog showed
  // IMPORT_FAILED for a codebase the write never touched. It must resolve false instead
  // — the writes stayed in repo-a's port, which is correct, and repo-b was never written.
  it('resolves false, and does not rethrow, when a codebase switch lands mid-run AND a write in the old codebase rejects', async () => {
    const repoA = createInMemoryReviewRepository();
    const store = useReviewStore();
    await store.bindRepository('repo-a');
    let release: () => void = noop;
    const gate = new Promise<void>((r) => { release = r; });
    store.setRepository({ ...repoA, replaceAll: async () => { await gate; throw new Error('disk full'); } });
    const running = store.replaceAll(IMPORTED);
    await store.bindRepository('repo-b');
    release();
    await expect(running).resolves.toBe(false);
    expect(store.workItems).toEqual([]);
  });
});

describe('review store clearAll (Part 5 P1/T19)', () => {
  // Part 6 Y14: replaceAll and clearAll refuse while unbound, so each test starts bound.
  beforeEach(async () => { setActivePinia(createPinia()); await useReviewStore().bindRepository('repo-t'); });

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
  // Part 6 Y14: replaceAll and clearAll refuse while unbound, so each test starts bound.
  beforeEach(async () => { setActivePinia(createPinia()); await useReviewStore().bindRepository('repo-t'); });

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
    report.restore('repo-a', sections, 'Imported note.');
    expect(report.sections).toEqual(sections);
    expect(report.note).toBe('Imported note.');
    report.bindRepository('repo-b');
    report.bindRepository('repo-a');
    expect(report.note).toBe('Imported note.');
    expect(report.sections).toEqual(sections);
  });

  // Part 5 E20: a codebase switch between an import parsing and it applying must never
  // write that import's note/sections onto the codebase now bound.
  it('no-ops when the given repositoryId no longer matches the bound codebase', () => {
    const report = useReportStore();
    report.bindRepository('repo-a');
    report.applyNote('kept');
    const sections = { summary: false, architecture: true, hotspots: true, security: false, plan: true };
    report.bindRepository('repo-b');
    report.restore('repo-a', sections, 'Stale note.');
    expect(report.note).toBe('');
    expect(report.sections).not.toEqual(sections);
    report.restore(null, sections, 'Also stale.');
    expect(report.note).toBe('');
  });
});
