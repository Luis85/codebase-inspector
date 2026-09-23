// Part 6 Y5–Y12, R1: the suite every ReviewRepository must pass, run against the in-memory
// adapter (src/ui/stores/ports/review-repository.ts) and the durable plugin-data adapter
// (src/adapters/storage/plugin-data-review-repository.ts), so they cannot drift (ruling
// M24's pattern, as profile-store.contract.ts).
//
// `runReviewRepositoryContract` uses `repo` only; both adapters run it.
// `runDurableReviewRepositoryContract` is plugin-data only. It needs the backing data.json:
// - `writeRaw(doc)` replaces the whole data.json, exactly as a hand edit or a newer plugin
//   version could leave it (the only way to put an invalid record on disk);
// - `readRaw()` returns the whole data.json;
// - `reopen()` builds a FRESH adapter on the same data.json (a plugin restart);
// - `writes()` counts the adapter's own data.json saves (writeRaw does not count).
// Plugin-data-only cases: persistence across a reopen, the path form on disk, the
// high-water mark on disk, allocating before the first read, skip-but-keep, duplicate ids,
// an unsupported set, the 1 MB bound, unrepresentable records, other keys left alone, and
// replaceAll's single atomic write.
import { describe, expect, it } from 'vitest';
import { makeEntityId } from '../../src/domain/entity-id';
import {
  NO_CHECKS, type BoundaryRule, type FindingDisposition, type ReviewRepository, type WorkItem,
} from '../../src/ui/stores/ports/review-repository';
import { REVIEW_STORE_MAX_BYTES, ReviewStoreError } from '../../src/adapters/storage/plugin-data-review-repository';

export interface ReviewRepositoryHarness {
  repo: ReviewRepository;
  reopen: () => ReviewRepository;
  writeRaw: (doc: unknown) => Promise<void>;
  readRaw: () => Promise<unknown>;
  writes: () => number;
}

export const CONTRACT_REPO = 'repo-contract';
const AT = '2026-09-23T10:00:00.000Z';
const NUL = String.fromCharCode(0);
const fileId = (path: string, repositoryId = CONTRACT_REPO): string => makeEntityId(repositoryId, 'file', path);

function item(id: string, overrides: Partial<WorkItem> = {}): WorkItem {
  return {
    id, target: { kind: 'file', entityId: fileId(`src/${id}.ts`) }, intent: 'refactor', title: `Item ${id}`,
    status: 'investigate', priority: 'medium', notes: '', checks: NO_CHECKS, createdAt: AT, ...overrides,
  };
}
const rule = (id: string, to = `m-${id}`): BoundaryRule => ({ id, from: 'ui', to, rationale: 'Layering', createdAt: AT });
const decision = (path: string, findingId = 'CX-1'): FindingDisposition =>
  ({ fingerprint: `${fileId(path)}#${findingId}`, status: 'acknowledged', decidedAt: AT });
/** The stored (path) form of `item(id)`, for writeRaw. */
const stored = (id: string, extra: Record<string, unknown> = {}): Record<string, unknown> => ({
  id, target: { kind: 'file', path: `src/${id}.ts` }, intent: 'refactor', title: `Item ${id}`,
  status: 'investigate', priority: 'medium', notes: '', checks: [false, false, false], createdAt: AT, ...extra,
});

export function runReviewRepositoryContract(name: string, make: () => Promise<ReviewRepositoryHarness>): void {
  describe(`ReviewRepository contract: ${name}`, () => {
    it('round-trips work items (file, package and module targets), rules and decisions', async () => {
      const { repo } = await make();
      const items = [
        item('wi-1'),
        item('wi-2', { target: { kind: 'package', name: '@scope/pkg' }, intent: 'review', updatedAt: AT }),
        item('wi-3', { target: { kind: 'module', module: 'src' }, status: 'verified', checks: [true, true, true] }),
      ];
      const dismissed: FindingDisposition = { ...decision('src/a.ts', 'DU-0a1b2c3d'), status: 'dismissed', reason: 'Generated code' };
      for (const w of items) await repo.saveWorkItem(w);
      await repo.saveRule(rule('AR-001'));
      await repo.saveDisposition(dismissed);
      await repo.saveDisposition(decision('docs/c#sharp.md'));
      expect(await repo.listWorkItems()).toEqual(items);
      expect(await repo.listRules()).toEqual([rule('AR-001')]);
      expect(await repo.listDispositions()).toEqual([dismissed, decision('docs/c#sharp.md')]);
    });

    it('replaces a record saved again under its id in place, and removes by id without touching the others', async () => {
      const { repo } = await make();
      for (const id of ['wi-1', 'wi-2', 'wi-3']) await repo.saveWorkItem(item(id));
      await repo.saveWorkItem(item('wi-2', { title: 'Renamed' }));
      await repo.removeWorkItem('wi-1');
      expect((await repo.listWorkItems()).map((w) => [w.id, w.title])).toEqual([['wi-2', 'Renamed'], ['wi-3', 'Item wi-3']]);
      await repo.saveRule(rule('AR-001'));
      await repo.saveRule(rule('AR-002'));
      await repo.removeRule('AR-001');
      expect(await repo.listRules()).toEqual([rule('AR-002')]);
      const redecided: FindingDisposition = { ...decision('src/a.ts'), status: 'dismissed', reason: 'Generated' };
      await repo.saveDisposition(decision('src/a.ts'));
      await repo.saveDisposition(decision('src/b.ts'));
      await repo.saveDisposition(redecided);
      await repo.removeDisposition(decision('src/b.ts').fingerprint);
      expect(await repo.listDispositions()).toEqual([redecided]);
    });

    it('resolves when removing something that is not there', async () => {
      const { repo } = await make();
      await expect(repo.removeWorkItem('wi-9')).resolves.toBeUndefined();
      await expect(repo.removeRule('AR-009')).resolves.toBeUndefined();
      await expect(repo.removeDisposition(decision('src/none.ts').fingerprint)).resolves.toBeUndefined();
    });

    it('a removal whose key cannot be stored resolves and notifies once (E8)', async () => {
      const { repo } = await make();
      await repo.saveDisposition(decision('src/a.ts'));
      let calls = 0;
      repo.subscribe(() => { calls += 1; });
      await expect(repo.removeDisposition(fileId('src/a.ts'))).resolves.toBeUndefined();
      expect(calls).toBe(1);
      await expect(repo.removeDisposition(`${fileId('src/a.ts', 'repo-other')}#CX-1`)).resolves.toBeUndefined();
      expect(calls).toBe(2);
      expect(await repo.listDispositions()).toEqual([decision('src/a.ts')]);
    });

    it('allocates wi-N and AR-NNN in sequence once read (Y10)', async () => {
      const { repo } = await make();
      await repo.listWorkItems();
      expect([repo.allocateId('workItem'), repo.allocateId('workItem'), repo.allocateId('rule')]).toEqual(['wi-1', 'wi-2', 'AR-001']);
    });

    it('never allocates an id a stored record has, a saved one raised, or a removed one had (Y10)', async () => {
      const { repo } = await make();
      await repo.saveWorkItem(item('wi-7'));
      await repo.saveRule(rule('AR-012'));
      await repo.listWorkItems();
      expect(repo.allocateId('workItem')).toBe('wi-8');
      expect(repo.allocateId('rule')).toBe('AR-013');
      await repo.saveWorkItem(item('wi-20'));
      expect(repo.allocateId('workItem')).toBe('wi-21');
      await repo.removeWorkItem('wi-20');
      await repo.removeWorkItem('wi-7');
      await repo.listWorkItems();
      expect(repo.allocateId('workItem')).toBe('wi-22');
    });

    it('tells subscribers once after each successful write, before it resolves, and never on a read (Y12)', async () => {
      const { repo } = await make();
      const events: string[] = [];
      const off = repo.subscribe(() => { events.push('notified'); });
      await repo.listWorkItems();
      expect(events).toEqual([]);
      await repo.saveWorkItem(item('wi-1')).then(() => { events.push('saved'); });
      await repo.saveRule(rule('AR-001'));
      await repo.saveDisposition(decision('src/a.ts'));
      await repo.removeWorkItem('wi-1');
      await repo.removeRule('AR-001');
      await repo.removeDisposition(decision('src/a.ts').fingerprint);
      expect(events).toEqual(['notified', 'saved', 'notified', 'notified', 'notified', 'notified', 'notified']);
      off();
      await repo.saveWorkItem(item('wi-2'));
      expect(events).toHaveLength(7);
    });

    it('replaceAll swaps everything at once, tells subscribers once, and raises the marks from the ids it is given (R1)', async () => {
      const { repo } = await make();
      await repo.saveWorkItem(item('wi-1'));
      await repo.saveRule(rule('AR-001'));
      await repo.saveDisposition(decision('src/a.ts'));
      const events: string[] = [];
      repo.subscribe(() => { events.push('notified'); });
      const state = { workItems: [item('wi-12')], rules: [rule('AR-007')], dispositions: [decision('src/b.ts')] };
      await repo.replaceAll(state).then(() => { events.push('replaced'); });
      expect(events).toEqual(['notified', 'replaced']);
      expect(await repo.listWorkItems()).toEqual(state.workItems);
      expect(await repo.listRules()).toEqual(state.rules);
      expect(await repo.listDispositions()).toEqual(state.dispositions);
      expect([repo.allocateId('workItem'), repo.allocateId('rule')]).toEqual(['wi-13', 'AR-008']);
    });

    it('replaceAll with empty lists clears, and never lowers the marks (R1)', async () => {
      const { repo } = await make();
      await repo.saveWorkItem(item('wi-5'));
      await repo.saveRule(rule('AR-003'));
      await repo.replaceAll({ workItems: [], rules: [], dispositions: [] });
      expect(await repo.listWorkItems()).toEqual([]);
      expect(await repo.listRules()).toEqual([]);
      expect(await repo.listDispositions()).toEqual([]);
      expect([repo.allocateId('workItem'), repo.allocateId('rule')]).toEqual(['wi-6', 'AR-004']);
    });

    it('reports clean diagnostics for clean data (Y7)', async () => {
      const { repo } = await make();
      await repo.saveWorkItem(item('wi-1'));
      await repo.listWorkItems();
      expect(repo.diagnostics()).toEqual({ skipped: 0, unsupported: false });
    });
  });
}

interface Doc { reviews?: Record<string, Record<string, unknown>>; [key: string]: unknown }
const setIn = async (h: ReviewRepositoryHarness): Promise<Record<string, unknown>> =>
  ((await h.readRaw()) as Doc).reviews![CONTRACT_REPO]!;
/** A data.json holding `set` for the contract codebase, next to data this adapter must never touch. */
const docWith = (set: unknown): unknown => ({
  profiles: [{ profileId: 'kept' }], reviews: { [CONTRACT_REPO]: set, other: { v: 1, workItems: ['untouched'] } },
});

/** The write rejects with a ReviewStoreError of `code`, data.json is unchanged, and nobody was told. */
async function expectRefused(h: ReviewRepositoryHarness, write: () => Promise<void>, code: string): Promise<void> {
  const before = await h.readRaw();
  const events: number[] = [];
  const off = h.repo.subscribe(() => { events.push(1); });
  const error: unknown = await write().then(() => null, (e: unknown) => e);
  off();
  expect(error).toBeInstanceOf(ReviewStoreError);
  expect((error as ReviewStoreError).code).toBe(code);
  expect(await h.readRaw()).toEqual(before);
  expect(events).toEqual([]);
}

export function runDurableReviewRepositoryContract(name: string, make: () => Promise<ReviewRepositoryHarness>): void {
  describe(`ReviewRepository durable contract: ${name}`, () => {
    it('keeps everything across a reopen, in path form: no raw entity id, NUL or repository id in the set (Y5, Y6)', async () => {
      const h = await make();
      const dismissed: FindingDisposition = { ...decision('src/a.ts'), status: 'dismissed', reason: 'Generated' };
      await h.repo.saveWorkItem(item('wi-1'));
      await h.repo.saveRule(rule('AR-001'));
      await h.repo.saveDisposition(dismissed);
      const again = h.reopen();
      expect(await again.listWorkItems()).toEqual([item('wi-1')]);
      expect(await again.listRules()).toEqual([rule('AR-001')]);
      expect(await again.listDispositions()).toEqual([dismissed]);
      const set = await setIn(h);
      expect(set).toEqual({
        v: 1, workItems: [stored('wi-1')], rules: [rule('AR-001')],
        dispositions: [{ finding: 'src/a.ts#CX-1', status: 'dismissed', reason: 'Generated', decidedAt: AT }],
        highWater: { workItem: 1, rule: 1 },
      });
      const text = JSON.stringify(set);
      expect(text).not.toContain(NUL);
      expect(text).not.toContain(CONTRACT_REPO);
    });

    it('keeps the high-water mark on disk across removal and reopen, and never lowers it (Y10)', async () => {
      const h = await make();
      await h.repo.listWorkItems();
      const first = item(h.repo.allocateId('workItem'));
      const second = item(h.repo.allocateId('workItem'));
      await h.repo.saveWorkItem(first);
      await h.repo.saveWorkItem(second);
      await h.repo.removeWorkItem(second.id);
      expect((await setIn(h)).highWater).toEqual({ workItem: 2, rule: 0 });
      const again = h.reopen();
      await again.listWorkItems();
      expect(again.allocateId('workItem')).toBe('wi-3');
    });

    it('continues after a stored mark higher than any record (Y10)', async () => {
      const h = await make();
      await h.writeRaw(docWith({ v: 1, workItems: [], rules: [], dispositions: [], highWater: { workItem: 40, rule: 7 } }));
      await h.repo.listRules();
      expect([h.repo.allocateId('workItem'), h.repo.allocateId('rule')]).toEqual(['wi-41', 'AR-008']);
    });

    it('refuses to allocate before its first read, rather than hand out an id already on disk (Y10, R9)', async () => {
      const h = await make();
      await h.writeRaw(docWith({ v: 1, workItems: [stored('wi-1')], rules: [], dispositions: [] }));
      const fresh = h.reopen();
      expect(() => fresh.allocateId('workItem')).toThrow();
      await fresh.listWorkItems();
      expect(fresh.allocateId('workItem')).toBe('wi-2');
    });

    it('skips an invalid record but keeps it on disk, and never reuses its id (Y7)', async () => {
      const h = await make();
      const invalid = [stored('wi-5', { owner: 'x' }), 'garbage'];
      const badRule = { id: 'AR-1', from: 'a', to: 'b', rationale: 'r', createdAt: AT };
      const badDecision = { finding: '../x.ts#CX-1', status: 'acknowledged', decidedAt: AT };
      await h.writeRaw(docWith({ v: 1, workItems: [stored('wi-1'), ...invalid], rules: [badRule], dispositions: [badDecision] }));
      expect(await h.repo.listWorkItems()).toEqual([item('wi-1')]);
      expect(await h.repo.listRules()).toEqual([]);
      expect(await h.repo.listDispositions()).toEqual([]);
      expect(h.repo.diagnostics()).toEqual({ skipped: 4, unsupported: false });
      const next = h.repo.allocateId('workItem');
      expect(next).toBe('wi-6');
      await h.repo.saveWorkItem(item(next));
      await h.repo.removeWorkItem('wi-1');
      const set = await setIn(h);
      expect(set.workItems).toEqual([...invalid, stored('wi-6')]);
      expect(set.rules).toEqual([badRule]);
      expect(set.dispositions).toEqual([badDecision]);
      expect(h.repo.diagnostics()).toEqual({ skipped: 4, unsupported: false });
    });

    it('lists the first of two records with one id, and a write to that id leaves one (Y7)', async () => {
      const h = await make();
      await h.writeRaw(docWith({ v: 1, workItems: [stored('wi-1'), stored('wi-1', { title: 'Second' })], rules: [], dispositions: [] }));
      expect(await h.repo.listWorkItems()).toEqual([item('wi-1')]);
      expect(h.repo.diagnostics().skipped).toBe(1);
      await h.repo.saveWorkItem(item('wi-1', { title: 'Renamed' }));
      expect((await setIn(h)).workItems).toEqual([stored('wi-1', { title: 'Renamed' })]);
    });

    it.each<[string, unknown]>([
      ['a newer version', { v: 2, workItems: [stored('wi-1')] }],
      ['a set that is not an object', 'text'],
      ['a set that is a list', [stored('wi-1')]],
      ['a v1 set whose lists are not lists', { v: 1, workItems: 'nope' }],
    ])('reads %s as empty and read-only, and never overwrites it (Y7)', async (_name, set) => {
      const h = await make();
      await h.writeRaw(docWith(set));
      expect(await h.repo.listWorkItems()).toEqual([]);
      expect(h.repo.diagnostics()).toEqual({ skipped: 0, unsupported: true });
      await expectRefused(h, () => h.repo.saveWorkItem(item('wi-1')), 'unsupported');
      await expectRefused(h, () => h.repo.removeWorkItem('wi-1'), 'unsupported');
      await expectRefused(h, () => h.repo.replaceAll({ workItems: [], rules: [], dispositions: [] }), 'unsupported');
    });

    it('treats a reviews value that is not an object as read-only for every codebase (Y7)', async () => {
      const h = await make();
      await h.writeRaw({ reviews: ['not', 'an', 'object'] });
      expect(await h.repo.listRules()).toEqual([]);
      expect(h.repo.diagnostics().unsupported).toBe(true);
      await expectRefused(h, () => h.repo.saveRule(rule('AR-001')), 'unsupported');
    });

    it('refuses a save that would take the set over 1 MB, writing nothing; a removal is never refused (Y9)', async () => {
      const h = await make();
      const notes = 'n'.repeat(4000);
      const workItems: unknown[] = [];
      for (let n = 1, size = 0; size <= REVIEW_STORE_MAX_BYTES; n += 1) {
        const entry = stored(`wi-${n}`, { notes });
        workItems.push(entry);
        size += JSON.stringify(entry).length + 1;
      }
      await h.writeRaw(docWith({ v: 1, workItems, rules: [], dispositions: [] }));
      await h.repo.listWorkItems();
      await expectRefused(h, () => h.repo.saveRule(rule('AR-001')), 'full');
      await h.repo.removeWorkItem('wi-1');
      expect((await setIn(h)).workItems).toHaveLength(workItems.length - 1);
    });

    it.each<[string, (repo: ReviewRepository) => Promise<void>]>([
      ['a file target of another codebase', (r) => r.saveWorkItem(item('wi-1', { target: { kind: 'file', entityId: fileId('src/a.ts', 'repo-other') } }))],
      ['a target that is not an entity id', (r) => r.saveWorkItem(item('wi-1', { target: { kind: 'file', entityId: 'src/a.ts' } }))],
      ['a directory target', (r) => r.saveWorkItem(item('wi-1', { target: { kind: 'file', entityId: makeEntityId(CONTRACT_REPO, 'directory', 'src') } }))],
      ['a work item id a read would refuse', (r) => r.saveWorkItem(item('wi-1234567'))],
      ['a rule id a read would refuse', (r) => r.saveRule(rule('AR-1'))],
      ['a decision without "#"', (r) => r.saveDisposition({ ...decision('src/a.ts'), fingerprint: fileId('src/a.ts') })],
      ['a decision of another codebase', (r) => r.saveDisposition({ ...decision('src/a.ts'), fingerprint: `${fileId('src/a.ts', 'repo-other')}#CX-1` })],
    ])('refuses %s as unrepresentable, writing nothing (Y6)', async (_name, save) => {
      const h = await make();
      await h.repo.saveWorkItem(item('wi-9'));
      await expectRefused(h, () => save(h.repo), 'unrepresentable');
    });

    it('writes only its own codebase and leaves every other data.json key as it was (Y8)', async () => {
      const h = await make();
      await h.writeRaw(docWith({ v: 1, workItems: [], rules: [], dispositions: [] }));
      await h.repo.saveWorkItem(item('wi-1'));
      await h.repo.removeRule('AR-001');
      const doc = (await h.readRaw()) as Doc;
      expect(doc.profiles).toEqual([{ profileId: 'kept' }]);
      expect(doc.reviews!.other).toEqual({ v: 1, workItems: ['untouched'] });
    });

    it('replaceAll replaces the whole set in ONE write, skipped records and unknown keys included, keeping the higher mark (R1)', async () => {
      const h = await make();
      await h.writeRaw(docWith({
        v: 1, workItems: [stored('wi-1'), stored('wi-9', { owner: 'x' })], rules: [], dispositions: ['garbage'],
        extra: true, highWater: { workItem: 40, rule: 2 },
      }));
      await h.repo.listWorkItems();
      const before = h.writes();
      await h.repo.replaceAll({ workItems: [item('wi-3')], rules: [rule('AR-050')], dispositions: [] });
      expect(h.writes() - before).toBe(1);
      expect(await setIn(h)).toEqual({
        v: 1, workItems: [stored('wi-3')], rules: [rule('AR-050')], dispositions: [], highWater: { workItem: 40, rule: 50 },
      });
      expect(h.repo.diagnostics()).toEqual({ skipped: 0, unsupported: false });
      expect(((await h.readRaw()) as Doc).reviews!.other).toEqual({ v: 1, workItems: ['untouched'] });
      const again = h.reopen();
      await again.listWorkItems();
      expect(again.allocateId('workItem')).toBe('wi-41');
    });

    it('replaceAll writes nothing when any one record is unrepresentable, or the result is over 1 MB (R1)', async () => {
      const h = await make();
      await h.repo.saveWorkItem(item('wi-1'));
      const foreign = item('wi-2', { target: { kind: 'file', entityId: fileId('src/a.ts', 'repo-other') } });
      await expectRefused(h, () => h.repo.replaceAll({ workItems: [item('wi-3'), foreign], rules: [], dispositions: [] }), 'unrepresentable');
      const badDecision = { ...decision('src/a.ts'), fingerprint: 'no-hash' };
      await expectRefused(h, () => h.repo.replaceAll({ workItems: [], rules: [], dispositions: [badDecision] }), 'unrepresentable');
      const notes = 'n'.repeat(4000);
      const big = Array.from({ length: 260 }, (_, i) => item(`wi-${i + 10}`, { notes }));
      await expectRefused(h, () => h.repo.replaceAll({ workItems: big, rules: [], dispositions: [] }), 'full');
      expect(await h.repo.listWorkItems()).toEqual([item('wi-1')]);
    });
  });
}
