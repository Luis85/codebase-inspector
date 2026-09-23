// Part 7 Z28: the per-leaf analysis store mirrors the plugin's service for the bound
// codebase only, reads its binding, carries the command's run request, and drops its
// subscription when the leaf goes.
import { beforeEach, describe, expect, it } from 'vitest';
import { flushPromises } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { useAnalysisStore } from '../../src/ui/stores/analysis-store';
import type { AnalysisIdentity } from '../../src/application/analysis/analysis-state';
import { buildSnapshotFixture } from '../fixtures/snapshot-builder';
import { createFakeFallowAnalysis, fakeRunReview } from '../fixtures/fake-fallow-analysis';

const ID: AnalysisIdentity = { profileId: 'p1', snapshotId: 's1', rootFingerprint: 'a', subjectFingerprint: 'b', runId: 'r1', generation: 0 };
const RUNNING = { status: 'running', identity: ID, rootPath: '/repo', startedAt: '2026-09-23T10:00:00.000Z', timeoutSeconds: 120, version: '3.27.0', tested: true } as const;
const SNAP = buildSnapshotFixture({ files: 3, repositoryId: 'p1' });

beforeEach(() => { setActivePinia(createPinia()); });

describe('useAnalysisStore (Z28)', () => {
  it('mirrors the bound codebase\'s run and ignores every other codebase', () => {
    const fake = createFakeFallowAnalysis();
    const store = useAnalysisStore();
    store.setService(fake);
    store.bindRepository('p1');
    fake.setState('p2', RUNNING);
    expect(store.run.status).toBe('idle');
    fake.setState('p1', RUNNING);
    expect(store.run).toEqual(RUNNING);
    expect([store.active, store.cancellable]).toEqual([true, true]);
    fake.setState('p1', { status: 'cancelling', identity: ID });
    expect([store.active, store.cancellable]).toEqual([true, false]);
  });

  it('reads the binding on bind and after each notification; a late read for the previous codebase is dropped', async () => {
    const fake = createFakeFallowAnalysis('fallow');
    fake.setBinding('p1', { kind: 'bound', binding: { profileId: 'p1', executablePath: '/opt/fallow', timeoutSeconds: 120, trust: null } });
    const store = useAnalysisStore();
    store.setService(fake);
    store.bindRepository('p1');
    store.bindRepository('p2');
    await flushPromises();
    expect(store.binding).toEqual({ kind: 'none', executableName: 'fallow' });
    store.bindRepository('p1');
    await flushPromises();
    expect(store.binding).toMatchObject({ kind: 'bound', executableName: 'fallow' });
  });

  it('carries a run request once; a rebind drops it', () => {
    const store = useAnalysisStore();
    store.setService(createFakeFallowAnalysis());
    store.bindRepository('p1');
    store.requestRun();
    expect(store.consumeRunRequest()).toBe(true);
    expect(store.consumeRunRequest()).toBe(false);
    store.requestRun();
    store.bindRepository('p2');
    expect(store.runRequested).toBe(false);
  });

  it('forwards start, review and Trust and run for its own codebase, and answers null otherwise (K39)', async () => {
    const fake = createFakeFallowAnalysis();
    const store = useAnalysisStore();
    store.setService(fake);
    expect(await store.startOrReview(SNAP)).toBeNull();
    store.bindRepository('p1');
    fake.next.run = { kind: 'busy' };
    expect(await store.startOrReview(SNAP)).toEqual({ kind: 'busy' });
    expect(await store.startOrReview(buildSnapshotFixture({ files: 1, repositoryId: 'other' }))).toBeNull();
    expect(await store.review(SNAP, '/opt/fallow')).toMatchObject({ ok: true });
    expect(await store.trustAndRun(SNAP, fakeRunReview('p1', SNAP.snapshotId, SNAP.scope.rootPath))).toEqual({ kind: 'started' });
    expect(fake.calls.map((c) => c.method)).toEqual(expect.arrayContaining(['run', 'review', 'trustAndRun']));
  });

  it('cancels only a cancellable run; forget reports whether it happened', async () => {
    const fake = createFakeFallowAnalysis();
    const store = useAnalysisStore();
    store.setService(fake);
    store.bindRepository('p1');
    expect(store.cancel()).toBe(false);
    fake.setState('p1', RUNNING);
    expect(store.cancel()).toBe(true);
    expect(fake.calls.filter((c) => c.method === 'cancel')).toEqual([{ method: 'cancel', profileId: 'p1' }]);
    fake.next.forget = 'busy';
    expect(await store.forget()).toBe(false);
    fake.next.forget = 'forgotten';
    fake.setState('p1', { status: 'idle' });
    expect(await store.forget()).toBe(true);
  });

  it('forget lets a store failure reject, so the caller can say why (review fix 1)', async () => {
    const fake = createFakeFallowAnalysis();
    const failure = new Error('data.json could not be written');
    fake.forget = () => Promise.reject(failure);
    const store = useAnalysisStore();
    store.setService(fake);
    store.bindRepository('p1');
    await expect(store.forget()).rejects.toBe(failure);
  });

  it('$dispose drops its subscription to the plugin-level service', () => {
    const fake = createFakeFallowAnalysis();
    const store = useAnalysisStore();
    store.setService(fake);
    store.bindRepository('p1');
    expect(fake.listenerCount()).toBe(1);
    store.$dispose();
    expect(fake.listenerCount()).toBe(0);
  });
});
