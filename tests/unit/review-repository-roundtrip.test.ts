// Polish G4 (Part 6 E27, triaged): four review-repository round-trip cases against the
// REAL plugin.loadData()/saveData() double (tests/mocks/obsidian.ts's `Plugin`), not the
// contract harness's writeRaw/readRaw indirection.
//
// Item 1 corrects a Part 6 test-gap: the contract file's own "refuses a save that would
// take the set over 1 MB" (tests/contracts/review-repository.contract.ts:350) seeds its
// set with a loop that keeps pushing entries WHILE the size-so-far is `<= MAX`, so on
// exit the seed itself is already over the limit -- it never actually exercises a save
// that CROSSES the boundary from under to over. That test stays as-is (L25: the contract
// file is at 423/450 lines, and "a set already over the limit refuses a further save" is
// still true and still worth keeping); this file adds the corrected case beside it.
import { describe, expect, it, vi } from 'vitest';
import type { Plugin as ObsidianPlugin } from 'obsidian';
import { Plugin } from '../mocks/obsidian';
import { makeEntityId } from '../../src/domain/entity-id';
import {
  NO_CHECKS, ReviewStoreError, type WorkItem,
} from '../../src/ui/stores/ports/review-repository';
import {
  createPluginDataReviewRepository, REVIEW_STORE_MAX_BYTES,
} from '../../src/adapters/storage/plugin-data-review-repository';

const AT = '2026-09-23T10:00:00.000Z';
const REPO_ID = 'repo-roundtrip';

function makePlugin(): ObsidianPlugin {
  // One cast at the boundary, exactly as tests/unit/review-repository.test.ts's own
  // pluginDataHarness: the mock implements loadData/saveData only.
  return new Plugin({}, {}) as unknown as ObsidianPlugin;
}

function workItem(id: string, overrides: Partial<WorkItem> = {}): WorkItem {
  return {
    id, target: { kind: 'file', entityId: makeEntityId(REPO_ID, 'file', `src/${id}.ts`) },
    intent: 'refactor', title: `Item ${id}`, status: 'investigate', priority: 'medium', notes: '',
    checks: NO_CHECKS, createdAt: AT, ...overrides,
  };
}

/** The on-disk (path) form a stored work item takes -- review-record-codec.ts's own
 *  shape, matching the contract file's `stored()` helper closely enough for padding. */
function storedWorkItem(n: number, notes: string): Record<string, unknown> {
  return {
    id: `wi-${n}`, target: { kind: 'file', path: `src/wi-${n}.ts` }, intent: 'refactor', title: `Item ${n}`,
    status: 'investigate', priority: 'medium', notes, checks: [false, false, false], createdAt: AT,
  };
}

/** Builds a `reviews[REPO_ID]` raw set whose JSON.stringify length is the largest that
 *  still fits at or under REVIEW_STORE_MAX_BYTES, so ONE further saved item is
 *  guaranteed to cross the boundary from under to over. Padding is a fixed-length notes
 *  string, mirroring the contract file's own 1 MB test (line 350-361). */
function buildSeedJustUnderLimit(): { seedSet: Record<string, unknown>; workItems: unknown[] } {
  const notes = 'n'.repeat(4000);
  const workItems: unknown[] = [];
  let n = 1;
  for (;;) {
    const candidateItems = [...workItems, storedWorkItem(n, notes)];
    const candidateSet = { v: 1, workItems: candidateItems, rules: [], dispositions: [], highWater: { workItem: n, rule: 0 } };
    if (JSON.stringify(candidateSet).length > REVIEW_STORE_MAX_BYTES) break;
    workItems.push(storedWorkItem(n, notes));
    n += 1;
  }
  return { seedSet: { v: 1, workItems, rules: [], dispositions: [], highWater: { workItem: n - 1, rule: 0 } }, workItems };
}

describe('ReviewRepository round-trips (Polish G4, E27)', () => {
  it('a save that crosses 1 MB is refused as full and data.json is unchanged', async () => {
    const plugin = makePlugin();
    const { seedSet } = buildSeedJustUnderLimit();
    await plugin.saveData({ reviews: { [REPO_ID]: seedSet } });
    const before: unknown = await plugin.loadData();
    const repo = createPluginDataReviewRepository(plugin, REPO_ID);
    let error: unknown;
    try {
      await repo.saveWorkItem(workItem('wi-999999', { notes: 'n'.repeat(4000) }));
    } catch (e) {
      error = e;
    }
    expect(error).toBeInstanceOf(ReviewStoreError);
    expect((error as ReviewStoreError).code).toBe('full');
    expect(await plugin.loadData()).toEqual(before);
  });

  it('a work item on a path with spaces and non-ASCII letters round-trips through data.json', async () => {
    const plugin = makePlugin();
    const repo = createPluginDataReviewRepository(plugin, REPO_ID);
    const path = 'src/café notes/日本語 file.ts';
    const item = workItem('wi-1', { target: { kind: 'file', entityId: makeEntityId(REPO_ID, 'file', path) } });
    await repo.saveWorkItem(item);
    const reopened = createPluginDataReviewRepository(plugin, REPO_ID);
    expect(await reopened.listWorkItems()).toEqual([item]);
  });

  it('a codebase whose id is __proto__ saves and reopens, and the reviews object keeps its prototype', async () => {
    const plugin = makePlugin();
    const repo = createPluginDataReviewRepository(plugin, '__proto__');
    await repo.saveWorkItem(workItem('wi-1', { target: { kind: 'file', entityId: makeEntityId('__proto__', 'file', 'src/wi-1.ts') } }));
    const reopened = createPluginDataReviewRepository(plugin, '__proto__');
    expect(await reopened.listWorkItems()).toHaveLength(1);
    const data = (await plugin.loadData()) as { reviews: unknown };
    expect(Object.getPrototypeOf(data.reviews)).toBe(Object.prototype);
  });

  it('the three list calls a load makes share one data.json read', async () => {
    const plugin = makePlugin();
    await plugin.saveData({ reviews: { [REPO_ID]: { v: 1, workItems: [], rules: [], dispositions: [] } } });
    const repo = createPluginDataReviewRepository(plugin, REPO_ID);
    const loadSpy = vi.spyOn(plugin, 'loadData');
    await Promise.all([repo.listWorkItems(), repo.listRules(), repo.listDispositions()]);
    expect(loadSpy).toHaveBeenCalledTimes(1);
  });
});
