import { beforeEach, describe, expect, it } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { useReviewStore } from '../../src/ui/stores/review-store';
import {
  createInMemoryReviewRepository, DISMISS_REASON_MAX, workTargetKey, type ReviewRepository,
} from '../../src/ui/stores/ports/review-repository';

const NOW = new Date('2026-09-21T10:00:00.000Z');
const noop = (): void => {};

describe('work-item targets (Part 3 Q4)', () => {
  beforeEach(() => { setActivePinia(createPinia()); });

  it('keys uniqueness by target AND intent', async () => {
    const store = useReviewStore();
    const mod = { kind: 'module', module: 'src' } as const;
    expect(await store.addWorkItem(mod, 'pairing', 'Pair', NOW)).not.toBeNull();
    expect(await store.addWorkItem(mod, 'pairing', 'Again', NOW)).toBeNull();
    expect(await store.addWorkItem(mod, 'documentation', 'Doc', NOW)).not.toBeNull();
    expect(await store.addWorkItem({ kind: 'package', name: '@sample/x' }, 'review', 'Review', NOW)).not.toBeNull();
    expect(store.workItemCount).toBe(3);
  });

  it('keeps hasWorkItemFor meaning "a refactor item for this file"', async () => {
    const store = useReviewStore();
    await store.addWorkItem({ kind: 'file', entityId: 'e1' }, 'tests', 'Plan tests', NOW);
    expect(store.hasWorkItemFor('e1')).toBe(false);
    expect(store.workItemsForFile('e1')).toHaveLength(1);
    await store.addWorkItemForFile('e1', 'Investigate', NOW);
    expect(store.hasWorkItemFor('e1')).toBe(true);
    expect(store.workItemsForFile('e1')).toHaveLength(2);
  });

  it('never mixes up keys across kinds', () => {
    expect(workTargetKey({ kind: 'package', name: 'a' }, 'review')).not.toBe(workTargetKey({ kind: 'module', module: 'a' }, 'review'));
  });
});

describe('finding dispositions (Part 3 Q3)', () => {
  beforeEach(() => { setActivePinia(createPinia()); });

  it('acknowledges and reopens through the port', async () => {
    const repo = createInMemoryReviewRepository();
    const store = useReviewStore();
    store.setRepository(repo);
    const d = await store.acknowledge('e1#CX-src-0', NOW);
    expect(d).toEqual({ fingerprint: 'e1#CX-src-0', status: 'acknowledged', decidedAt: NOW.toISOString() });
    expect(store.dispositionFor('e1#CX-src-0')?.status).toBe('acknowledged');
    expect(await repo.listDispositions()).toHaveLength(1);
    expect(await store.reopen('e1#CX-src-0')).toBe(true);
    expect(store.dispositionFor('e1#CX-src-0')).toBeUndefined();
    expect(await repo.listDispositions()).toHaveLength(0);
  });

  it('dismiss requires a trimmed, non-empty reason of at most 1000 characters', async () => {
    const store = useReviewStore();
    expect(await store.dismiss('f', '   ', NOW)).toBeNull();
    expect(await store.dismiss('f', 'x'.repeat(DISMISS_REASON_MAX + 1), NOW)).toBeNull();
    const d = await store.dismiss('f', '  exported for a plugin API  ', NOW);
    expect(d?.reason).toBe('exported for a plugin API');
    expect(store.dispositionFor('f')?.status).toBe('dismissed');
  });

  it('a later decision replaces the earlier one for the same fingerprint', async () => {
    const store = useReviewStore();
    await store.acknowledge('f', NOW);
    await store.dismiss('f', 'reason', NOW);
    expect(store.dispositions).toHaveLength(1);
    expect(store.dispositionFor('f')?.status).toBe('dismissed');
  });

  it('persists before mutating: a rejecting port leaves state unchanged and clears pending', async () => {
    const base = createInMemoryReviewRepository();
    const store = useReviewStore();
    store.setRepository({ ...base, saveDisposition: () => Promise.reject(new Error('save failed')) });
    await expect(store.acknowledge('f', NOW)).rejects.toThrow('save failed');
    expect(store.dispositionFor('f')).toBeUndefined();
    expect(store.isDispositionPending('f')).toBe(false);
  });

  it('refuses a second decision while the first is saving', async () => {
    let release: () => void = noop;
    const base = createInMemoryReviewRepository();
    const slow: ReviewRepository = {
      ...base, saveDisposition: (d) => new Promise((res) => { release = () => { void base.saveDisposition(d).then(res); }; }),
    };
    const store = useReviewStore();
    store.setRepository(slow);
    const first = store.acknowledge('f', NOW);
    expect(store.isDispositionPending('f')).toBe(true);
    expect(await store.dismiss('f', 'why', NOW)).toBeNull();
    release();
    await first;
    expect(store.dispositionFor('f')?.status).toBe('acknowledged');
  });

  it('load() reads dispositions, including ones for findings no longer present', async () => {
    const repo = createInMemoryReviewRepository();
    await repo.saveDisposition({ fingerprint: 'gone#CX-x-0', status: 'dismissed', reason: 'r', decidedAt: NOW.toISOString() });
    const store = useReviewStore();
    store.setRepository(repo);
    await store.load();
    expect(store.dispositionFor('gone#CX-x-0')?.reason).toBe('r');
  });

  // E32: reopen() is pending-aware like decide() and returns whether it actually removed
  // anything, so a caller refused while a decision is mid-save can tell the difference
  // from a successful reopen.
  it('refuses reopen while a decision for the same fingerprint is still saving', async () => {
    let release: () => void = noop;
    const base = createInMemoryReviewRepository();
    const slow: ReviewRepository = {
      ...base, saveDisposition: (d) => new Promise((res) => { release = () => { void base.saveDisposition(d).then(res); }; }),
    };
    const store = useReviewStore();
    store.setRepository(slow);
    const first = store.acknowledge('f', NOW);
    expect(await store.reopen('f')).toBe(false);
    release();
    await first;
    expect(store.dispositionFor('f')?.status).toBe('acknowledged');
  });

  it('reopen persists before mutating: a rejecting port leaves the disposition in place and clears pending', async () => {
    const repo = createInMemoryReviewRepository();
    const store = useReviewStore();
    store.setRepository(repo);
    await store.acknowledge('f', NOW);
    store.setRepository({ ...repo, removeDisposition: () => Promise.reject(new Error('remove failed')) });
    await expect(store.reopen('f')).rejects.toThrow('remove failed');
    expect(store.dispositionFor('f')?.status).toBe('acknowledged');
    expect(store.isDispositionPending('f')).toBe(false);
  });
});
