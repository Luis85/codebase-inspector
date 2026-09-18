// Split out of city-view.test.ts, task 11 fix round 1, item 0 (it was at the
// tests/** 450-line cap). Same 'jsdom' project routing reason as that file (real
// DOM to mount Vue and measure contentEl); vitest.config.ts's `city-view*.test.ts`
// glob picks this up by the same prefix. Helper doubles are deliberately
// duplicated rather than shared, matching this codebase's own per-test-file
// self-containment convention.
import { describe, expect, it, vi } from 'vitest';
import { CityView } from '../../src/host/city-view';
import { InMemorySnapshotStore } from '../../src/adapters/storage/in-memory-snapshot-store';
import { createFakeSourceFileSystem } from '../fixtures/fake-source-filesystem';
import { createFixedClock } from '../fixtures/clock';
import { buildSnapshotFixture } from '../fixtures/snapshot-builder';
import { defaultCityViewState } from '../../src/host/view-state';
import type { CameraBookmark, CodebaseSnapshot } from '../../src/domain/model';
import type { CityRendererPort } from '../../src/visualization/renderer-port';
import type { CityViewDeps } from '../../src/host/city-view';
import type { CodebaseProfile } from '../../src/domain/model';
import type { ProfileStore } from '../../src/application/ports/profile-store';

const FAKE_ROOT_SCOPE = { rootPath: '/fake-root', exclusions: [], maxFileBytes: 5_000_000, followSymlinks: false as const };

/** A publishable snapshot whose scope's rootPath matches createFakeSourceFileSystem's
 *  fixed '/fake-root', so a refresh driven against it can genuinely reach 'running'. */
function publishedSnapshot(overrides: Partial<CodebaseSnapshot> = {}): CodebaseSnapshot {
  return {
    ...buildSnapshotFixture({ files: 1, repositoryId: 'p1' }),
    snapshotId: 's1',
    scope: FAKE_ROOT_SCOPE,
    ...overrides,
  };
}

async function waitUntilRunning(view: CityView): Promise<void> {
  for (let i = 0; i < 50 && !view.isScanRunning(); i += 1) await Promise.resolve();
}

async function waitForModal(): Promise<HTMLElement> {
  for (let i = 0; i < 50; i += 1) {
    const modal = document.querySelector('.modal-container');
    if (modal) return modal as HTMLElement;
    await Promise.resolve();
  }
  throw new Error('test setup: no modal opened');
}

const DUMMY_CAMERA: CameraBookmark = {
  projection: 'orthographic', mode: '3d',
  position: [0, 0, 0], target: [0, 0, 0], up: [0, 1, 0], zoom: 1,
};

const inertPort: CityRendererPort = {
  setLayout: vi.fn(async () => {}),
  setColors: vi.fn(),
  setSelection: vi.fn(),
  setFilter: vi.fn(),
  setLabels: vi.fn(),
  setCameraMode: vi.fn(),
  setMotion: vi.fn(),
  getCamera: vi.fn((): CameraBookmark => DUMMY_CAMERA),
  setCamera: vi.fn(),
  nudgeCamera: vi.fn(),
  focus: vi.fn(),
  fit: vi.fn(),
  resize: vi.fn(),
  pause: vi.fn(),
  resume: vi.fn(),
  dispose: vi.fn(),
  getDiagnostics: vi.fn(() => ({
    geometries: 0, textures: 0, programs: 0, drawCalls: 0, instanceCount: 0,
    lastFrameMs: 0, contextLost: false,
  })),
  debugLoseContext: vi.fn(),
};

vi.mock('../../src/visualization/city-renderer', () => ({
  createCityRenderer: vi.fn(() => inertPort),
}));

function makePluginDouble(): {
  app: { workspace: Record<string, ReturnType<typeof vi.fn>>; vault: { adapter: Record<string, ReturnType<typeof vi.fn>>; configDir: string } };
} {
  return {
    app: {
      workspace: {
        onLayoutReady: vi.fn(),
        getLeavesOfType: vi.fn(() => []),
        getLeaf: vi.fn(),
        revealLeaf: vi.fn(async () => {}),
        on: vi.fn(() => ({})),
        offref: vi.fn(),
      },
      vault: { adapter: { read: vi.fn(), list: vi.fn() }, configDir: '.obsidian' },
    },
  };
}

function makeLeafDouble(width = 1000): { width: number } {
  return { width };
}

function makeProfileStoreDouble(initial: CodebaseProfile[] = []): ProfileStore {
  const profiles = [...initial];
  return {
    list: vi.fn(async () => [...profiles]),
    get: vi.fn(async (id: string) => profiles.find((p) => p.profileId === id) ?? null),
    save: vi.fn(async (p: CodebaseProfile) => { profiles.push(p); }),
    remove: vi.fn(async () => {}),
    update: vi.fn(async () => {}),
  };
}

// Ruling M46 (fix round 3, Important): "Select a codebase" and scan-codebase's own
// refresh-when-a-snapshot-exists behaviour are now two DIFFERENT methods
// (selectCodebase vs startScan) sharing one guard, specifically so the button never
// becomes a silent no-op once a snapshot exists.
describe('selectCodebase vs startScan (ruling M46)', () => {
  function depsWithSnapshot(): { deps: CityViewDeps; snapshotStore: InMemorySnapshotStore } {
    const snapshotStore = new InMemorySnapshotStore(createFixedClock());
    snapshotStore.put(publishedSnapshot());
    const { port } = createFakeSourceFileSystem({});
    const profileStore = makeProfileStoreDouble([
      { profileId: 'p1', name: 'Alpha', bindingId: null, exclusions: [], maxFileBytes: 5_000_000 },
    ]);
    return { deps: { profileStore, getFilesystem: () => port, snapshotStore, clock: createFixedClock() }, snapshotStore };
  }

  async function viewWithSnapshot(deps: CityViewDeps): Promise<CityView> {
    const view = new CityView(makeLeafDouble() as never, makePluginDouble() as never, deps);
    await view.setState({ ...defaultCityViewState(), profileId: 'p1', snapshotId: 's1' }, {} as never);
    await view.onOpen();
    return view;
  }

  it('"Select a codebase" ALWAYS opens the modal, even with a snapshot already present', async () => {
    const { deps } = depsWithSnapshot();
    const view = await viewWithSnapshot(deps);

    // App.vue is still task 3's welcome-only shell (task 9 builds the real C01 shell
    // with its own "Select a codebase" affordance once a city is showing) -- calling
    // selectCodebase() directly is exactly what that future affordance's click
    // handler will do, and is what App.vue's OWN button already calls today.
    const selectPromise = view.selectCodebase();
    const modal = await waitForModal();
    expect(modal.textContent).toContain('Select a codebase');
    modal.querySelector<HTMLButtonElement>('[data-action="cancel"]')!.click();
    await selectPromise;
  });

  // Ruling M57 (fix wave item 4, resolves I3): the WIRING, not the rule -- runRefresh's
  // own four cases live in tests/component/consent-chain.test.ts. This pins that
  // city-view.ts actually hands runRefresh the App and the ProfileStore it needs to
  // open and settle that consent screen; before M57 it passed neither, and `profile`
  // was used only for its id.
  it('opens the scope modal from scan-codebase when Settings changed the scope (M57 wiring)', async () => {
    const snapshotStore = new InMemorySnapshotStore(createFixedClock());
    snapshotStore.put(publishedSnapshot());
    const { port } = createFakeSourceFileSystem({});
    const profileStore = makeProfileStoreDouble([
      // Diverges from FAKE_ROOT_SCOPE's `exclusions: []` -- the Settings edit itself.
      { profileId: 'p1', name: 'Alpha', bindingId: null, exclusions: ['node_modules'], maxFileBytes: 5_000_000 },
    ]);
    const deps: CityViewDeps = { profileStore, getFilesystem: () => port, snapshotStore, clock: createFixedClock() };
    const view = new CityView(makeLeafDouble() as never, makePluginDouble() as never, deps);
    await view.setState({ ...defaultCityViewState(), profileId: 'p1', snapshotId: 's1' }, {} as never);
    await view.onOpen();

    const runPromise = view.startScan();
    const modal = await waitForModal();
    expect(modal.textContent).toContain('Review scope and read access');
    expect(modal.textContent).toContain('node_modules');

    modal.querySelector<HTMLButtonElement>('[data-action="cancel"]')!.click();
    await runPromise;
    // Cancelled: nothing scanned, the retained snapshot is untouched.
    expect(snapshotStore.latestFor('p1')?.snapshotId).toBe('s1');
    document.querySelectorAll('.modal-container').forEach((el) => { el.remove(); });
  });

  it('scan-codebase\'s startScan() still refreshes silently, with NO modal, when a snapshot exists', async () => {
    const { deps, snapshotStore } = depsWithSnapshot();
    const view = await viewWithSnapshot(deps);

    const runPromise = view.startScan();
    await waitUntilRunning(view);
    expect(document.querySelector('.modal-container')).toBeNull();
    await runPromise;
    // A real refresh happened -- a NEW snapshot was published, not the modal chain.
    expect(snapshotStore.latestFor('p1')?.snapshotId).not.toBe('s1');
  });

  // The two production store-wiring tests (item 1) that used to follow here also
  // moved to tests/host/city-view-store-wiring.test.ts, for the same budget
  // reason as the Pinia test above.
});
