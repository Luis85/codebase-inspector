// Polish E6, E7: the durable review adapter writes data.json only when something changed, never
// raises its id marks for a refused write, and a retired instance says it is read-only.
import { describe, expect, it, vi } from 'vitest';
import type { Plugin as ObsidianPlugin } from 'obsidian';
import { Plugin } from '../mocks/obsidian';
import { createPluginDataReviewRepository, deleteReviewSet } from '../../src/adapters/storage/plugin-data-review-repository';
import { NO_CHECKS, ReviewStoreError, type WorkItem } from '../../src/ui/stores/ports/review-repository';

function harness() {
  // One cast at the boundary, as review-repository.test.ts: the mock implements loadData/saveData only.
  const plugin = new Plugin({}, {}) as unknown as ObsidianPlugin;
  const save = plugin.saveData.bind(plugin);
  let saves = 0;
  /** Runs once, inside the next saveData: after the write's mutation, before it lands. */
  let onSave: (() => void) | null = null;
  plugin.saveData = (data: unknown): Promise<void> => {
    saves += 1;
    const hook = onSave;
    onSave = null;
    hook?.();
    return save(data);
  };
  return {
    plugin, saves: () => saves, repo: createPluginDataReviewRepository(plugin, 'c1'),
    duringNextSave: (hook: () => void): void => { onSave = hook; },
  };
}
const item = (n: number): WorkItem => ({
  id: `wi-${String(n).padStart(3, '0')}`, target: { kind: 'module', module: 'src' }, intent: 'review', title: `Item ${n}`,
  status: 'investigate', priority: 'medium', notes: 'n'.repeat(150), checks: NO_CHECKS, createdAt: '2026-09-23T10:00:00.000Z',
});

describe('Polish E7: no needless data.json writes', () => {
  it('a removal that removes nothing saves nothing, and still notifies once', async () => {
    const h = harness();
    await h.repo.listWorkItems();
    const heard = vi.fn();
    h.repo.subscribe(heard);
    const before = h.saves();
    await h.repo.removeWorkItem('wi-404');
    await h.repo.removeRule('AR-404');
    await h.repo.removeDisposition('src/a.ts#none');
    expect(h.saves()).toBe(before);
    expect(heard).toHaveBeenCalledTimes(3);
  });

  it('a removal that removes nothing keeps what the last write told diagnostics', async () => {
    const h = harness();
    await h.plugin.saveData({ reviews: { c1: { v: 1, workItems: [{ id: 'wi-5', broken: true }] } } });
    await h.repo.listWorkItems();
    expect(h.repo.diagnostics().skipped).toBe(1);
    await h.repo.saveWorkItem({ ...item(1), id: 'wi-5' });   // replaces the unreadable record by id (Y7)
    await h.repo.removeRule('AR-404');
    expect(h.repo.diagnostics().skipped).toBe(0);
  });

  it('purging a codebase on a fresh install saves nothing', async () => {
    const h = harness();
    await deleteReviewSet(h.plugin, 'c1');
    expect(h.saves()).toBe(0);
  });

  it('purging a codebase that has no saved set saves nothing either', async () => {
    const h = harness();
    await createPluginDataReviewRepository(h.plugin, 'c2').saveWorkItem(item(1));
    const before = h.saves();
    await deleteReviewSet(h.plugin, 'c1');
    expect(h.saves()).toBe(before);
  });
});

describe('Polish E7: a refused write leaves the id marks where they were', () => {
  it('a replaceAll refused as full does not move the next id', async () => {
    const h = harness();
    await h.repo.listWorkItems();
    const fresh = createPluginDataReviewRepository(h.plugin, 'c1');
    await fresh.listWorkItems();
    const many = Array.from({ length: 6_000 }, (_, i) => item(i + 1));
    await expect(h.repo.replaceAll({ workItems: many, rules: [], dispositions: [] })).rejects.toBeInstanceOf(ReviewStoreError);
    expect(h.repo.allocateId('workItem')).toBe(fresh.allocateId('workItem'));
  });

  it('an id handed out while a write is saving is never handed out again', async () => {
    const h = harness();
    await h.repo.listWorkItems();
    let during = '';
    h.duringNextSave(() => { during = h.repo.allocateId('workItem'); });
    await h.repo.saveWorkItem({ ...item(1), id: h.repo.allocateId('workItem') });
    expect(during).toBe('wi-2');
    expect(h.repo.allocateId('workItem')).toBe('wi-3');
  });
});

describe('Polish E7 (5b fix round): a retired repository', () => {
  it('reports itself retired, not as a format it cannot read', () => {
    const h = harness();
    h.repo.retire();
    expect(h.repo.diagnostics()).toEqual({ skipped: 0, unsupported: false, retired: true });
  });

  it('still reports it after the reload its retirement triggers', async () => {
    const h = harness();
    h.repo.retire();
    await h.repo.listWorkItems();
    expect(h.repo.diagnostics()).toEqual({ skipped: 0, unsupported: false, retired: true });
  });

  it('refuses a write as retired, never as unsupported', async () => {
    const h = harness();
    h.repo.retire();
    await expect(h.repo.removeRule('AR-404')).rejects.toMatchObject({ code: 'retired' });
  });
});
