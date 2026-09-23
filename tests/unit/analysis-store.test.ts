// Part 7 Z28: the per-leaf analysis store mirrors the plugin's service for the bound
// codebase only, reads its binding, carries the command's run request, and drops its
// subscription when the leaf goes.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { useAnalysisStore } from '../../src/ui/stores/analysis-store';
import type { AnalysisIdentity } from '../../src/application/analysis/analysis-state';
import { AnalysisCoordinator } from '../../src/application/analysis/analysis-coordinator';
import { createFallowAnalysisService } from '../../src/application/analysis/fallow-analysis-service';
import { createCancellationToken } from '../../src/application/scan-coordinator';
import { InMemoryEvidenceStore } from '../../src/adapters/storage/in-memory-evidence-store';
import { InMemorySnapshotStore } from '../../src/adapters/storage/in-memory-snapshot-store';
import { buildSnapshotFixture } from '../fixtures/snapshot-builder';
import { createFixedClock } from '../fixtures/clock';
import { createFakeProcessPort } from '../fixtures/fake-process-port';
import { createFakeExecutableInspector } from '../fixtures/fake-executable-inspector';
import { createInMemoryAnalyzerStore } from '../fixtures/in-memory-analyzer-store';
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
    expect(await store.forget()).toBe('busy');
    fake.next.forget = 'forgotten';
    fake.setState('p1', { status: 'idle' });
    expect(await store.forget()).toBe('forgotten');
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
    expect([fake.listenerCount(), fake.bindingListenerCount()]).toEqual([1, 1]);
    store.$dispose();
    expect([fake.listenerCount(), fake.bindingListenerCount()]).toEqual([0, 0]);
  });
});

/** The REAL service over in-memory ports: nothing here runs a process. */
function realService() {
  const clock = createFixedClock('2026-09-23T10:00:00.000Z');
  const snapshots = new InMemorySnapshotStore(clock);
  const coordinator = new AnalysisCoordinator({
    process: createFakeProcessPort(), evidence: new InMemoryEvidenceStore(), snapshots, clock, createCancellationToken,
  });
  const records = createInMemoryAnalyzerStore('m');
  const service = createFallowAnalysisService({
    store: records, inspector: createFakeExecutableInspector('fallow'), coordinator, snapshots,
    getFilesystem: () => { throw new Error('unused: nothing is reviewed here'); }, machineId: 'm', clock,
  });
  return { records, service };
}

describe('useAnalysisStore follows binding writes made elsewhere (final review)', () => {
  it('a time-limit change and a Forget made through the service (Settings) refresh an open store', async () => {
    const { records, service } = realService();
    await records.bind('p1', '/opt/fallow/bin/fallow');
    const store = useAnalysisStore();
    store.setService(service);
    store.bindRepository('p1');
    await flushPromises();
    expect(store.binding).toMatchObject({ kind: 'bound', binding: { timeoutSeconds: 120 } });
    expect(await service.setTimeLimit('p1', 300)).toBe('saved');
    await flushPromises();
    expect(store.binding).toMatchObject({ kind: 'bound', binding: { timeoutSeconds: 300 } });
    expect(await service.forget('p1')).toBe('forgotten');
    await flushPromises();
    expect(store.binding).toEqual({ kind: 'none', executableName: 'fallow' });
  });

  it('ignores another codebase\'s writes, and stops listening when the leaf goes', async () => {
    const { records, service } = realService();
    await records.bind('p1', '/opt/fallow/bin/fallow');
    await records.bind('p2', '/opt/fallow/bin/fallow');
    const reads = vi.spyOn(service, 'readBinding');
    const store = useAnalysisStore();
    store.setService(service);
    store.bindRepository('p1');
    await flushPromises();
    const settled = reads.mock.calls.length;
    await service.setTimeLimit('p2', 300);
    await flushPromises();
    expect(reads.mock.calls.length).toBe(settled);
    await service.setTimeLimit('p1', 240);
    await flushPromises();
    expect(reads.mock.calls).toHaveLength(settled + 1);
    store.$dispose();
    await service.forget('p1');
    await flushPromises();
    expect(reads.mock.calls).toHaveLength(settled + 1);
  });
});

describe('Polish C1, C11, C13: binding truth in the store', () => {
  it('C1: a failed read is readFailed, not "none"; the next good read clears it', async () => {
    const fake = createFakeFallowAnalysis('fallow');
    const read = fake.readBinding.bind(fake);
    let failing = true;
    fake.readBinding = (id) => (failing ? Promise.reject(new Error('EIO')) : read(id));
    const store = useAnalysisStore();
    store.setService(fake);
    store.bindRepository('p1');
    await flushPromises();
    expect([store.binding, store.readFailed]).toEqual([null, true]);
    failing = false;
    fake.setBinding('p1', { kind: 'none' });
    await flushPromises();
    expect([store.binding, store.readFailed]).toEqual([{ kind: 'none', executableName: 'fallow' }, false]);
  });

  it('C1 (L2): the executable name comes from the service before any read lands', () => {
    const store = useAnalysisStore();
    store.setService(createFakeFallowAnalysis('fallow'));
    expect(store.executableName).toBe('fallow');
  });

  it('C11: a Forget that succeeded resolves forgotten even when the re-read fails', async () => {
    const fake = createFakeFallowAnalysis();
    fake.setBinding('p1', { kind: 'bound', binding: { profileId: 'p1', executablePath: 'C:\\f\\fallow.exe', timeoutSeconds: 120, trust: null } });
    const store = useAnalysisStore();
    store.setService(fake);
    store.bindRepository('p1');
    await flushPromises();
    fake.readBinding = () => Promise.reject(new Error('EIO'));
    await expect(store.forget()).resolves.toBe('forgotten');
    expect(store.readFailed).toBe(true);
  });

  it('C13: refreshBinding is internal to the store', () => {
    const store = useAnalysisStore();
    // @ts-expect-error Polish C13: not part of the store's surface.
    expect(store.refreshBinding).toBeUndefined();
  });
});
