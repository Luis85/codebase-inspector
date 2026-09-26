// Part 6 Y10/Y12/Y7: the ReviewRepository port's id allocation, notifications and
// diagnostics, as the in-memory adapter implements them. Task 3's contract suite
// (tests/contracts/review-repository.contract.ts) runs the same rules against both adapters;
// these are the Part 5 bucket-counter assertions, moved to the port that now owns the ids.
import { describe, expect, it, vi } from 'vitest';
import {
  NO_CHECKS, createInMemoryReviewRepository, formatReviewId, reviewIdSuffix, type WorkItem,
} from '../../src/ui/stores/ports/review-repository';

const AT = '2026-09-23T10:00:00.000Z';
const item = (id: string): WorkItem => ({
  id, target: { kind: 'package', name: id }, intent: 'review', title: id, status: 'planned',
  priority: 'medium', notes: '', checks: NO_CHECKS, createdAt: AT,
});

describe('review id format (Part 6 Y10)', () => {
  it('formats wi-N and AR-NNN (three digits minimum), as the store did before Part 6', () => {
    expect(formatReviewId('workItem', 1)).toBe('wi-1');
    expect(formatReviewId('workItem', 1234)).toBe('wi-1234');
    expect(formatReviewId('rule', 7)).toBe('AR-007');
    expect(formatReviewId('rule', 1234)).toBe('AR-1234');
  });

  it('reads the number back from either kind, and null from anything else', () => {
    expect(reviewIdSuffix('wi-12')).toBe(12);
    expect(reviewIdSuffix('AR-007')).toBe(7);
    expect(reviewIdSuffix('wi-')).toBeNull();
    expect(reviewIdSuffix('w1')).toBeNull();
    expect(reviewIdSuffix('wi-1x')).toBeNull();
    // More than 15 digits could not be counted past exactly, so it never feeds the mark.
    expect(reviewIdSuffix(`wi-${'9'.repeat(16)}`)).toBeNull();
  });
});

describe('in-memory review repository (Part 6 Y10, Y12, Y7)', () => {
  it('allocates each kind in sequence, synchronously, never the same id twice', () => {
    const repo = createInMemoryReviewRepository();
    expect([repo.allocateId('workItem'), repo.allocateId('workItem'), repo.allocateId('rule')]).toEqual(['wi-1', 'wi-2', 'AR-001']);
  });

  it('a save raises the mark past the saved id; a removal never lowers it', async () => {
    const repo = createInMemoryReviewRepository();
    await repo.saveWorkItem(item('wi-7'));
    await repo.saveRule({ id: 'AR-012', from: 'a', to: 'b', rationale: 'r', createdAt: AT });
    expect(repo.allocateId('workItem')).toBe('wi-8');
    expect(repo.allocateId('rule')).toBe('AR-013');
    await repo.removeWorkItem('wi-7');
    await repo.removeRule('AR-012');
    expect(repo.allocateId('workItem')).toBe('wi-9');
    expect(repo.allocateId('rule')).toBe('AR-014');
  });

  it('notifies every subscriber once per write, before the write\'s promise resolves', async () => {
    const repo = createInMemoryReviewRepository();
    const seen: string[] = [];
    const first = vi.fn(() => { seen.push('notified'); });
    const second = vi.fn();
    repo.subscribe(first);
    const unsubscribe = repo.subscribe(second);
    const writes = [
      () => repo.saveWorkItem(item('wi-1')), () => repo.removeWorkItem('wi-1'),
      () => repo.saveRule({ id: 'AR-001', from: 'a', to: 'b', rationale: 'r', createdAt: AT }), () => repo.removeRule('AR-001'),
      () => repo.saveDisposition({ fingerprint: 'fp', status: 'acknowledged', decidedAt: AT }), () => repo.removeDisposition('fp'),
    ];
    for (const write of writes) {
      const settled = write().then(() => { seen.push('resolved'); });
      await settled;
    }
    expect(first).toHaveBeenCalledTimes(6);
    expect(second).toHaveBeenCalledTimes(6);
    expect(seen).toEqual(Array.from({ length: 12 }, (_, i) => (i % 2 === 0 ? 'notified' : 'resolved')));
    unsubscribe();
    await repo.saveWorkItem(item('wi-2'));
    expect(first).toHaveBeenCalledTimes(7);
    expect(second).toHaveBeenCalledTimes(6);
  });

  it('replaceAll swaps the whole state at once, notifies once, and never lowers the marks (R1)', async () => {
    const repo = createInMemoryReviewRepository();
    await repo.saveWorkItem(item('wi-20'));
    await repo.saveDisposition({ fingerprint: 'old', status: 'acknowledged', decidedAt: AT });
    const listener = vi.fn();
    repo.subscribe(listener);
    await repo.replaceAll({
      workItems: [item('wi-3')],
      rules: [{ id: 'AR-009', from: 'a', to: 'b', rationale: 'r', createdAt: AT }],
      dispositions: [],
    });
    expect(listener).toHaveBeenCalledTimes(1);
    expect((await repo.listWorkItems()).map((w) => w.id)).toEqual(['wi-3']);
    expect((await repo.listRules()).map((r) => r.id)).toEqual(['AR-009']);
    expect(await repo.listDispositions()).toEqual([]);
    expect(repo.allocateId('workItem')).toBe('wi-21');
    expect(repo.allocateId('rule')).toBe('AR-010');
    await repo.replaceAll({ workItems: [], rules: [], dispositions: [] });
    expect(listener).toHaveBeenCalledTimes(2);
    expect(await repo.listWorkItems()).toEqual([]);
    expect(repo.allocateId('workItem')).toBe('wi-22');
  });

  it('never notifies for a list', async () => {
    const repo = createInMemoryReviewRepository();
    const listener = vi.fn();
    repo.subscribe(listener);
    await Promise.all([repo.listWorkItems(), repo.listRules(), repo.listDispositions()]);
    expect(listener).not.toHaveBeenCalled();
  });

  it('reports no storage problems', () => {
    expect(createInMemoryReviewRepository().diagnostics()).toEqual({ skipped: 0, unsupported: false });
  });
});
