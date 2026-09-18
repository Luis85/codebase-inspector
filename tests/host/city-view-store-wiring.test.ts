// Split out of city-view.test.ts (task 9 fix round 1, item 1's own new tests plus
// the item-8 fix to "creates its own Pinia instance per view" pushed that file over
// the 450-line tests/** budget). Same 'jsdom' project routing reason as that file:
// needs a real DOM to mount Vue and measure contentEl. Helper doubles are
// deliberately duplicated here rather than shared, matching this codebase's own
// per-test-file self-containment convention (see any two component test files'
// own `makeRendererDouble()`).
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { nextTick } from 'vue';
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

const DUMMY_CAMERA: CameraBookmark = {
  projection: 'orthographic', mode: '3d',
  position: [0, 0, 0], target: [0, 0, 0], up: [0, 1, 0], zoom: 1,
};

// Declared as its own const, never a live `inertPort.setSelection` member
// expression (which `@typescript-eslint/unbound-method` flags) -- the same pattern
// already resolved this way elsewhere (tests/component/consent-chain.test.ts's
// makeCoordinator(), tests/unit/scan-coordinator.test.ts's spyPort(),
// tests/unit/scan-flow.test.ts's makeProfileStoreDouble()), applied here by giving
// `setSelection` its OWN plain-`vi.fn()` identity up front rather than accessing it
// back off `inertPort` afterwards.
const setSelectionSpy = vi.fn();
// Same reason, same pattern -- see setSelectionSpy's own comment.
const setColorsSpy = vi.fn();

const inertPort: CityRendererPort = {
  setLayout: vi.fn(async () => {}),
  setColors: setColorsSpy,
  setSelection: setSelectionSpy,
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

const { createCityRenderer: createRendererSpy } = await import('../../src/visualization/city-renderer');

function makePluginDouble(): {
  app: { workspace: Record<string, ReturnType<typeof vi.fn>>; vault: { adapter: Record<string, ReturnType<typeof vi.fn>>; configDir: string } };
} {
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

/** jsdom does no real layout: CityViewport's own stage element (a plain nested div,
 *  unlike `view.contentEl`/`containerEl` above, which the ItemView double DOES
 *  stub) always measures 0x0 by default, regardless of the leaf width passed to
 *  `makeLeafDouble`. Task 9 fix round 2, item 1 (ruling M68): before this fix,
 *  nothing in a host-level test ever reached this element at all (CityViewport
 *  stayed passive — the very bug M68 exists to fix), so this gap never mattered
 *  here; `tests/component/city-viewport.test.ts`'s own tests already stub exactly
 *  this, directly on the component. */
function stubStageRect(view: CityView, width: number, height = 700): void {
  const stage = view.contentEl.querySelector<HTMLElement>('[data-ci-role="stage"]');
  if (!stage) throw new Error('test setup: no stage element found');
  stage.getBoundingClientRect = () => ({
    width, height, top: 0, left: 0, right: width, bottom: height, x: 0, y: 0, toJSON: () => ({}),
  });
}

// Task 9 fix round 1, item 1 (Critical): before this fix, neither
// `onLifecycleChange` nor `publishLayout` fed the Pinia stores at all --
// `runStore.setLifecycle` and `cityStore.setCity` had no production caller
// anywhere, so the shipped UI rendered permanently empty. These tests prove the
// PRODUCTION path, not a component-level stand-in.
describe('CityView store wiring (task 9 fix round 1, item 1)', () => {
  beforeEach(() => {
    vi.mocked(createRendererSpy).mockClear();
    setSelectionSpy.mockClear();
    setColorsSpy.mockClear();
  });

  // Task 9 fix round 2, item 1 (Important, ruling M68): before this fix,
  // `CityViewport.vue` only constructed a renderer into the shared handle when
  // a `createCityRenderer` factory was INJECTED, and `city-view.ts` built its
  // OWN renderer directly, never publishing it into the Vue tree — so in
  // production `cityRendererHandle` was permanently null, the eleven WCAG
  // 2.5.7 camera controls rendered visible but inert, and CodebaseFileList's
  // `setSelection` call was a silent no-op. These two tests prove the
  // PRODUCTION path end to end: a real `CityView`'s Vue tree reaches the real
  // (here, mocked-at-the-module-boundary) port, not a component-level double.
  // NOT the primary proof (see the next test for that) — this one only guards
  // against ruling M68's own named risk: providing the factory WITHOUT removing
  // `city-view.ts`'s own direct construction would mean TWO renderers get built
  // (one dormant, one dead), each with its own dispose path. Passes trivially
  // before this fix too (the old path alone calls it once) — the real change
  // this fix makes is WHICH path, proven by the setSelection test below.
  it('constructs exactly one renderer — never two owners at once', async () => {
    const view = new CityView(makeLeafDouble() as never, makePluginDouble() as never, makeDepsDouble());
    await view.onOpen();
    stubStageRect(view, 1000);
    await nextTick();   // CityViewport's own construction is deferred one microtask
    expect(createRendererSpy).toHaveBeenCalledTimes(1);
  });

  // Task 9 fix round 3, item 4 (fold): round 2 replaced ensureRenderer's direct
  // setColors(readPalette(...)) call with a watch() installed after mount() --
  // only correct because CityViewport defers construction by a microtask, and
  // nothing in the suite asserted setColors was ever called on any path at all,
  // so this load-bearing ordering was completely unguarded.
  it('calls setColors on first renderer construction', async () => {
    const view = new CityView(makeLeafDouble() as never, makePluginDouble() as never, makeDepsDouble());
    await view.onOpen();
    stubStageRect(view, 1000);
    await nextTick();
    await nextTick();   // the watch() callback's own flush, one tick after construction
    expect(setColorsSpy).toHaveBeenCalledTimes(1);
  });

  // Spec 4.4 requires re-reading every cached colour on workspace.on('css-change');
  // spec 4.2 requires setColors to supply "every colour the scene draws; re-supplied
  // on css-change" -- also previously unguarded.
  it('calls setColors again on a css-change event', async () => {
    const plugin = makePluginDouble();
    const view = new CityView(makeLeafDouble() as never, plugin as never, makeDepsDouble());
    await view.onOpen();
    stubStageRect(view, 1000);
    await nextTick();
    await nextTick();   // the watch() callback's own flush, one tick after construction
    expect(setColorsSpy).toHaveBeenCalledTimes(1);
    // Reads the callback back off the double's own recorded call, rather than
    // intercepting it via a custom mockImplementation -- `workspace.on`'s
    // generic double type (shared with every other event this file registers)
    // otherwise fights TypeScript's inference for no real benefit here.
    const call = vi.mocked(plugin.app.workspace.on!).mock.calls.find(([event]) => event === 'css-change');
    const cssChangeCb = call![1]! as () => void;
    cssChangeCb();
    expect(setColorsSpy).toHaveBeenCalledTimes(2);
  });

  it('a row activation reaches the REAL port\'s setSelection, not a component-level stand-in', async () => {
    const { deps } = depsWithSnapshot();
    const view = await viewWithSnapshot(deps);
    await nextTick();
    const row = view.contentEl.querySelector<HTMLButtonElement>('.ci-file-list__row')!;
    row.click();
    const snapshot = publishedSnapshot();
    const fileEntity = snapshot.entities.find((e) => e.kind === 'file')!;
    expect(setSelectionSpy).toHaveBeenCalledWith(fileEntity.id);
  });

  it('mirrors a running scan into the run store, visible in the view', async () => {
    const { deps } = depsWithSnapshot();
    const view = await viewWithSnapshot(deps);

    const runPromise = view.startScan();
    await waitUntilRunning(view);
    // COPY-08, via StatusBanner reading the now-wired run store's `run.status`.
    expect(view.contentEl.textContent).toContain('Reading included files.');
    await runPromise;
  });

  it('a completed scan republishes into the city store, not just the renderer', async () => {
    const { deps } = depsWithSnapshot();
    const view = await viewWithSnapshot(deps);
    // depsWithSnapshot's fake filesystem has zero files, so the NEW snapshot's own
    // empty-scope surface (COPY-12) appearing after the refresh proves the city
    // store now holds THAT snapshot -- not merely the original one-file snapshot
    // restored on open, and not nothing.
    expect(view.contentEl.querySelectorAll('.ci-file-list__row').length).toBe(1);
    const runPromise = view.startScan();
    await runPromise;
    expect(view.contentEl.textContent).toContain('No files are included in this scope.');
    expect(view.contentEl.querySelectorAll('.ci-file-list__row').length).toBe(0);
  });

  // Task 9 fix round 1, item 8: this test was vacuous in city-view.test.ts — it
  // only checked that BOTH views render "Select a codebase" text, true regardless
  // of whether the two views' Pinia instances (and their store data) were actually
  // independent, since the welcome copy never depended on store state at all. The
  // whole-branch review proved this by hoisting Pinia to a module-level singleton
  // and finding the test stayed green. Made real: view1 restores a snapshot (via
  // setState + onOpen, item 1's own reopen-restore path) and view2 never does — if
  // `useCityStore(this.pinia)`/`useRunStore(this.pinia)` resolved to a SHARED
  // pinia instead of each view's own, view2 would see view1's row too. Verified by
  // mutation: hoisting `this.pinia` to a module-level singleton in city-view.ts
  // turns this test red (see task-9-report.md).
  it('creates its own Pinia instance per view', async () => {
    const snapshotStore = new InMemorySnapshotStore(createFixedClock());
    snapshotStore.put(publishedSnapshot());
    const view1 = new CityView(makeLeafDouble() as never, makePluginDouble() as never, makeDepsDouble({ snapshotStore }));
    await view1.setState({ ...defaultCityViewState(), profileId: 'p1', snapshotId: 's1' }, {} as never);
    await view1.onOpen();
    await Promise.resolve();

    const view2 = new CityView(makeLeafDouble() as never, makePluginDouble() as never, makeDepsDouble());
    await view2.onOpen();

    // view2 has no snapshot, so it correctly shows the welcome action (item 4's own
    // priority-order fix, done later in this round, is what keeps this reachable);
    // view1 has one restored, so its welcome action correctly does NOT render — the
    // two views disagreeing about this at all is itself part of the independence proof.
    expect(view2.contentEl.textContent).toContain('Select a codebase');
    expect(view1.contentEl).not.toBe(view2.contentEl);
    expect(view1.contentEl.querySelectorAll('.ci-file-list__row').length).toBe(1);
    expect(view2.contentEl.querySelectorAll('.ci-file-list__row').length).toBe(0);
    expect(view2.contentEl.textContent).toContain('Understand your codebase. Start with its structure.');
  });
});
