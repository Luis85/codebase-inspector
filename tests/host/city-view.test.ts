// Lives under tests/host/ (matching the brief's file list) but needs a real DOM to
// mount Vue and measure contentEl. vitest.config.ts routes this one file to the
// 'jsdom' project (by exact path) instead of the 'node' project the rest of
// tests/host/** uses, rather than moving the whole directory to jsdom.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CityView, CITY_VIEW_TYPE } from '../../src/host/city-view';
import { InMemorySnapshotStore } from '../../src/adapters/storage/in-memory-snapshot-store';
import { createFakeSourceFileSystem } from '../fixtures/fake-source-filesystem';
import { createFixedClock } from '../fixtures/clock';
import type { CameraBookmark } from '../../src/domain/model';
import type { CityRendererPort } from '../../src/visualization/renderer-port';
import type { CityViewDeps } from '../../src/host/city-view';
import type { CodebaseProfile } from '../../src/domain/model';
import type { ProfileStore } from '../../src/application/ports/profile-store';

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

// Imported AFTER vi.mock so this binding is the mocked, spy-wrapped function.
const { createCityRenderer: createRendererSpy } = await import('../../src/visualization/city-renderer');

function makePluginDouble(): { app: { workspace: Record<string, ReturnType<typeof vi.fn>>; vault: { adapter: Record<string, ReturnType<typeof vi.fn>> } } } {
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
      vault: { adapter: { read: vi.fn(), list: vi.fn() } },
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

function makeDepsDouble(overrides: Partial<CityViewDeps> = {}): CityViewDeps {
  const { port } = createFakeSourceFileSystem({});
  return {
    profileStore: makeProfileStoreDouble(),
    getFilesystem: () => port,
    snapshotStore: new InMemorySnapshotStore(createFixedClock()),
    clock: createFixedClock(),
    ...overrides,
  };
}

describe('CityView', () => {
  beforeEach(() => {
    vi.mocked(createRendererSpy).mockClear();
  });

  it('exposes the stable view identity', () => {
    const view = new CityView(makeLeafDouble() as never, makePluginDouble() as never, makeDepsDouble());
    expect(view.getViewType()).toBe(CITY_VIEW_TYPE);
    expect(typeof view.getDisplayText()).toBe('string');
    expect(typeof view.getIcon()).toBe('string');
  });

  it('creates no WebGL context in the constructor', () => {
    const view = new CityView(makeLeafDouble() as never, makePluginDouble() as never, makeDepsDouble());
    expect(view).toBeInstanceOf(CityView);
    expect(createRendererSpy).not.toHaveBeenCalled();
  });

  it('mounts Vue on contentEl, not containerEl.children[1]', async () => {
    const view = new CityView(makeLeafDouble() as never, makePluginDouble() as never, makeDepsDouble());
    await view.onOpen();
    expect(view.contentEl.classList.contains('codebase-inspector-root')).toBe(true);
  });

  it('performs no filesystem access and starts no scan on open', async () => {
    const plugin = makePluginDouble();
    const view = new CityView(makeLeafDouble() as never, plugin as never, makeDepsDouble());
    await view.onOpen();
    expect(plugin.app.vault.adapter.list).not.toHaveBeenCalled();
    expect(plugin.app.vault.adapter.read).not.toHaveBeenCalled();
  });

  it('shows the welcome state when no profile exists', async () => {
    const view = new CityView(makeLeafDouble() as never, makePluginDouble() as never, makeDepsDouble());
    await view.onOpen();
    expect(view.contentEl.textContent).toContain('Understand your codebase. Start with its structure.');
    expect(view.contentEl.textContent).toContain('Select a codebase');
    // COPY-20 is WP-02+ and must not leak forward.
    expect(view.contentEl.textContent).not.toContain('Unused candidate');
    // S01's "Analysis reports can be added later" promises a capability WP-01 does not ship.
    expect(view.contentEl.textContent).not.toContain('Analysis reports can be added later');
  });

  it('returns identifiers and presentation state only from getState()', async () => {
    const view = new CityView(makeLeafDouble() as never, makePluginDouble() as never, makeDepsDouble());
    await view.onOpen();
    const state = view.getState();
    expect(Object.keys(state).sort()).toEqual(['camera', 'inspectorOpen', 'previous3dCamera',
      'profileId', 'query', 'selectedEntityId', 'snapshotId', 'viewMode']);
    expect(JSON.stringify(state)).not.toMatch(/[A-Za-z]:\\\\/);   // no resolved absolute path
  });

  it('validates setState through the same validator as settings', async () => {
    const view = new CityView(makeLeafDouble() as never, makePluginDouble() as never, makeDepsDouble());
    await view.onOpen();
    await view.setState({ viewMode: 'vr', rootPath: 'C:\\evil' }, {} as never);
    expect(view.getState().viewMode).not.toBe('vr');
    expect(view.getState()).not.toHaveProperty('rootPath');
  });

  it('creates its own Pinia instance per view', async () => {
    const view1 = new CityView(makeLeafDouble() as never, makePluginDouble() as never, makeDepsDouble());
    const view2 = new CityView(makeLeafDouble() as never, makePluginDouble() as never, makeDepsDouble());
    await view1.onOpen();
    await view2.onOpen();
    // Each view's welcome copy renders independently — if they shared one Pinia
    // instance/app, mounting the second would either throw (element already has an
    // app) or the first view's content would go stale. Neither happens.
    expect(view1.contentEl.textContent).toContain('Select a codebase');
    expect(view2.contentEl.textContent).toContain('Select a codebase');
    expect(view1.contentEl).not.toBe(view2.contentEl);
  });

  it('unmounts Vue and disposes the renderer in onClose', async () => {
    const view = new CityView(makeLeafDouble() as never, makePluginDouble() as never, makeDepsDouble());
    await view.onOpen();
    await view.onClose();
    expect(inertPort.dispose).toHaveBeenCalled();
    expect(view.contentEl.childElementCount).toBe(0);
  });

  it('creates NO WebGL context below the 320 CSS px hard floor', async () => {
    const view = new CityView(makeLeafDouble(300) as never, makePluginDouble() as never, makeDepsDouble());
    await view.onOpen();
    expect(createRendererSpy).not.toHaveBeenCalled();
    expect(view.contentEl.textContent).toContain('The 3D view is unavailable. File inspection still works.');
  });

  it('never starts a scan on open, and never on a resize/visibility change either', async () => {
    // pause/resume invariant (spec 4.2): visibility never authorises a scan. onOpen and
    // the ResizeObserver callback (applyWidth, fired synchronously inside onOpen) are
    // the two hooks that run without any user click; neither may consult the profile
    // store, which every real scan path (resolveOrCreateProfile) always does first.
    const deps = makeDepsDouble();
    const getFilesystem = vi.fn(deps.getFilesystem);
    const view = new CityView(makeLeafDouble() as never, makePluginDouble() as never, { ...deps, getFilesystem });
    // getFilesystem WAS called once already, by the constructor above, to build the
    // coordinator's port -- that is plumbing, not a scan.
    expect(getFilesystem).toHaveBeenCalledTimes(1);
    await view.onOpen();
    expect(deps.profileStore.list).not.toHaveBeenCalled();
    expect(deps.profileStore.get).not.toHaveBeenCalled();
    // Still exactly the one constructor-time call -- onOpen/applyWidth never call it again.
    expect(getFilesystem).toHaveBeenCalledTimes(1);
  });

  it('clicking "Select a codebase" runs the consent chain, the same one scan-codebase drives', async () => {
    const deps = makeDepsDouble({ profileStore: makeProfileStoreDouble([
      { profileId: 'p1', name: 'Alpha', bindingId: null, exclusions: [], maxFileBytes: 5_000_000 },
    ]) });
    const view = new CityView(makeLeafDouble() as never, makePluginDouble() as never, deps);
    await view.onOpen();

    const button = view.contentEl.querySelector<HTMLButtonElement>('.ci-welcome__action')!;
    button.click();
    // startScan() is async; let it reach the point of opening the first modal.
    await Promise.resolve();
    await Promise.resolve();

    const modal = document.querySelector('.modal-container');
    expect(modal).not.toBeNull();
    expect(modal!.textContent).toContain('Select a codebase');

    // Clean up: cancel the modal so its pending promise settles and no DOM survives
    // into the next test.
    modal!.querySelector<HTMLButtonElement>('[data-action="cancel"]')!.click();
    await Promise.resolve();
    document.querySelectorAll('.modal-container').forEach((el) => { el.remove(); });
  });

  it('isScanRunning() reflects the coordinator, not a separate flag', () => {
    const view = new CityView(makeLeafDouble() as never, makePluginDouble() as never, makeDepsDouble());
    expect(view.isScanRunning()).toBe(false);
    // cancelScan() on an idle view is a documented no-op, never a throw.
    expect(() => { view.cancelScan(); }).not.toThrow();
  });
});
