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
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { nextTick } from 'vue';
import { CityView } from '../../src/host/city-view';
import { ScanCoordinator } from '../../src/application/scan-coordinator';
import { InMemorySnapshotStore } from '../../src/adapters/storage/in-memory-snapshot-store';
import { createFakeSourceFileSystem } from '../fixtures/fake-source-filesystem';
import { createFixedClock } from '../fixtures/clock';
import { dataPortDeps } from '../fixtures/data-port-deps';
import { buildSnapshotFixture } from '../fixtures/snapshot-builder';
import { defaultCityViewState } from '../../src/host/view-state';
import { createPopoutWindow, destroyAllPopoutWindows, installControllableResizeObserver, migrateElement } from '../mocks/window-harness';
import { migrationCallbacks } from '../mocks/obsidian';
import { makePluginDouble } from '../fixtures/city-view-doubles';
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
/** What a REAL renderer's first `setLayout` reports on its way past: the auto-fit's own
 *  camera. Deliberately unlike either bookmark above, so "the restore was lost" is
 *  visible rather than coincidentally equal to what was wanted. */
const AUTO_FIT_CAMERA: CameraBookmark = {
  projection: 'orthographic', mode: '3d', position: [77, 77, 77], target: [5, 5, 5], up: [0, 1, 0], zoom: 0.01,
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
    setLayout: spies.setLayout, setColors: spies.setColors, setSelection: vi.fn(), setFilter: vi.fn(), setReported: vi.fn(), setRelations: vi.fn(),
    setLabels: vi.fn(), setCameraMode: vi.fn(), setMotion: vi.fn(),
    getCamera: vi.fn((): CameraBookmark => CAMERA_A), setCamera: spies.setCamera, nudgeCamera: vi.fn(),
    focus: vi.fn(), fit: vi.fn(), resize: vi.fn(), pause: vi.fn(), resume: vi.fn(), dispose: spies.dispose,
    getDiagnostics: vi.fn(() => ({
      geometries: 0, textures: 0, programs: 0, drawCalls: 0, instanceCount: 0, lastFrameMs: 0, contextLost: false,
    })),
    debugLoseContext: vi.fn(),
  };
}

// Phase 2c, I5 (Important): AN HONEST DOUBLE. This used to be
// `vi.fn(async () => {})`, and a `setLayout` that does nothing never fits, so it never
// emits `camera-changed` -- which is exactly the event the frozen 4.2 contract says the
// FIRST layout produces ("the FIRST layout frames itself", city-renderer.ts's `hasFitted`
// guard -> `rig.fit()` -> a rig-INITIATED commit -> `camera-changed`). With that event
// stubbed away, `lands the camera where it left off` below asserted a CALL and passed
// while production destroyed the bookmark (C1). The double now mirrors the contract, so
// the assertion is about an OUTCOME and the suite can tell the broken version from the
// fixed one.
vi.mock('../../src/visualization/city-renderer', () => ({
  createCityRenderer: vi.fn((_mountEl: HTMLElement, win: Window, onEvent: (e: CityRendererEvent) => void) => {
    const dispose = vi.fn<() => void>();
    let hasFitted = false;
    const setLayout = vi.fn<CityRendererPort['setLayout']>(async () => {
      if (hasFitted) return;
      hasFitted = true;
      onEvent({ type: 'camera-changed', camera: AUTO_FIT_CAMERA });
    });
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
  const deps: CityViewDeps = { profileStore, getFilesystem: () => port, snapshotStore, clock: createFixedClock(), ...dataPortDeps() };
  const view = new CityView({ width: 1000, height: 700 } as never, makePluginDouble() as never, deps);
  await view.setState({ ...defaultCityViewState(), profileId: 'p1', snapshotId: 's1', route: 'city' }, {} as never);
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

  // Fix round 1, Minor 9: every `createPopoutWindow()` in this file is a real rAF
  // loop (`pretendToBeVisual: true`); this closes every one this file created,
  // regardless of whether the test itself called `destroy()`.
  afterEach(() => {
    destroyAllPopoutWindows();
  });

  it('is signalled by HTMLElement.onWindowMigrated on containerEl', async () => {
    const view = new CityView({ width: 1000, height: 700 } as never, makePluginDouble() as never, {
      profileStore: makeProfileStoreDouble(), getFilesystem: () => createFakeSourceFileSystem({}).port,
      snapshotStore: new InMemorySnapshotStore(createFixedClock()), clock: createFixedClock(), ...dataPortDeps(),
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
    // Phase 2c, I5: the SECOND renderer now auto-fits like a real one, so this is an
    // outcome and not merely a call -- it is only CAMERA_B if the restore captured the
    // bookmark BEFORE issuing setLayout. Both halves are asserted: the last camera the
    // port was commanded with, and that it was never left holding the fit's own camera.
    expect(rendererCalls[1]!.setCamera).toHaveBeenLastCalledWith(CAMERA_B);
    expect(rendererCalls[1]!.setCamera).not.toHaveBeenCalledWith(AUTO_FIT_CAMERA);
  });

  it('creates every DOM node in the NEW window, never the old one', async () => {
    // Fix round 1, Minor 7: `adoptNode` moves every EXISTING node and
    // `createCityRenderer` is mocked, so nothing is actually CREATED after
    // migration -- the loop below was tautological (every one of these nodes was
    // going to report the popout's document regardless of whether anything this
    // task built was correct). The renderer double's own captured `win` argument
    // -- the window `CityViewport` actually constructed the SECOND renderer with
    // -- is the real, non-tautological assertion: it is the one call this task
    // adds that genuinely creates something, and only a correct reconstruction
    // passes the NEW window to the factory at all.
    const { view } = await openViewWithSnapshot();
    const popout = createPopoutWindow();
    migrateElement(view.containerEl, popout);
    await nextTick();
    expect(rendererCalls).toHaveLength(2);
    expect(rendererCalls[1]!.win).toBe(popout.win);

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
      // Ruling M80 (task 11 fix round 1, item 2): context loss now reconstructs on
      // its OWN, with no external trigger at all -- two ticks (the notice's own
      // flush, then applySize()'s own `unavailableReason.value = null` flush), no
      // resize. Migration (window-migration.ts's own dispose) still funnels through
      // the SAME `applySize()`-on-null-handle mechanism; that shared mechanism, and
      // neither ever touching the coordinator, is what "one recovery path" means.
      await nextTick();
      await nextTick();
      expect(createRendererSpy).toHaveBeenCalledTimes(2);
      // A genuinely external resize afterward is a harmless no-op here -- proves
      // self-reconstruction did not leave anything needing a THIRD build.
      observer.trigger();
      await nextTick();
      expect(createRendererSpy).toHaveBeenCalledTimes(2);
      expect(coordinatorStartSpy).not.toHaveBeenCalled();
    } finally {
      observer.restore();
    }
  });

  // Task 11 fix round 1, item 3 (Important): this task's own "Ends with" clause is
  // "no wrong-window DOM" -- unmet before this fix. CityViewport's own migration
  // handler disposed and reconstructed the RENDERER but left its ResizeObserver
  // instance built off the OLD window's constructor, which has no defined
  // behaviour once the observed element has moved to another document.
  it('rebuilds the ResizeObserver in the new window after migration', async () => {
    const { view } = await openViewWithSnapshot();
    const popout = createPopoutWindow();
    migrateElement(view.containerEl, popout);
    await nextTick();
    expect(rendererCalls).toHaveLength(2);   // migration's own reconstruction

    // A resize reported through the POPOUT's own controllable ResizeObserver --
    // never the outer window's -- must still reach the (new) renderer.
    const stage = view.contentEl.querySelector<HTMLElement>('[data-ci-role="stage"]')!;
    stage.getBoundingClientRect = () => ({
      width: 200, height: 700, top: 0, left: 0, right: 200, bottom: 700, x: 0, y: 0, toJSON: () => ({}),
    });
    popout.triggerResize();
    expect(rendererCalls[1]!.dispose).toHaveBeenCalledTimes(1);
  });

  // Phase 2 fix wave, M3: App.vue re-attaches BOTH its keydown listener and its own
  // ResizeObserver on migration, and only the keydown half was held down -- removing
  // the `attachResizeObserver(el)` line alone left the suite green (mutation Q4).
  // App's observer is what evaluates the 820 px drawer threshold AND (fix wave I2)
  // the 320 px list-first floor, so an observer left pointing at the old window's
  // constructor means neither is ever re-evaluated in the pop-out.
  it('M3: re-attaches the shell OWN ResizeObserver to the new window', async () => {
    const { view } = await openViewWithSnapshot();
    const popout = createPopoutWindow();
    migrateElement(view.containerEl, popout);
    await nextTick();

    // The leaf is dragged narrow IN THE POP-OUT. Only an observer built from the
    // pop-out's own constructor can hear this.
    view.contentEl.getBoundingClientRect = () => ({
      width: 200, height: 700, top: 0, left: 0, right: 200, bottom: 700, x: 0, y: 0, toJSON: () => ({}),
    });
    popout.triggerResize();
    await nextTick();

    expect(view.contentEl.querySelector('[data-ci-role="stage"]')).toBeNull();
    expect(view.contentEl.querySelector('.ci-app__list-wrapper--open')).not.toBeNull();
  });

  // Same clause, App.vue's half: the 820px drawer threshold and the Escape
  // shortcut were never re-attached to the new window/document at all before this
  // fix -- resizing across 820px in the pop-out did not re-evaluate the drawer
  // layout, and Escape read the OLD document's `activeElement` forever (dead), so
  // neither the drawer nor the inspector could be closed by keyboard there.
  it('moves the Escape shortcut to the new document after migration', async () => {
    const { view } = await openViewWithSnapshot();
    const popout = createPopoutWindow();

    const row = view.contentEl.querySelector<HTMLButtonElement>('.ci-file-list__row')!;
    row.click();
    await nextTick();
    expect(view.contentEl.querySelector('.ci-file-list__row--selected')).not.toBeNull();

    migrateElement(view.containerEl, popout);
    await nextTick();
    // The row (and its selection) survived the move untouched -- migration never
    // authorises a scan or resets state.
    expect(view.contentEl.querySelector('.ci-file-list__row--selected')).not.toBeNull();
    // Focus itself does not survive a real cross-window move (a browser drops it
    // on reparent) -- re-focus the row in the NEW document, exactly as a user
    // clicking back into the pop-out would, before pressing Escape there.
    row.focus();
    expect(popout.doc.activeElement).toBe(row);

    // Dispatched on the NEW document, exactly where a real pop-out keypress
    // lands -- the OLD (outer) document's own listener, if this were still
    // attached there, would never see this event at all.
    popout.doc.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await nextTick();
    expect(view.contentEl.querySelector('.ci-file-list__row--selected')).toBeNull();
  });

  // Task 11 fix round 1, Minor 6: two `onWindowMigrated` handlers used to race --
  // `window-migration.ts`'s own (containerEl, the PARENT) and `CityViewport.vue`'s
  // own (the stage element, a DESCENDANT) both disposed the shared handle. Real
  // Obsidian's own firing order between a node and its ancestor is not a
  // documented guarantee, and the OLD "a second renderer was constructed" test
  // could not tell child-first from parent-first: it stayed true even if the
  // child's freshly-built renderer was immediately disposed by the parent's own
  // handler running second. `wireWindowMigration` is now a no-op for the renderer
  // (CityViewport is the SOLE disposer), so firing the descendant FIRST and the
  // ancestor SECOND -- the adversarial order -- must leave the reconstructed
  // renderer standing.
  it('is safe regardless of firing order between containerEl and the stage element', async () => {
    const { view } = await openViewWithSnapshot();
    const stage = view.contentEl.querySelector<HTMLElement>('[data-ci-role="stage"]')!;
    const popout = createPopoutWindow();
    const adopted = popout.doc.adoptNode(view.containerEl);
    popout.doc.body.appendChild(adopted);

    // Child (CityViewport's own stage-level handler) first, THEN the parent
    // (containerEl's, city-view.ts's) -- reversed from `migrateElement`'s own
    // root-first tree walk, deliberately, to prove order no longer matters.
    migrationCallbacks.get(stage)?.forEach((cb) => { cb(); });
    migrationCallbacks.get(view.containerEl)?.forEach((cb) => { cb(); });
    await nextTick();

    expect(rendererCalls).toHaveLength(2);            // migration's own reconstruction
    expect(rendererCalls[1]!.dispose).not.toHaveBeenCalled();   // NOT torn down by firing second
  });
});
