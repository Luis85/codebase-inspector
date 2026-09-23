// WP-02 Part 5 (V6): Cancel scan from the leaf reaches the SAME CityView.cancelScan the
// 'cancel-scan' command calls, through provideScanCallbacks' 'onCancelScan'. A real
// CityView, a real coordinator and a refresh that is genuinely running (the pattern in
// city-view.test.ts), so the button is proven end to end rather than against a double.
// Routed to the jsdom project by vitest.config.ts's `tests/host/city-view*.test.ts`.
import { describe, expect, it, vi } from 'vitest';
import { nextTick } from 'vue';
import { CityView } from '../../src/host/city-view';
import { InMemorySnapshotStore } from '../../src/adapters/storage/in-memory-snapshot-store';
import { createFakeSourceFileSystem } from '../fixtures/fake-source-filesystem';
import { createFixedClock } from '../fixtures/clock';
import { dataPortDeps } from '../fixtures/data-port-deps';
import { buildSnapshotFixture } from '../fixtures/snapshot-builder';
import { defaultCityViewState } from '../../src/host/view-state';
import type { CameraBookmark, CodebaseProfile, CodebaseSnapshot } from '../../src/domain/model';
import type { CityRendererPort } from '../../src/visualization/renderer-port';
import type { CityViewDeps } from '../../src/host/city-view';
import type { ProfileStore } from '../../src/application/ports/profile-store';

const DUMMY_CAMERA: CameraBookmark = {
  projection: 'orthographic', mode: '3d', position: [0, 0, 0], target: [0, 0, 0], up: [0, 1, 0], zoom: 1,
};
const inertPort: CityRendererPort = {
  setLayout: vi.fn(async () => {}), setColors: vi.fn(), setSelection: vi.fn(), setFilter: vi.fn(),
  setLabels: vi.fn(), setCameraMode: vi.fn(), setMotion: vi.fn(),
  getCamera: vi.fn((): CameraBookmark => DUMMY_CAMERA), setCamera: vi.fn(), nudgeCamera: vi.fn(),
  focus: vi.fn(), fit: vi.fn(), resize: vi.fn(), pause: vi.fn(), resume: vi.fn(), dispose: vi.fn(),
  getDiagnostics: vi.fn(() => ({
    geometries: 0, textures: 0, programs: 0, drawCalls: 0, instanceCount: 0, lastFrameMs: 0, contextLost: false,
  })),
  debugLoseContext: vi.fn(),
};
vi.mock('../../src/visualization/city-renderer', () => ({ createCityRenderer: vi.fn(() => inertPort) }));

/** A snapshot whose scope's rootPath is createFakeSourceFileSystem's fixed '/fake-root',
 *  so a refresh against it genuinely reaches 'running'. */
function publishedSnapshot(): CodebaseSnapshot {
  return {
    ...buildSnapshotFixture({ files: 1, repositoryId: 'p1' }),
    snapshotId: 's1',
    scope: { rootPath: '/fake-root', exclusions: [], maxFileBytes: 5_000_000, followSymlinks: false as const },
  };
}

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

/** Microtask ticks only (no timer) until the coordinator is really running. */
async function waitUntilRunning(view: CityView): Promise<void> {
  for (let i = 0; i < 50 && !view.isScanRunning(); i += 1) await Promise.resolve();
}

/** A view restored onto `route` with snapshot 's1', so startScan() takes the silent
 *  refresh path (no modal) and reaches 'running'. */
async function openRefreshableView(route: 'city' | 'sources') {
  const snapshotStore = new InMemorySnapshotStore(createFixedClock());
  snapshotStore.put(publishedSnapshot());
  const { port } = createFakeSourceFileSystem({ 'a.ts': 'x', 'b.ts': 'y', 'c.ts': 'z' });
  const profileStore = makeProfileStoreDouble([
    { profileId: 'p1', name: 'Alpha', bindingId: null, exclusions: [], maxFileBytes: 5_000_000 },
  ]);
  const deps: CityViewDeps = { profileStore, getFilesystem: () => port, snapshotStore, clock: createFixedClock(), ...dataPortDeps() };
  const view = new CityView({ width: 1000 } as never, makePluginDouble() as never, deps);
  await view.setState({ ...defaultCityViewState(), profileId: 'p1', snapshotId: 's1', route }, {} as never);
  await view.onOpen();
  await nextTick();
  return { view, snapshotStore };
}

describe('Cancel scan from the leaf (Part 5 V6)', () => {
  it('the city toolbar\'s Cancel scan stops a running scan through onCancelScan', async () => {
    const { view, snapshotStore } = await openRefreshableView('city');
    const cancel = view.contentEl.querySelector<HTMLButtonElement>('.ci-toolbar__cancel');
    expect(cancel).not.toBeNull();
    expect(cancel!.getAttribute('aria-disabled')).toBe('true');

    const runPromise = view.startScan();
    await waitUntilRunning(view);
    expect(view.isScanRunning()).toBe(true);
    cancel!.click();
    expect(view.isScanRunning()).toBe(false);   // 'cancelling', synchronously
    await runPromise;
    // A genuinely stopped refresh publishes nothing: the retained snapshot is still 's1'.
    expect(snapshotStore.latestFor('p1')?.snapshotId).toBe('s1');
    await view.onClose();
  });

  it('Data & scans\' Cancel scan stops it the same way, without leaving the screen', async () => {
    const { view, snapshotStore } = await openRefreshableView('sources');
    const cancel = view.contentEl.querySelector<HTMLButtonElement>('.ci-sources__cancel');
    expect(cancel).not.toBeNull();

    const runPromise = view.startScan();
    await waitUntilRunning(view);
    expect(view.isScanRunning()).toBe(true);
    cancel!.click();
    expect(view.isScanRunning()).toBe(false);
    await runPromise;
    expect(snapshotStore.latestFor('p1')?.snapshotId).toBe('s1');
    expect(view.getState().route).toBe('sources');
    await view.onClose();
  });
});
