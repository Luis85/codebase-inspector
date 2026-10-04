// Gap closure GRA4 fix round: a refresh that finds the root unavailable (ROOT_UNAVAILABLE) keeps the PREVIOUS run's
// `run` object, but it still notifies every listener. CityView must mirror it into the run store (so the banner and
// `rootUnavailable` reach the UI) and must NOT replay the previous run's reaction: no cancelled or failed Notice, no
// second layout publish, no second reconciliation. Routed to jsdom by vitest.config.ts's `tests/host/city-view*.test.ts`.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { nextTick } from 'vue';
import type { Pinia } from 'pinia';
import { CityView } from '../../src/host/city-view';
import { InMemorySnapshotStore } from '../../src/adapters/storage/in-memory-snapshot-store';
import { computeLayout } from '../../src/domain/layout/layout';
import { createFakeSourceFileSystem } from '../fixtures/fake-source-filesystem';
import { createFixedClock } from '../fixtures/clock';
import { dataPortDeps } from '../fixtures/data-port-deps';
import { buildSnapshotFixture } from '../fixtures/snapshot-builder';
import { defaultCityViewState } from '../../src/host/view-state';
import { makePluginDouble } from '../fixtures/city-view-doubles';
import { useRunStore } from '../../src/ui/stores/run-store';
import type { CameraBookmark, CodebaseProfile, CodebaseSnapshot } from '../../src/domain/model';
import type { CityRendererPort } from '../../src/visualization/renderer-port';
import type { CityViewDeps } from '../../src/host/city-view';
import type { ProfileStore } from '../../src/application/ports/profile-store';
import type { SourceFileSystemPort } from '../../src/application/ports/source-filesystem-port';

const DUMMY_CAMERA: CameraBookmark = {
  projection: 'orthographic', mode: '3d', position: [0, 0, 0], target: [0, 0, 0], up: [0, 1, 0], zoom: 1,
};
const inertPort: CityRendererPort = {
  setLayout: vi.fn(async () => {}), setColors: vi.fn(), setSelection: vi.fn(), setFilter: vi.fn(), setReported: vi.fn(), setRelations: vi.fn(),
  setLabels: vi.fn(), setCameraMode: vi.fn(), setMotion: vi.fn(),
  getCamera: vi.fn((): CameraBookmark => DUMMY_CAMERA), setCamera: vi.fn(), nudgeCamera: vi.fn(),
  focus: vi.fn(), fit: vi.fn(), resize: vi.fn(), pause: vi.fn(), resume: vi.fn(), dispose: vi.fn(),
  getDiagnostics: vi.fn(() => ({
    geometries: 0, textures: 0, programs: 0, drawCalls: 0, instanceCount: 0, lastFrameMs: 0, contextLost: false,
  })),
  debugLoseContext: vi.fn(),
};
vi.mock('../../src/visualization/city-renderer', () => ({ createCityRenderer: vi.fn(() => inertPort) }));
vi.mock('../../src/domain/layout/layout', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/domain/layout/layout')>();
  return { ...actual, computeLayout: vi.fn(actual.computeLayout) };
});

function publishedSnapshot(): CodebaseSnapshot {
  return {
    ...buildSnapshotFixture({ files: 1, repositoryId: 'p1' }),
    snapshotId: 's1',
    scope: { rootPath: '/fake-root', exclusions: [], maxFileBytes: 5_000_000, followSymlinks: false as const },
  };
}

function makeProfileStoreDouble(initial: CodebaseProfile[]): ProfileStore {
  const profiles = [...initial];
  return {
    list: vi.fn(async () => [...profiles]),
    get: vi.fn(async (id: string) => profiles.find((p) => p.profileId === id) ?? null),
    save: vi.fn(async (p: CodebaseProfile) => { profiles.push(p); }),
    remove: vi.fn(async () => {}),
    update: vi.fn(async () => {}),
  };
}

async function waitUntilRunning(view: CityView): Promise<void> {
  for (let i = 0; i < 50 && !view.isScanRunning(); i += 1) await Promise.resolve();
}

/** The view's own run store (its pinia is private): what the leaf's StatusBanner reads. */
const runStoreOf = (view: CityView): ReturnType<typeof useRunStore> => useRunStore((view as unknown as { pinia: Pinia }).pinia);
const noticeTexts = (): string[] => [...document.querySelectorAll('.notice')].map((n) => n.textContent ?? '');

/** A view with snapshot 's1' whose filesystem answers `stat` as a missing folder once `gone.value` is set. */
async function openView() {
  const snapshotStore = new InMemorySnapshotStore(createFixedClock());
  snapshotStore.put(publishedSnapshot());
  const fake = createFakeSourceFileSystem({ 'a.ts': 'x', 'b.ts': 'y', 'c.ts': 'z' }).port;
  const gone = { value: false };
  const port: SourceFileSystemPort = {
    ...fake,
    stat: async (path) => (gone.value
      ? { exists: false, isDirectory: false, isFile: false, isSymbolicLink: false, size: 0, mtimeMs: 0 }
      : fake.stat(path)),
  };
  const profileStore = makeProfileStoreDouble([
    { profileId: 'p1', name: 'Alpha', bindingId: null, exclusions: [], maxFileBytes: 5_000_000 },
  ]);
  const deps: CityViewDeps = { profileStore, getFilesystem: () => port, snapshotStore, clock: createFixedClock(), ...dataPortDeps() };
  const plugin = makePluginDouble();
  const view = new CityView({ width: 1000 } as never, plugin as never, deps);
  await view.setState({ ...defaultCityViewState(), profileId: 'p1', snapshotId: 's1' }, {} as never);
  await view.onOpen();
  await nextTick();
  return { view, gone, getLeaves: plugin.app.workspace.getLeavesOfType! };
}

describe('a refresh that finds the root unavailable replays nothing from the previous run (GRA4)', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    vi.mocked(computeLayout).mockClear();
  });

  it('after a CANCELLED run: no second Notice, and the run store shows the root as unavailable', async () => {
    const { view, gone } = await openView();
    const first = view.startScan();
    await waitUntilRunning(view);
    view.cancelScan();
    await first;
    expect(noticeTexts()).toHaveLength(1);   // the cancelled run's own Notice

    gone.value = true;
    await view.startScan();
    expect(noticeTexts()).toHaveLength(1);
    const runStore = runStoreOf(view);
    expect(runStore.rootUnavailable).toBe(true);
    expect(runStore.banner).toContain('The source directory is no longer available');
    await view.onClose();
  });

  it('after a COMPLETED run: no second layout publish and no second reconcile, and the store shows it', async () => {
    const { view, gone, getLeaves } = await openView();
    await view.startScan();
    const published = vi.mocked(computeLayout).mock.calls.length;
    const reconciled = getLeaves.mock.calls.length;
    expect(published).toBeGreaterThan(0);
    expect(reconciled).toBeGreaterThan(0);

    gone.value = true;
    await view.startScan();
    expect(vi.mocked(computeLayout).mock.calls.length).toBe(published);
    expect(getLeaves.mock.calls.length).toBe(reconciled);
    expect(runStoreOf(view).rootUnavailable).toBe(true);
    await view.onClose();
  });
});
