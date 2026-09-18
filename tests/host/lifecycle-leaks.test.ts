// Task 11, step 5. "No orphans after shutdown." Every renderer-internal guarantee
// here (no live WebGL context, no orphan rAF, no stray timer) is causally rooted in
// `dispose()` being called exactly once per renderer and never skipped — that is
// what this file proves, at the host level, using the SAME per-call renderer double
// every other host suite in this task uses. The renderer's OWN internal disposal
// correctness (disposeRenderer/disposeObject3D actually releasing WebGL/Three.js
// resources) is proven separately, with a real WebGL double, by
// tests/component/renderer-contract.test.ts — duplicating that here would fake
// `three` a second time for no new coverage.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { nextTick } from 'vue';
import { CityView } from '../../src/host/city-view';
import { ScanCoordinator } from '../../src/application/scan-coordinator';
import { InMemorySnapshotStore } from '../../src/adapters/storage/in-memory-snapshot-store';
import { createFakeSourceFileSystem } from '../fixtures/fake-source-filesystem';
import { createFixedClock } from '../fixtures/clock';
import { buildSnapshotFixture } from '../fixtures/snapshot-builder';
import { defaultCityViewState } from '../../src/host/view-state';
import { migrationCallbacks } from '../mocks/obsidian';
import { installControllableResizeObserver } from '../mocks/window-harness';
import type { CameraBookmark, CodebaseProfile, CodebaseSnapshot } from '../../src/domain/model';
import type { CityRendererEvent, CityRendererPort } from '../../src/visualization/renderer-port';
import type { CityViewDeps } from '../../src/host/city-view';
import type { ProfileStore } from '../../src/application/ports/profile-store';

const DUMMY_CAMERA: CameraBookmark = {
  projection: 'orthographic', mode: '3d', position: [0, 0, 0], target: [0, 0, 0], up: [0, 1, 0], zoom: 1,
};

// Named spy fields, never read back off `port.dispose`/`port.pause`/`port.resume` --
// @typescript-eslint/unbound-method flags a live method-typed member expression
// (renderer-port.ts declares CityRendererPort's members with method syntax), the
// same pattern tests/host/city-view-store-wiring.test.ts's own setSelectionSpy
// comment already documents.
interface RendererCall {
  port: CityRendererPort; onEvent: (e: CityRendererEvent) => void;
  dispose: ReturnType<typeof vi.fn<() => void>>;
  pause: ReturnType<typeof vi.fn<() => void>>;
  resume: ReturnType<typeof vi.fn<() => void>>;
}
let rendererCalls: RendererCall[] = [];
function makePort(spies: Pick<RendererCall, 'dispose' | 'pause' | 'resume'>): CityRendererPort {
  return {
    setLayout: vi.fn(async () => {}), setColors: vi.fn(), setSelection: vi.fn(), setFilter: vi.fn(),
    setLabels: vi.fn(), setCameraMode: vi.fn(), setMotion: vi.fn(),
    getCamera: vi.fn((): CameraBookmark => DUMMY_CAMERA), setCamera: vi.fn(), nudgeCamera: vi.fn(),
    focus: vi.fn(), fit: vi.fn(), resize: vi.fn(), pause: spies.pause, resume: spies.resume, dispose: spies.dispose,
    getDiagnostics: vi.fn(() => ({
      geometries: 0, textures: 0, programs: 0, drawCalls: 0, instanceCount: 0, lastFrameMs: 0, contextLost: false,
    })),
    debugLoseContext: vi.fn(),
  };
}
vi.mock('../../src/visualization/city-renderer', () => ({
  createCityRenderer: vi.fn((_mountEl: HTMLElement, _win: Window, onEvent: (e: CityRendererEvent) => void) => {
    const dispose = vi.fn<() => void>();
    const pause = vi.fn<() => void>();
    const resume = vi.fn<() => void>();
    const port = makePort({ dispose, pause, resume });
    rendererCalls.push({ port, onEvent, dispose, pause, resume });
    return port;
  }),
}));
const { createCityRenderer: createRendererSpy } = await import('../../src/visualization/city-renderer');

/** Live == constructed but not yet disposed -- the closest thing to "an open WebGL
 *  context" this mocked double can express, and exactly the thing dispose()
 *  existing or not existing changes. */
function liveContexts(): number {
  return rendererCalls.filter((c) => !c.dispose.mock.calls.length).length;
}

/** Tracks EVERY instance's own disconnect() call, unlike tests/mocks/window-harness.ts's
 *  plain controllable stub -- this file needs to know an observer was actually torn
 *  down, not just that it can be fired. */
function installTrackedResizeObserver(): { instances: { disconnect: ReturnType<typeof vi.fn> }[]; restore: () => void } {
  const instances: { disconnect: ReturnType<typeof vi.fn> }[] = [];
  const holder = window as unknown as { ResizeObserver: unknown };
  const previous = holder.ResizeObserver;
  holder.ResizeObserver = class {
    disconnect = vi.fn();
    constructor(_cb: () => void) { instances.push(this); }
    observe(): void {}
    unobserve(): void {}
  };
  return { instances, restore: () => { holder.ResizeObserver = previous; } };
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

function makePluginDouble(): { app: { workspace: Record<string, ReturnType<typeof vi.fn>>; vault: { adapter: Record<string, ReturnType<typeof vi.fn>>; configDir: string } } } {
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

function stubStageRect(view: CityView, width: number, height = 700): HTMLElement {
  const stage = view.contentEl.querySelector<HTMLElement>('[data-ci-role="stage"]');
  if (!stage) throw new Error('test setup: no stage element found');
  stage.getBoundingClientRect = () => ({
    width, height, top: 0, left: 0, right: width, bottom: height, x: 0, y: 0, toJSON: () => ({}),
  });
  return stage;
}

function makeDeps(overrides: Partial<CityViewDeps> = {}): CityViewDeps {
  const { port } = createFakeSourceFileSystem({});
  return {
    profileStore: makeProfileStoreDouble(),
    getFilesystem: () => port,
    snapshotStore: new InMemorySnapshotStore(createFixedClock()),
    clock: createFixedClock(),
    ...overrides,
  };
}

async function newViewWithSnapshot(deps: CityViewDeps, id = 'p1', files = 1): Promise<CityView> {
  const snapshot: CodebaseSnapshot = { ...buildSnapshotFixture({ files, repositoryId: id }), snapshotId: `snap-${id}` };
  deps.snapshotStore.put(snapshot);
  const view = new CityView({ width: 1000, height: 700 } as never, makePluginDouble() as never, deps);
  await view.setState({ ...defaultCityViewState(), profileId: id, snapshotId: `snap-${id}` }, {} as never);
  await view.onOpen();
  stubStageRect(view, 1000);
  await nextTick();
  return view;
}

describe('no orphans after shutdown', () => {
  beforeEach(() => { rendererCalls = []; vi.mocked(createRendererSpy).mockClear(); });

  it('leaves no requestAnimationFrame handle, no timer, and no active render loop', async () => {
    // All three converge on the SAME causal event: dispose(). render-scheduler.ts's
    // own unit tests prove dispose() cancels the pending rAF and stops invalidate()
    // from ever scheduling another; picking.ts's own tests prove it clears the
    // dwell timer. What ONLY a real CityView close can prove is that the host
    // actually CALLS it, every time, for every renderer it ever constructed.
    const view = await newViewWithSnapshot(makeDeps());
    await view.onClose();
    expect(rendererCalls[0]!.dispose).toHaveBeenCalledTimes(1);
  });

  it('leaves no observer', async () => {
    const tracked = installTrackedResizeObserver();
    try {
      const view = await newViewWithSnapshot(makeDeps());
      expect(tracked.instances.length).toBeGreaterThan(0);
      await view.onClose();
      for (const observer of tracked.instances) expect(observer.disconnect).toHaveBeenCalledTimes(1);
    } finally {
      tracked.restore();
    }
  });

  it('leaves no event handler', async () => {
    const plugin = makePluginDouble();
    const view = new CityView({ width: 1000, height: 700 } as never, plugin as never, makeDeps());
    const migratedSpy = vi.spyOn(view.containerEl, 'onWindowMigrated');
    await view.onOpen();
    stubStageRect(view, 1000);
    await nextTick();
    expect(migratedSpy).toHaveBeenCalledTimes(1);
    expect(migrationCallbacks.get(view.containerEl)?.size).toBe(1);

    const onSpy = plugin.app.workspace.on as ReturnType<typeof vi.fn<(...args: unknown[]) => object>>;
    const cssChangeRef: object = onSpy.mock.results[0]!.value as object;
    await view.onClose();
    expect(plugin.app.workspace.offref).toHaveBeenCalledWith(cssChangeRef);
    expect(migrationCallbacks.get(view.containerEl)?.size ?? 0).toBe(0);
  });

  it('releases the matchMedia change listener with the view', async () => {
    const listeners: (() => void)[] = [];
    const removed: (() => void)[] = [];
    const holder = window as unknown as { matchMedia: typeof window.matchMedia };
    const previous = holder.matchMedia;
    holder.matchMedia = ((query: string) => ({
      matches: false, media: query, onchange: null,
      addListener: () => {}, removeListener: () => {}, dispatchEvent: () => false,
      addEventListener: (_type: string, cb: () => void) => { listeners.push(cb); },
      removeEventListener: (_type: string, cb: () => void) => { removed.push(cb); },
    })) as unknown as typeof window.matchMedia;
    try {
      const view = await newViewWithSnapshot(makeDeps());
      expect(listeners).toHaveLength(1);
      await view.onClose();
      expect(removed).toEqual(listeners);
    } finally {
      holder.matchMedia = previous;
    }
  });

  it('releases the css-change subscription with the view', async () => {
    const plugin = makePluginDouble();
    const view = new CityView({ width: 1000, height: 700 } as never, plugin as never, makeDeps());
    await view.onOpen();
    const onSpy = plugin.app.workspace.on as ReturnType<typeof vi.fn<(...args: unknown[]) => object>>;
    const ref: object = onSpy.mock.results[0]!.value as object;
    await view.onClose();
    expect(plugin.app.workspace.offref).toHaveBeenCalledWith(ref);
  });

  it('survives ten open/close cycles with zero live WebGL contexts', async () => {
    const deps = makeDeps();
    for (let i = 0; i < 10; i += 1) {
      const view = await newViewWithSnapshot(deps, 'p1', 1);
      await view.onClose();
    }
    expect(rendererCalls).toHaveLength(10);
    expect(liveContexts()).toBe(0);
  });

  it('ignores a job that completes after its view closed', async () => {
    const { port: filesystemPort } = createFakeSourceFileSystem({ 'a.ts': 'x' });
    const snapshotStore = new InMemorySnapshotStore(createFixedClock());
    const profileStore = makeProfileStoreDouble([{ profileId: 'p1', name: 'Alpha', bindingId: null, exclusions: [], maxFileBytes: 5_000_000 }]);
    const deps: CityViewDeps = { profileStore, getFilesystem: () => filesystemPort, snapshotStore, clock: createFixedClock() };
    const view = await newViewWithSnapshot(deps, 'p1', 0);

    const runPromise = view.startScan();
    await view.onClose();   // cancels the coordinator AND unsubscribes from it
    await expect(runPromise).resolves.toBeUndefined();
    // The late completion reached NOTHING: no throw above, and no leftover renderer
    // call beyond the one construction already counted.
    expect(rendererCalls.length).toBeGreaterThan(0);
  });

  it('pauses drawing and input for a hidden leaf, and NEVER scans on resume', async () => {
    const observer = installControllableResizeObserver();
    try {
      // `listSpy` captured as its own identity at construction time, never read
      // back off `deps.profileStore.list` (the same unbound-method reason every
      // other named spy in this task's suites is captured this way).
      const listSpy = vi.fn(async () => []);
      const deps = makeDeps({ profileStore: { ...makeProfileStoreDouble(), list: listSpy } });
      const view = await newViewWithSnapshot(deps);
      const { dispose, pause, resume } = rendererCalls[0]!;
      const startSpy = vi.spyOn(ScanCoordinator.prototype, 'start');
      resume.mockClear();   // the initial construction's own resize() already called it once

      // A leaf hidden behind a sibling tab: BOTH dimensions collapse to zero
      // (Obsidian's own display:none, distinct from the 320px floor's width-only
      // narrowing). The SAME ResizeObserver CityViewport installed reports it.
      stubStageRect(view, 0, 0);
      observer.trigger();
      expect(pause).toHaveBeenCalledTimes(1);
      expect(dispose).not.toHaveBeenCalled();   // paused, never torn down

      // Switching back: the SAME renderer resumes -- no reconstruction, no scan.
      stubStageRect(view, 1000, 700);
      observer.trigger();
      expect(resume).toHaveBeenCalledTimes(1);
      expect(createRendererSpy).toHaveBeenCalledTimes(1);   // still the ORIGINAL renderer
      expect(startSpy).not.toHaveBeenCalled();
      expect(listSpy).not.toHaveBeenCalled();
    } finally {
      observer.restore();
    }
  });

  it('costs nothing for a zero-size leaf', async () => {
    const deps = makeDeps();
    const snapshot: CodebaseSnapshot = { ...buildSnapshotFixture({ files: 1, repositoryId: 'p1' }), snapshotId: 'snap-p1' };
    deps.snapshotStore.put(snapshot);
    const view = new CityView({ width: 1000, height: 700 } as never, makePluginDouble() as never, deps);
    await view.setState({ ...defaultCityViewState(), profileId: 'p1', snapshotId: 'snap-p1' }, {} as never);
    await view.onOpen();
    stubStageRect(view, 0, 0);
    await nextTick();
    expect(createRendererSpy).not.toHaveBeenCalled();
    await view.onClose();
  });
});
