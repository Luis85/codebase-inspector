// Polish C16 (Part 7 Z35): the four analysis delegations on a REAL CityView, before onOpen (no
// Pinia) and after it, with and without a snapshot. commands.ts calls them through
// getActiveViewOfType; fallow-commands.test.ts uses a view double, so their guards were unpinned.
import { describe, expect, it, vi } from 'vitest';
import { flushPromises } from '@vue/test-utils';
import { getActivePinia, type Pinia } from 'pinia';
import { CityView, type CityViewDeps } from '../../src/host/city-view';
import { defaultCityViewState } from '../../src/host/view-state';
import { InMemorySnapshotStore } from '../../src/adapters/storage/in-memory-snapshot-store';
import type { AnalysisIdentity } from '../../src/application/analysis/analysis-state';
import { useAnalysisStore } from '../../src/ui/stores/analysis-store';
import { useCityStore } from '../../src/ui/stores/city-store';
import { createFakeProfileStoreHarness } from '../fixtures/fake-profile-store';
import { createFakeSourceFileSystem } from '../fixtures/fake-source-filesystem';
import { createFixedClock } from '../fixtures/clock';
import { buildSnapshotFixture } from '../fixtures/snapshot-builder';
import { dataPortDeps } from '../fixtures/data-port-deps';
import { createFakeFallowAnalysis, type FakeFallowAnalysis } from '../fixtures/fake-fallow-analysis';

// A fresh leaf opens on Overview, so no renderer is ever built; the mock keeps three.js out.
vi.mock('../../src/visualization/city-renderer', () => ({ createCityRenderer: vi.fn() }));

const ID: AnalysisIdentity = { profileId: 'p1', snapshotId: 's1', rootFingerprint: 'a', subjectFingerprint: 'b', runId: 'r1', generation: 0 };
const RUNNING = { status: 'running', identity: ID, rootPath: '/repo', startedAt: '2026-09-23T10:00:00.000Z', timeoutSeconds: 120, version: '3.27.0', tested: true } as const;

function makePluginDouble() {
  return {
    app: {
      workspace: {
        onLayoutReady: vi.fn(), getLeavesOfType: vi.fn(() => []), getLeaf: vi.fn(),
        revealLeaf: vi.fn(async () => {}), on: vi.fn(() => ({})), offref: vi.fn(),
      },
      vault: { adapter: { read: vi.fn(), list: vi.fn() }, configDir: '.obsidian' },
    },
  };
}

function makeDeps(fallowAnalysis: FakeFallowAnalysis): CityViewDeps {
  const snapshotStore = new InMemorySnapshotStore(createFixedClock());
  snapshotStore.put({ ...buildSnapshotFixture({ files: 3, repositoryId: 'p1' }), snapshotId: 's1' });
  return {
    profileStore: createFakeProfileStoreHarness().store, getFilesystem: () => createFakeSourceFileSystem({}).port,
    snapshotStore, clock: createFixedClock(), ...dataPortDeps(), fallowAnalysis,
  };
}

async function openView(deps: CityViewDeps, withSnapshot = true): Promise<{ view: CityView; pinia: Pinia }> {
  const view = new CityView({ width: 1000, height: 700 } as never, makePluginDouble() as never, deps);
  if (withSnapshot) await view.setState({ ...defaultCityViewState(), profileId: 'p1', snapshotId: 's1' }, {} as never);
  await view.onOpen();
  await flushPromises();
  const pinia = getActivePinia();
  if (!pinia) throw new Error('test setup: the view installed no Pinia');
  return { view, pinia };
}

describe('CityView analysis delegations (Polish C16)', () => {
  it('before onOpen (no Pinia) they answer false and reach nothing', () => {
    const fake = createFakeFallowAnalysis();
    const view = new CityView({ width: 1000, height: 700 } as never, makePluginDouble() as never, makeDeps(fake));
    expect([view.isAnalysisActive(), view.isAnalysisCancellable()]).toEqual([false, false]);
    expect(() => { view.requestFallowRun(); view.cancelAnalysis(); }).not.toThrow();
    expect(fake.calls).toEqual([]);
  });

  it('without a snapshot, requestFallowRun raises no request', async () => {
    const { view, pinia } = await openView(makeDeps(createFakeFallowAnalysis()), false);
    view.requestFallowRun();
    expect(useAnalysisStore(pinia).runRequested).toBe(false);
    await view.onClose();
  });

  it('with a snapshot it raises the request, mirrors the run, and cancels through the service', async () => {
    const fake = createFakeFallowAnalysis();
    const { view, pinia } = await openView(makeDeps(fake));
    view.requestFallowRun();
    expect(useAnalysisStore(pinia).runRequested).toBe(true);
    await flushPromises();
    expect(useCityStore(pinia).route).toBe('sources');
    fake.setState('p1', RUNNING);
    expect([view.isAnalysisActive(), view.isAnalysisCancellable()]).toEqual([true, true]);
    view.cancelAnalysis();
    expect(fake.calls).toContainEqual({ method: 'cancel', profileId: 'p1' });
    fake.setState('p1', { status: 'cancelling', identity: ID });
    expect([view.isAnalysisActive(), view.isAnalysisCancellable()]).toEqual([true, false]);
    await view.onClose();
  });
});
