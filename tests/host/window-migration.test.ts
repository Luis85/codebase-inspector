// Task 11, step 5. Ruling M79 (task-11-context.md section 3, D29): the brief's own
// pop-out tests are written against `view.renderer`, which ruling M68 (task 9)
// removed — renderer ownership moved into CityViewport.vue. Every invariant those
// tests assert still holds and is still required here: dispose-and-reconstruct with
// no rebind, reconstruction from the existing LayoutResult/CityViewState with no
// refetch and no scan, the camera landing where it was, every DOM node created in
// the new window, and context loss/migration as ONE recovery path. They are just
// observed through the SHARED renderer handle (each renderer construction's own
// captured double) and the view's rendered DOM, never a `view.renderer` field —
// this file does not add one back.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { nextTick } from 'vue';
import { CityView } from '../../src/host/city-view';
import { ScanCoordinator } from '../../src/application/scan-coordinator';
import { InMemorySnapshotStore } from '../../src/adapters/storage/in-memory-snapshot-store';
import { createFakeSourceFileSystem } from '../fixtures/fake-source-filesystem';
import { createFixedClock } from '../fixtures/clock';
import { buildSnapshotFixture } from '../fixtures/snapshot-builder';
import { defaultCityViewState } from '../../src/host/view-state';
import { createPopoutWindow, installControllableResizeObserver, migrateElement } from '../mocks/window-harness';
import type { CameraBookmark, CodebaseProfile, CodebaseSnapshot } from '../../src/domain/model';
import type { CityPalette, CityRendererEvent, CityRendererPort } from '../../src/visualization/renderer-port';
import type { CityViewDeps } from '../../src/host/city-view';
import type { ProfileStore } from '../../src/application/ports/profile-store';

vi.mock('../../src/domain/layout/layout', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/domain/layout/layout')>();
  return { ...actual, computeLayout: vi.fn(actual.computeLayout) };
});
const computeLayoutSpy = vi.mocked((await import('../../src/domain/layout/layout')).computeLayout);

const CAMERA_A: CameraBookmark = {
  projection: 'orthographic', mode: '3d', position: [1, 1, 1], target: [0, 0, 0], up: [0, 1, 0], zoom: 2,
};
const CAMERA_B: CameraBookmark = {
  projection: 'orthographic', mode: '3d', position: [9, 9, 9], target: [0, 0, 0], up: [0, 1, 0], zoom: 3,
};

// Named spy fields, never read back off `port.dispose`/`port.setLayout`/etc. --
// @typescript-eslint/unbound-method flags a live method-typed member expression
// (renderer-port.ts declares CityRendererPort's members with method syntax), the
// same pattern tests/host/city-view-store-wiring.test.ts's own setSelectionSpy
// comment already documents.
interface RendererCall {
  port: CityRendererPort; onEvent: (e: CityRendererEvent) => void; win: Window;
  dispose: ReturnType<typeof vi.fn<() => void>>;
  setLayout: ReturnType<typeof vi.fn<CityRendererPort['setLayout']>>;
  setCamera: ReturnType<typeof vi.fn<(camera: CameraBookmark) => void>>;
  setColors: ReturnType<typeof vi.fn<(palette: CityPalette) => void>>;
}
let rendererCalls: RendererCall[] = [];
function makePort(spies: Pick<RendererCall, 'dispose' | 'setLayout' | 'setCamera' | 'setColors'>): CityRendererPort {
  return {
    setLayout: spies.setLayout, setColors: spies.setColors, setSelection: vi.fn(), setFilter: vi.fn(),
    setLabels: vi.fn(), setCameraMode: vi.fn(), setMotion: vi.fn(),
    getCamera: vi.fn((): CameraBookmark => CAMERA_A), setCamera: spies.setCamera, nudgeCamera: vi.fn(),
    focus: vi.fn(), fit: vi.fn(), resize: vi.fn(), pause: vi.fn(), resume: vi.fn(), dispose: spies.dispose,
    getDiagnostics: vi.fn(() => ({
      geometries: 0, textures: 0, programs: 0, drawCalls: 0, instanceCount: 0, lastFrameMs: 0, contextLost: false,
    })),
    debugLoseContext: vi.fn(),
  };
}

vi.mock('../../src/visualization/city-renderer', () => ({
  createCityRenderer: vi.fn((_mountEl: HTMLElement, win: Window, onEvent: (e: CityRendererEvent) => void) => {
    const dispose = vi.fn<() => void>();
    const setLayout = vi.fn<CityRendererPort['setLayout']>(async () => {});
    const setCamera = vi.fn<(camera: CameraBookmark) => void>();
    const setColors = vi.fn<(palette: CityPalette) => void>();
    const port = makePort({ dispose, setLayout, setCamera, setColors });
    rendererCalls.push({ port, onEvent, win, dispose, setLayout, setCamera, setColors });
    return port;
  }),
}));
const { createCityRenderer: createRendererSpy } = await import('../../src/visualization/city-renderer');

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

function stubStageRect(view: CityView, width = 1000, height = 700): HTMLElement {
  const stage = view.contentEl.querySelector<HTMLElement>('[data-ci-role="stage"]');
  if (!stage) throw new Error('test setup: no stage element found');
  stage.getBoundingClientRect = () => ({
    width, height, top: 0, left: 0, right: width, bottom: height, x: 0, y: 0, toJSON: () => ({}),
  });
  return stage;
}

async function openViewWithSnapshot(): Promise<{ view: CityView; deps: CityViewDeps }> {
  const snapshotStore = new InMemorySnapshotStore(createFixedClock());
  const snapshot: CodebaseSnapshot = { ...buildSnapshotFixture({ files: 2, repositoryId: 'p1' }), snapshotId: 's1' };
  snapshotStore.put(snapshot);
  const { port } = createFakeSourceFileSystem({});
  const profileStore = makeProfileStoreDouble([{ profileId: 'p1', name: 'Alpha', bindingId: null, exclusions: [], maxFileBytes: 5_000_000 }]);
  const deps: CityViewDeps = { profileStore, getFilesystem: () => port, snapshotStore, clock: createFixedClock() };
  const view = new CityView({ width: 1000, height: 700 } as never, makePluginDouble() as never, deps);
  await view.setState({ ...defaultCityViewState(), profileId: 'p1', snapshotId: 's1' }, {} as never);
  await view.onOpen();
  stubStageRect(view);
  await nextTick();
  return { view, deps };
}

describe('pop-out migration', () => {
  let coordinatorStartSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    rendererCalls = [];
    vi.mocked(createRendererSpy).mockClear();
    vi.mocked(computeLayoutSpy).mockClear();
    coordinatorStartSpy = vi.spyOn(ScanCoordinator.prototype, 'start');
  });

  it('is signalled by HTMLElement.onWindowMigrated on containerEl', async () => {
    const view = new CityView({ width: 1000, height: 700 } as never, makePluginDouble() as never, {
      profileStore: makeProfileStoreDouble(), getFilesystem: () => createFakeSourceFileSystem({}).port,
      snapshotStore: new InMemorySnapshotStore(createFixedClock()), clock: createFixedClock(),
    });
    const spy = vi.spyOn(view.containerEl, 'onWindowMigrated');
    await view.onOpen();
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('RETAINS the destroy function it returns and calls it on close', async () => {
    const { view } = await openViewWithSnapshot();
    const popout = createPopoutWindow();
    migrateElement(view.containerEl, popout);
    await nextTick();
    const settled = rendererCalls.length;   // the initial construction + one legitimate reconstruction
    expect(settled).toBeGreaterThan(0);
    await view.onClose();
    // Migrating AGAIN after close must not throw and must not construct anything new --
    // the destroy function city-view.ts retained really unregistered the callback,
    // rather than leaking a closure that keeps firing against a torn-down view.
    const popout2 = createPopoutWindow();
    expect(() => { migrateElement(view.containerEl, popout2); }).not.toThrow();
    expect(createRendererSpy).toHaveBeenCalledTimes(settled);
  });

  it('DISPOSES and RECONSTRUCTS the renderer — there is no rebind', async () => {
    const { view } = await openViewWithSnapshot();
    expect(rendererCalls).toHaveLength(1);
    const firstDispose = rendererCalls[0]!.dispose;
    const firstPort = rendererCalls[0]!.port;
    const popout = createPopoutWindow();
    migrateElement(view.containerEl, popout);
    await nextTick();
    expect(firstDispose).toHaveBeenCalledTimes(1);
    expect(rendererCalls).toHaveLength(2);
    expect(rendererCalls[1]!.port).not.toBe(firstPort);
    // No "rebind" method exists on the port at all (renderer-port.ts's frozen shape) --
    // there is nothing for a rebind path to have called even by mistake.
    expect((rendererCalls[1]!.port as unknown as { rebind?: unknown }).rebind).toBeUndefined();
  });

  it('reconstructs from the EXISTING LayoutResult and CityViewState — no refetch, NO SCAN', async () => {
    const { view } = await openViewWithSnapshot();
    computeLayoutSpy.mockClear();   // clear the call onOpen's own initial publish made
    const popout = createPopoutWindow();
    migrateElement(view.containerEl, popout);
    await nextTick();
    expect(computeLayoutSpy).not.toHaveBeenCalled();
    expect(coordinatorStartSpy).not.toHaveBeenCalled();
    // The NEW renderer received a real layout, not an empty scene.
    expect(rendererCalls[1]!.setLayout).toHaveBeenCalled();
  });

  it('lands the camera where it left off', async () => {
    const { view } = await openViewWithSnapshot();
    // The renderer reports a camera move (a drag, a Fit) exactly like a real one
    // would; CityViewport's own watcher mirrors it into the store (task 9/10).
    rendererCalls[0]!.onEvent({ type: 'camera-changed', camera: CAMERA_B });
    const popout = createPopoutWindow();
    migrateElement(view.containerEl, popout);
    await nextTick();
    await nextTick();   // the reconstruction's own setLayout().then(...) microtask
    expect(rendererCalls[1]!.setCamera).toHaveBeenCalledWith(CAMERA_B);
  });

  it('creates every DOM node in the NEW window, never the old one', async () => {
    const { view } = await openViewWithSnapshot();
    const popout = createPopoutWindow();
    migrateElement(view.containerEl, popout);
    await nextTick();
    const nodes = view.contentEl.querySelectorAll('*');
    expect(nodes.length).toBeGreaterThan(0);
    for (const el of Array.from(nodes)) expect(el.ownerDocument).toBe(popout.doc);
  });

  it('uses node.instanceOf(T) for DOM type checks, because instanceof is false across windows', () => {
    const popout = createPopoutWindow();
    // A genuinely native popout element (createEl, per obsidianmd's own rule, so
    // this is the SANCTIONED construction — the hazard under test is the type
    // check below, not how the element was made).
    const native = popout.doc.body.createEl('input');
    // The real hazard spec 4.4's `instanceOf` exists to fix (source-modal.ts,
    // scope-modal.ts, FileSearch.vue's isEditable): `HTMLElement.prototype` is NOT
    // in this element's prototype chain from THIS (outer) window's point of view —
    // the same fact a bare `instanceof` would report as `false` — because it is a
    // real instance of the POPOUT's own, different `HTMLElement` constructor.
    expect(Object.prototype.isPrototypeOf.call(HTMLElement.prototype, native)).toBe(false);
    expect(native.instanceOf(HTMLElement)).toBe(true);
    popout.destroy();
  });

  it('re-reads the palette and the reduced-motion preference in the new window', async () => {
    const { view } = await openViewWithSnapshot();
    const popout = createPopoutWindow();
    const matchMediaSpy = vi.spyOn(popout.win, 'matchMedia');
    migrateElement(view.containerEl, popout);
    await nextTick();
    expect(matchMediaSpy).toHaveBeenCalledWith('(prefers-reduced-motion: reduce)');
    expect(rendererCalls[1]!.setColors).toHaveBeenCalled();
  });

  it('treats context loss and window migration as ONE recovery path', async () => {
    // Installed BEFORE the view mounts: CityViewport's own ResizeObserver is
    // constructed once, in onMounted, off whatever `window.ResizeObserver` was at
    // that moment -- installing this after construction would replace the GLOBAL
    // constructor without ever reaching the instance already in use.
    const observer = installControllableResizeObserver();
    try {
      await openViewWithSnapshot();
      rendererCalls[0]!.onEvent({ type: 'unavailable', reason: 'context-lost' });
      expect(rendererCalls[0]!.dispose).toHaveBeenCalledTimes(1);
      // Context loss alone does not implicitly reconstruct (tests/component/
      // city-viewport.test.ts's own protected contract: reconstruction is
      // `applySize()`, re-run by whatever next causes a measurement — a resize in
      // the real host, exactly as a MIGRATION's own resize/relayout would also
      // trigger). Both paths converge on the SAME reconstruction mechanism and
      // NEITHER ever authorises a scan — that convergence is "one recovery path".
      observer.trigger();
      await nextTick();
      expect(createRendererSpy).toHaveBeenCalledTimes(2);
      expect(coordinatorStartSpy).not.toHaveBeenCalled();
    } finally {
      observer.restore();
    }
  });
});
