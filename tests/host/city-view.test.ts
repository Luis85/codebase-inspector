// Lives under tests/host/ (matching the brief's file list) but needs a real DOM to
// mount Vue and measure contentEl. vitest.config.ts routes this one file to the
// 'jsdom' project (by exact path) instead of the 'node' project the rest of
// tests/host/** uses, rather than moving the whole directory to jsdom.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CityView, CITY_VIEW_TYPE } from '../../src/host/city-view';
import type { CameraBookmark } from '../../src/domain/model';
import type { CityRendererPort } from '../../src/visualization/renderer-port';

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

describe('CityView', () => {
  beforeEach(() => {
    vi.mocked(createRendererSpy).mockClear();
  });

  it('exposes the stable view identity', () => {
    const view = new CityView(makeLeafDouble() as never, makePluginDouble() as never);
    expect(view.getViewType()).toBe(CITY_VIEW_TYPE);
    expect(typeof view.getDisplayText()).toBe('string');
    expect(typeof view.getIcon()).toBe('string');
  });

  it('creates no WebGL context in the constructor', () => {
    const view = new CityView(makeLeafDouble() as never, makePluginDouble() as never);
    expect(view).toBeInstanceOf(CityView);
    expect(createRendererSpy).not.toHaveBeenCalled();
  });

  it('mounts Vue on contentEl, not containerEl.children[1]', async () => {
    const view = new CityView(makeLeafDouble() as never, makePluginDouble() as never);
    await view.onOpen();
    expect(view.contentEl.classList.contains('codebase-inspector-root')).toBe(true);
  });

  it('performs no filesystem access and starts no scan on open', async () => {
    const plugin = makePluginDouble();
    const view = new CityView(makeLeafDouble() as never, plugin as never);
    await view.onOpen();
    expect(plugin.app.vault.adapter.list).not.toHaveBeenCalled();
    expect(plugin.app.vault.adapter.read).not.toHaveBeenCalled();
  });

  it('shows the welcome state when no profile exists', async () => {
    const view = new CityView(makeLeafDouble() as never, makePluginDouble() as never);
    await view.onOpen();
    expect(view.contentEl.textContent).toContain('Understand your codebase. Start with its structure.');
    expect(view.contentEl.textContent).toContain('Select a codebase');
    // COPY-20 is WP-02+ and must not leak forward.
    expect(view.contentEl.textContent).not.toContain('Unused candidate');
    // S01's "Analysis reports can be added later" promises a capability WP-01 does not ship.
    expect(view.contentEl.textContent).not.toContain('Analysis reports can be added later');
  });

  it('returns identifiers and presentation state only from getState()', async () => {
    const view = new CityView(makeLeafDouble() as never, makePluginDouble() as never);
    await view.onOpen();
    const state = view.getState();
    expect(Object.keys(state).sort()).toEqual(['camera', 'inspectorOpen', 'previous3dCamera',
      'profileId', 'query', 'selectedEntityId', 'snapshotId', 'viewMode']);
    expect(JSON.stringify(state)).not.toMatch(/[A-Za-z]:\\\\/);   // no resolved absolute path
  });

  it('validates setState through the same validator as settings', async () => {
    const view = new CityView(makeLeafDouble() as never, makePluginDouble() as never);
    await view.onOpen();
    await view.setState({ viewMode: 'vr', rootPath: 'C:\\evil' }, {} as never);
    expect(view.getState().viewMode).not.toBe('vr');
    expect(view.getState()).not.toHaveProperty('rootPath');
  });

  it('creates its own Pinia instance per view', async () => {
    const view1 = new CityView(makeLeafDouble() as never, makePluginDouble() as never);
    const view2 = new CityView(makeLeafDouble() as never, makePluginDouble() as never);
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
    const view = new CityView(makeLeafDouble() as never, makePluginDouble() as never);
    await view.onOpen();
    await view.onClose();
    expect(inertPort.dispose).toHaveBeenCalled();
    expect(view.contentEl.childElementCount).toBe(0);
  });

  it('creates NO WebGL context below the 320 CSS px hard floor', async () => {
    const view = new CityView(makeLeafDouble(300) as never, makePluginDouble() as never);
    await view.onOpen();
    expect(createRendererSpy).not.toHaveBeenCalled();
    expect(view.contentEl.textContent).toContain('The 3D view is unavailable. File inspection still works.');
  });
});
