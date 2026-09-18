// Task 11, step 1. Multiple leaves are a first-class WP-01 capability (ruling M9,
// commands.ts's own comment): task 11's whole per-leaf reconciliation only means
// anything if two leaves can genuinely hold different snapshots/selections at once.
// Needs a real DOM (mounting Vue per leaf, measuring each one's own stage element),
// hence the 'jsdom' project routing (vitest.config.ts).
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { nextTick } from 'vue';
import { CityView, CITY_VIEW_TYPE } from '../../src/host/city-view';
import { forEachCityView } from '../../src/host/leaf-registry';
import { openCity } from '../../src/host/commands';
import { InMemorySnapshotStore } from '../../src/adapters/storage/in-memory-snapshot-store';
import { createFakeSourceFileSystem } from '../fixtures/fake-source-filesystem';
import { createFixedClock } from '../fixtures/clock';
import { buildSnapshotFixture } from '../fixtures/snapshot-builder';
import { defaultCityViewState } from '../../src/host/view-state';
import type { CameraBookmark, CodebaseProfile, CodebaseSnapshot } from '../../src/domain/model';
import type { CityRendererEvent, CityRendererPort } from '../../src/visualization/renderer-port';
import type { CityViewDeps } from '../../src/host/city-view';
import type { ProfileStore } from '../../src/application/ports/profile-store';

const DUMMY_CAMERA: CameraBookmark = {
  projection: 'orthographic', mode: '3d', position: [0, 0, 0], target: [0, 0, 0], up: [0, 1, 0], zoom: 1,
};

// Task 11's own local double: a FRESH port, and a FRESH captured onEvent, PER CALL --
// unlike other host suites' single shared `inertPort`, because "own renderer, own
// WebGL context" and "independent camera" are exactly what a shared double could not
// distinguish from a bug.
// `setCamera` is its own named field, never read back off `port.setCamera` --
// @typescript-eslint/unbound-method flags a live method-typed member expression
// (renderer-port.ts declares CityRendererPort's members with method syntax), the
// same pattern tests/host/city-view-store-wiring.test.ts's own setSelectionSpy
// comment already documents.
interface RendererCall {
  port: CityRendererPort; onEvent: (e: CityRendererEvent) => void; mountEl: HTMLElement;
  setCamera: ReturnType<typeof vi.fn<(camera: CameraBookmark) => void>>;
}
const rendererCalls: RendererCall[] = [];
function makePort(setCamera: RendererCall['setCamera']): CityRendererPort {
  return {
    setLayout: vi.fn(async () => {}), setColors: vi.fn(), setSelection: vi.fn(), setFilter: vi.fn(),
    setLabels: vi.fn(), setCameraMode: vi.fn(), setMotion: vi.fn(),
    getCamera: vi.fn((): CameraBookmark => DUMMY_CAMERA), setCamera, nudgeCamera: vi.fn(),
    focus: vi.fn(), fit: vi.fn(), resize: vi.fn(), pause: vi.fn(), resume: vi.fn(), dispose: vi.fn(),
    getDiagnostics: vi.fn(() => ({
      geometries: 0, textures: 0, programs: 0, drawCalls: 0, instanceCount: 0, lastFrameMs: 0, contextLost: false,
    })),
    debugLoseContext: vi.fn(),
  };
}

vi.mock('../../src/visualization/city-renderer', () => ({
  createCityRenderer: vi.fn((mountEl: HTMLElement, _win: Window, onEvent: (e: CityRendererEvent) => void) => {
    const setCamera = vi.fn<(camera: CameraBookmark) => void>();
    const port = makePort(setCamera);
    rendererCalls.push({ port, onEvent, mountEl, setCamera });
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

function snapshotFor(repositoryId: string, files: number): CodebaseSnapshot {
  return { ...buildSnapshotFixture({ files, repositoryId }), snapshotId: `snap-${repositoryId}` };
}

/** Shared plugin-level state (the SAME snapshotStore/profileStore every real
 *  CityView instance gets, main.ts's own pattern), plus a `leaves` array a
 *  workspace double exposes through `getLeavesOfType` -- real enough for
 *  `forEachCityView`, `openCity` and the deferred-view contract, without
 *  reimplementing Obsidian's whole workspace. */
function makeHarness(): {
  plugin: { app: unknown; registerView: (t: string, f: (leaf: unknown) => unknown) => void; addCommand: ReturnType<typeof vi.fn> };
  app: { workspace: Record<string, unknown> };
  deps: CityViewDeps;
  leaves: { view: unknown; width: number; height: number }[];
  addLeafWithView: (view: unknown) => void;
} {
  const snapshotStore = new InMemorySnapshotStore(createFixedClock());
  const { port } = createFakeSourceFileSystem({});
  const deps: CityViewDeps = {
    profileStore: makeProfileStoreDouble(),
    getFilesystem: () => port,
    snapshotStore,
    clock: createFixedClock(),
  };
  const leaves: { view: unknown; width: number; height: number }[] = [];
  let factory: ((leaf: unknown) => unknown) | null = null;
  const workspace = {
    getLeaf: vi.fn((..._args: unknown[]) => {
      // Since 1.7.2 every leaf's view starts as a DeferredView placeholder --
      // `setViewState` alone never constructs the real one (spec: "reveal before
      // acting"). The placeholder is deliberately NOT a CityView. The SAME object
      // is both pushed to `leaves` and returned, so `revealLeaf` mutating
      // `leaf.view` below is visible through either reference.
      const leaf = { width: 1000, height: 700, view: { deferred: true } as unknown, setViewState: vi.fn(async () => {}) };
      leaves.push(leaf);
      return leaf;
    }),
    revealLeaf: vi.fn(async (leaf: { view: unknown }) => {
      if (!(leaf.view instanceof CityView) && factory) {
        leaf.view = factory(leaf);
        await (leaf.view as CityView).onOpen();
      }
    }),
    getLeavesOfType: vi.fn((type: string) => (type === CITY_VIEW_TYPE ? leaves : [])),
    getActiveViewOfType: vi.fn(() => null),
    on: vi.fn(() => ({})), offref: vi.fn(), onLayoutReady: vi.fn(),
  };
  const app = { workspace, vault: { adapter: { read: vi.fn(), list: vi.fn() }, configDir: '.obsidian' } };
  const plugin = {
    app, addCommand: vi.fn(),
    registerView: (_t: string, f: (leaf: unknown) => unknown) => { factory = f; },
  };
  plugin.registerView(CITY_VIEW_TYPE, (leaf) => new CityView(leaf as never, plugin as never, deps));
  return {
    plugin, app, deps, leaves,
    addLeafWithView: (view: unknown) => { leaves.push({ view, width: 1000, height: 700 }); },
  };
}

/** A view with its OWN restored snapshot, constructed directly (the same pattern
 *  every other host suite uses) -- `openCity`'s own deferred-view machinery is
 *  exercised separately, by the tests that are actually about it. */
async function openLeafWithSnapshot(h: ReturnType<typeof makeHarness>, repositoryId: string, files: number): Promise<CityView> {
  h.deps.snapshotStore.put(snapshotFor(repositoryId, files));
  const view = new CityView({ width: 1000, height: 700 } as never, h.plugin as never, h.deps);
  await view.setState({ ...defaultCityViewState(), profileId: repositoryId, snapshotId: `snap-${repositoryId}` }, {} as never);
  await view.onOpen();
  h.addLeafWithView(view);
  return view;
}

function stubStageRect(view: CityView, width = 1000, height = 700): void {
  const stage = view.contentEl.querySelector<HTMLElement>('[data-ci-role="stage"]');
  if (!stage) throw new Error('test setup: no stage element found');
  stage.getBoundingClientRect = () => ({
    width, height, top: 0, left: 0, right: width, bottom: height, x: 0, y: 0, toJSON: () => ({}),
  });
}

function firstRow(view: CityView): HTMLButtonElement {
  return view.contentEl.querySelector<HTMLButtonElement>('.ci-file-list__row')!;
}

describe('multiple leaves', () => {
  beforeEach(() => {
    rendererCalls.length = 0;
    vi.mocked(createRendererSpy).mockClear();
  });

  it('keeps selection independent between two city leaves', async () => {
    const h = makeHarness();
    const view1 = await openLeafWithSnapshot(h, 'p1', 2);
    const view2 = await openLeafWithSnapshot(h, 'p2', 2);

    firstRow(view1).click();
    await nextTick();

    expect(view1.contentEl.querySelector('.ci-file-list__row--selected')).not.toBeNull();
    expect(view2.contentEl.querySelector('.ci-file-list__row--selected')).toBeNull();
  });

  it('keeps query, camera and inspector state independent', async () => {
    const h = makeHarness();
    const view1 = await openLeafWithSnapshot(h, 'p1', 2);
    const view2 = await openLeafWithSnapshot(h, 'p2', 2);
    stubStageRect(view1);
    stubStageRect(view2);
    await nextTick();

    // Query: typing in one leaf's search box never reaches the other's.
    const input1 = view1.contentEl.querySelector<HTMLInputElement>('.ci-search__input')!;
    input1.value = 'file-0';
    input1.dispatchEvent(new Event('input'));
    await nextTick();
    const input2 = view2.contentEl.querySelector<HTMLInputElement>('.ci-search__input')!;
    expect(input2.value).toBe('');

    // Inspector: opening it (a row activation) in one leaf never opens it in the other.
    firstRow(view1).click();
    await nextTick();
    expect(view1.contentEl.querySelector('.ci-inspector')).not.toBeNull();
    expect(view2.contentEl.querySelector('.ci-inspector')).toBeNull();

    // Camera: each leaf's renderer double is its OWN object (asserted properly
    // below); firing a camera-changed event on one never touches the other's port.
    expect(rendererCalls).toHaveLength(2);
    rendererCalls[0]!.onEvent({ type: 'camera-changed', camera: { ...DUMMY_CAMERA, zoom: 9 } });
    expect(rendererCalls[1]!.setCamera).not.toHaveBeenCalled();
  });

  it('gives each leaf its own Pinia instance', async () => {
    const h = makeHarness();
    const view1 = await openLeafWithSnapshot(h, 'p1', 1);
    const view2 = new CityView({ width: 1000, height: 700 } as never, h.plugin as never, h.deps);
    await view2.onOpen();   // no restored state at all -- shows the welcome action

    expect(view2.contentEl.textContent).toContain('Select a codebase');
    expect(view1.contentEl).not.toBe(view2.contentEl);
    expect(view1.contentEl.querySelectorAll('.ci-file-list__row').length).toBe(1);
    expect(view2.contentEl.querySelectorAll('.ci-file-list__row').length).toBe(0);
  });

  it('gives each leaf its own renderer and its own WebGL context', async () => {
    const h = makeHarness();
    const view1 = await openLeafWithSnapshot(h, 'p1', 1);
    const view2 = await openLeafWithSnapshot(h, 'p2', 1);
    stubStageRect(view1);
    stubStageRect(view2);
    await nextTick();

    expect(createRendererSpy).toHaveBeenCalledTimes(2);
    expect(rendererCalls).toHaveLength(2);
    expect(rendererCalls[0]!.port).not.toBe(rendererCalls[1]!.port);
    expect(rendererCalls[0]!.mountEl).not.toBe(rendererCalls[1]!.mountEl);
  });

  it('reaches views through getLeavesOfType plus an instanceof check, never a cast', async () => {
    const h = makeHarness();
    await openLeafWithSnapshot(h, 'p1', 1);
    await openLeafWithSnapshot(h, 'p2', 1);
    // A background leaf whose view is STILL a DeferredView placeholder -- forEachCityView
    // must skip it, never cast it into a CityView it is not.
    h.addLeafWithView({ deferred: true });

    const collected: CityView[] = [];
    forEachCityView(h.app as never, (v) => { collected.push(v); });
    expect(collected).toHaveLength(2);
    expect(collected.every((v) => v instanceof CityView)).toBe(true);
  });

  it('reveals a leaf before acting on it', async () => {
    const h = makeHarness();
    await openCity(h.plugin as never);
    expect(h.app.workspace.revealLeaf).toHaveBeenCalledTimes(1);
  });

  it('never holds a view reference across factory invocations', async () => {
    const h = makeHarness();
    await openLeafWithSnapshot(h, 'p1', 1);
    // The plugin object itself (spec 4.4: "never hold a view reference — the
    // factory may run more than once") holds no CityView anywhere on it.
    expect(Object.values(h.plugin)).not.toContainEqual(expect.any(CityView));
  });

  it('constructs NO view for a background tab, so no WebGL context exists for it', async () => {
    const h = makeHarness();
    const getLeaf = h.app.workspace.getLeaf as (...args: unknown[]) => { view: unknown; setViewState: (s: unknown) => Promise<void> };
    const leaf = getLeaf('tab');
    await leaf.setViewState({ type: CITY_VIEW_TYPE, active: false });
    // revealLeaf deliberately never called: this leaf is not the one being shown.
    expect(leaf.view).not.toBeInstanceOf(CityView);
    expect(createRendererSpy).not.toHaveBeenCalled();
  });
});
