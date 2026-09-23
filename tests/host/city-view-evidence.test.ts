// Part 6 Y28/Y29/Y39 with a real CityView:
// - the view gives its own evidence store the plugin's ONE repository;
// - App binds that store to the snapshot's codebase;
// - the command's two methods work;
// - closing the leaf (Task 4's unwireDataPorts in onClose) drops its listener.
// A new file, because city-view-store-wiring.test.ts is at 450/450.
import { describe, expect, it, vi } from 'vitest';
import { flushPromises } from '@vue/test-utils';
import { getActivePinia, type Pinia } from 'pinia';
import { CityView } from '../../src/host/city-view';
import { defaultCityViewState } from '../../src/host/view-state';
import { InMemorySnapshotStore } from '../../src/adapters/storage/in-memory-snapshot-store';
import { InMemoryEvidenceStore } from '../../src/adapters/storage/in-memory-evidence-store';
import { useCityStore } from '../../src/ui/stores/city-store';
import { useEvidenceStore } from '../../src/ui/stores/evidence-store';
import { createFakeProfileStoreHarness } from '../fixtures/fake-profile-store';
import { createFakeSourceFileSystem } from '../fixtures/fake-source-filesystem';
import { createFixedClock } from '../fixtures/clock';
import { buildSnapshotFixture } from '../fixtures/snapshot-builder';
import { dataPortDeps } from '../fixtures/data-port-deps';
import { emptyEvidenceReport } from '../fixtures/evidence-report';
import type { CityViewDeps } from '../../src/host/city-view';
import type { EvidenceRepository } from '../../src/application/ports/evidence-repository';

// A fresh leaf opens on Overview, so no renderer is ever built. The mock only keeps
// three.js out of this file.
vi.mock('../../src/visualization/city-renderer', () => ({ createCityRenderer: vi.fn() }));

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

/** The shared repository, counting its live subscriptions. */
function counting(): { repository: EvidenceRepository; live: () => number } {
  const inner = new InMemoryEvidenceStore();
  let live = 0;
  const repository: EvidenceRepository = {
    get: (id) => inner.get(id),
    put: (id, report) => { inner.put(id, report); },
    remove: (id) => { inner.remove(id); },
    subscribe: (listener) => {
      live += 1;
      const off = inner.subscribe(listener);
      let done = false;
      return () => { if (done) return; done = true; live -= 1; off(); };
    },
  };
  return { repository, live: () => live };
}

function makeDeps(evidenceStore: EvidenceRepository): CityViewDeps {
  const snapshotStore = new InMemorySnapshotStore(createFixedClock());
  snapshotStore.put({ ...buildSnapshotFixture({ files: 3, repositoryId: 'p1' }), snapshotId: 's1' });
  return {
    profileStore: createFakeProfileStoreHarness().store,
    getFilesystem: () => createFakeSourceFileSystem({}).port,
    snapshotStore,
    clock: createFixedClock(),
    ...dataPortDeps(),
    evidenceStore,
  };
}

/** Opens a view (on the retained snapshot s1 unless told not to) and returns the Pinia it installed. */
async function openView(deps: CityViewDeps, withSnapshot = true): Promise<{ view: CityView; pinia: Pinia }> {
  const view = new CityView({ width: 1000, height: 700 } as never, makePluginDouble() as never, deps);
  if (withSnapshot) await view.setState({ ...defaultCityViewState(), profileId: 'p1', snapshotId: 's1' }, {} as never);
  await view.onOpen();
  await flushPromises();
  const pinia = getActivePinia();
  if (!pinia) throw new Error('test setup: the view installed no Pinia');
  return { view, pinia };
}

describe('CityView evidence wiring (Part 6 Y28/Y29/Y39)', () => {
  it('hasSnapshot() is false until a snapshot is on screen; openReportImport() opens Data & scans with the import request raised', async () => {
    const deps = makeDeps(new InMemoryEvidenceStore());
    const empty = await openView(deps, false);
    expect(empty.view.hasSnapshot()).toBe(false);
    const routeBefore = useCityStore(empty.pinia).route;
    empty.view.openReportImport();
    await flushPromises();
    expect(useCityStore(empty.pinia).route).toBe(routeBefore);
    expect(useEvidenceStore(empty.pinia).importRequested).toBe(false);
    await empty.view.onClose();
    const { view, pinia } = await openView(deps);
    expect(view.hasSnapshot()).toBe(true);
    view.openReportImport();
    // Part 6 E4: synchronously, before the flush. Task 10's SourcesScreen consumes the
    // request on mount (a watcher with `immediate: true`).
    expect(useEvidenceStore(pinia).importRequested).toBe(true);
    await flushPromises();
    expect(useCityStore(pinia).route).toBe('sources');
    expect(view.contentEl.querySelector('.ci-screen--sources')).not.toBeNull();
    await view.onClose();
  });

  it('two leaves on the same codebase share the plugin\'s one repository: an import in one shows in the other', async () => {
    const deps = makeDeps(new InMemoryEvidenceStore());
    const a = await openView(deps);
    const b = await openView(deps);
    expect(useEvidenceStore(a.pinia).repositoryId).toBe('p1');
    expect(useEvidenceStore(b.pinia).repositoryId).toBe('p1');
    const report = emptyEvidenceReport('s1');
    expect(useEvidenceStore(a.pinia).attach(report)).toBe(true);
    expect(useEvidenceStore(b.pinia).report).toBe(report);
    expect(deps.evidenceStore.get('p1')).toBe(report);
    await a.view.onClose();
    await b.view.onClose();
  });

  it('closing a leaf drops its listener on the shared repository', async () => {
    const { repository, live } = counting();
    const deps = makeDeps(repository);
    const a = await openView(deps);
    const b = await openView(deps);
    expect(live()).toBe(2);
    await b.view.onClose();
    expect(live()).toBe(1);
    await a.view.onClose();
    expect(live()).toBe(0);
  });
});
