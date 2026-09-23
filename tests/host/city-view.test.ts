// Lives under tests/host/ (matching the brief's file list) but needs a real DOM to
// mount Vue and measure contentEl. vitest.config.ts routes this one file to the
// 'jsdom' project (by exact path) instead of the 'node' project the rest of
// tests/host/** uses, rather than moving the whole directory to jsdom.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { nextTick } from 'vue';
import { CityView, CITY_VIEW_TYPE } from '../../src/host/city-view';
import { InMemorySnapshotStore } from '../../src/adapters/storage/in-memory-snapshot-store';
import { createFakeSourceFileSystem } from '../fixtures/fake-source-filesystem';
import { createFixedClock } from '../fixtures/clock';
import { dataPortDeps } from '../fixtures/data-port-deps';
import { buildSnapshotFixture } from '../fixtures/snapshot-builder';
import { defaultCityViewState } from '../../src/host/view-state';
import { makePluginDouble } from '../fixtures/city-view-doubles';
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

/** Polls (via microtask ticks only -- no real timer) until the view's coordinator is
 *  actually running, so a test can reliably cancel/close mid-scan. */
async function waitUntilRunning(view: CityView): Promise<void> {
  for (let i = 0; i < 50 && !view.isScanRunning(); i += 1) await Promise.resolve();
}

/** Polls (microtask ticks only) until a modal is open. Fix round 4: resolveOrCreateProfile
 *  now migrates an existing empty-exclusions profile via an EXTRA `ProfileStore.update()`
 *  await hop (ruling M44's migration half) before the consent chain can open anything, so
 *  a fixed tick count is no longer safe -- this polls instead of guessing a number. */
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
  setFilter: vi.fn(), setReported: vi.fn(),
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
    clock: createFixedClock(), ...dataPortDeps(),
    ...overrides,
  };
}

/** Task 12: a fresh leaf opens on Overview; the WP-01 city tests restore the city route. */
async function openOnCity(view: CityView): Promise<void> {
  await view.setState({ ...defaultCityViewState(), route: 'city' }, {} as never);
  await view.onOpen();
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
    await openOnCity(view);
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

  // Phase 2 fix wave, M2: spec 11 names the ordering between `setState` and `onOpen`
  // on workspace restore as an OPEN QUESTION, so `city-view.ts` seeds from both --
  // and the setState-arrives-second branch shipped with no test at all (mutation Q2,
  // deleting the call, left the suite green). Asserted through the DOM rather than
  // through `getState()`: `this.state` round-tripping proves only that setState
  // stored the payload, which is the vacuous shape the review called out elsewhere.
  // The search field showing the restored query proves the LIVE store was seeded.
  it('M2: seeds the live store when setState arrives AFTER onOpen', async () => {
    const view = new CityView(makeLeafDouble() as never, makePluginDouble() as never, makeDepsDouble());
    await openOnCity(view);
    const input = view.contentEl.querySelector<HTMLInputElement>('.ci-search__input')!;
    expect(input.value).toBe('');

    await view.setState({ ...defaultCityViewState(), query: 'file-0', route: 'city' }, {} as never);
    await nextTick();

    expect(input.value).toBe('file-0');
  });

  it('M2: a REJECTED late setState seeds nothing', async () => {
    const view = new CityView(makeLeafDouble() as never, makePluginDouble() as never, makeDepsDouble());
    await openOnCity(view);
    await view.setState({ ...defaultCityViewState(), query: 'file-0', viewMode: 'vr', route: 'city' }, {} as never);
    await nextTick();

    expect(view.contentEl.querySelector<HTMLInputElement>('.ci-search__input')!.value).toBe('');
  });

  // "creates its own Pinia instance per view" moved wholesale, not weakened, to
  // tests/host/city-view-store-wiring.test.ts (fix round 1, items 1 and 8): this
  // file was at the tests/** 450-line budget once that rewrite (non-vacuous — see
  // that file's own comment) landed alongside the two new store-wiring tests.

  // M68's own construction now goes through CityViewport's OWN stage element,
  // measured via `tests/mocks/obsidian.ts`'s generous 1000x700 default rect.
  it('unmounts Vue and disposes the renderer in onClose', async () => {
    const view = new CityView(makeLeafDouble() as never, makePluginDouble() as never, makeDepsDouble());
    await openOnCity(view);
    await nextTick();   // CityViewport's own construction is deferred one microtask
    expect(createRendererSpy).toHaveBeenCalledTimes(1);
    await view.onClose();
    expect(inertPort.dispose).toHaveBeenCalled();
    expect(view.contentEl.childElementCount).toBe(0);
  });

  // The stage element's own measurement drives this now (M68), overridden at the
  // PROTOTYPE level (active from CityViewport's first measurement) rather than
  // per-element, which would race the mocks file's own 1000x700 default.
  //
  // Phase 2 fix wave, I2 (Important): this test used to assert that COPY-14 ("The 3D
  // view is unavailable...") is what a below-floor leaf shows. Spec 5.2 says the
  // opposite -- "below a hard floor of 320 CSS px inline size the view renders
  // LIST-FIRST and creates no WebGL context at all" -- and an empty bordered stage
  // carrying that notice, with the file list hidden behind the Files drawer opener,
  // IS the defect I2 names. The load-bearing half of this test (no WebGL context is
  // ever created) is unchanged and still first; what replaced the notice assertion
  // is the OTHER half of the same spec sentence, which now ships.
  it('creates NO WebGL context below the 320 CSS px hard floor, and renders list-first', async () => {
    const rectSpy = vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({
      width: 300, height: 700, top: 0, left: 0, right: 300, bottom: 700, x: 0, y: 0, toJSON: () => ({}),
    });
    try {
      const view = new CityView(makeLeafDouble(300) as never, makePluginDouble() as never, makeDepsDouble());
      await openOnCity(view);
      await nextTick();
      await nextTick();   // `available.value = false`'s OWN render flush
      expect(createRendererSpy).not.toHaveBeenCalled();
      expect(view.contentEl.querySelector('[data-ci-role="stage"]')).toBeNull();
      expect(view.contentEl.querySelector('.ci-app__list-wrapper--open')).not.toBeNull();
      expect(view.contentEl.textContent).toContain('Return to city view');
    } finally {
      rectSpy.mockRestore();
    }
  });

  it('never starts a scan on open, and never on a resize/visibility change either', async () => {
    // pause/resume invariant (spec 4.2): visibility never authorises a scan. onOpen and
    // CityViewport's own sizing/ResizeObserver (ruling M68: this file no longer owns
    // any of that itself) are the hooks that run without a user click; neither may
    // consult the profile store, which every real scan path (resolveOrCreateProfile)
    // always does first.
    const deps = makeDepsDouble();
    const getFilesystem = vi.fn(deps.getFilesystem);
    const view = new CityView(makeLeafDouble() as never, makePluginDouble() as never, { ...deps, getFilesystem });
    // getFilesystem WAS called once already, by the constructor above, to build the
    // coordinator's port -- that is plumbing, not a scan.
    expect(getFilesystem).toHaveBeenCalledTimes(1);
    await view.onOpen();
    expect(deps.profileStore.list).not.toHaveBeenCalled();
    expect(deps.profileStore.get).not.toHaveBeenCalled();
    // Still exactly the one constructor-time call -- onOpen never calls it again.
    expect(getFilesystem).toHaveBeenCalledTimes(1);
  });

  it('clicking "Select a codebase" runs the full consent chain (selectCodebase, not startScan)', async () => {
    const deps = makeDepsDouble({ profileStore: makeProfileStoreDouble([
      { profileId: 'p1', name: 'Alpha', bindingId: null, exclusions: [], maxFileBytes: 5_000_000 },
    ]) });
    const view = new CityView(makeLeafDouble() as never, makePluginDouble() as never, deps);
    await openOnCity(view);

    const button = view.contentEl.querySelector<HTMLButtonElement>('.ci-welcome__action')!;
    button.click();
    // selectCodebase() is async; let it reach the point of opening the first modal.
    const modal = await waitForModal();
    expect(modal.textContent).toContain('Select a codebase');

    // Clean up: cancel the modal so its pending promise settles and no DOM survives
    // into the next test.
    modal.querySelector<HTMLButtonElement>('[data-action="cancel"]')!.click();
    await Promise.resolve();
    document.querySelectorAll('.modal-container').forEach((el) => { el.remove(); });
  });

  // Task 5 (F7): the toolbar's own Scan control (App.vue's `.ci-toolbar__scan`) must
  // reach a user through the SAME consent chain the command palette's 'scan-codebase'
  // entry already uses (commands.ts: `view.startScan()`) -- never a direct
  // `coordinator.start()` call, which would be the renderer obtaining authority to
  // read paths on its own. Real host wiring, not a component double: this is
  // `startScan()`'s actual first-scan branch (no `state.snapshotId` yet), so seeing
  // the source modal here proves the click reached `startScan()` itself.
  it('clicking the toolbar Scan control runs the full consent chain (startScan)', async () => {
    const deps = makeDepsDouble({ profileStore: makeProfileStoreDouble([
      { profileId: 'p1', name: 'Alpha', bindingId: null, exclusions: [], maxFileBytes: 5_000_000 },
    ]) });
    const view = new CityView(makeLeafDouble() as never, makePluginDouble() as never, deps);
    await openOnCity(view);

    const button = view.contentEl.querySelector<HTMLButtonElement>('.ci-toolbar__scan')!;
    button.click();
    const modal = await waitForModal();
    expect(modal.textContent).toContain('Select a codebase');

    modal.querySelector<HTMLButtonElement>('[data-action="cancel"]')!.click();
    await Promise.resolve();
    document.querySelectorAll('.modal-container').forEach((el) => { el.remove(); });
  });

  // "selectCodebase vs startScan (ruling M46)" moved to
  // tests/host/city-view-scan-modes.test.ts (task 11 fix round 1, item 0: this file
  // was at the tests/** 450-line cap).

  // Fix wave item 1 (C1, Critical), layer 2: withScanGuard had try/finally with NO
  // catch, and both entry points are `void view.startScan()` -- so ANY rejection from
  // the consent chain or from resolveOrCreateProfile (PluginDataProfileStore.list()
  // validates every record and throws on the first bad one) vanished into an unhandled
  // promise rejection. Spec 7: never dropped silently.
  it('surfaces a scan-start failure as a Notice instead of an unhandled rejection', async () => {
    const profileStore = makeProfileStoreDouble();
    profileStore.list = vi.fn(() => Promise.reject(new Error('one hand-edited profile is invalid')));
    const view = new CityView(makeLeafDouble() as never, makePluginDouble() as never, makeDepsDouble({ profileStore }));
    await view.onOpen();

    await expect(view.startScan()).resolves.toBeUndefined();
    const notices = [...document.querySelectorAll('.notice')].map((n) => n.textContent ?? '');
    expect(notices.some((t) => t.includes('one hand-edited profile is invalid'))).toBe(true);
  });

  it('isScanRunning() reflects the coordinator, not a separate flag', () => {
    const view = new CityView(makeLeafDouble() as never, makePluginDouble() as never, makeDepsDouble());
    expect(view.isScanRunning()).toBe(false);
    // cancelScan() on an idle view is a documented no-op, never a throw.
    expect(() => { view.cancelScan(); }).not.toThrow();
  });

  it('shows the FULL COPY-10 retention sentence after a cancelled refresh, even on a ' +
     'FRESH coordinator restored via setState (fix round 1, Important 1)', async () => {
    // The scenario the finding names exactly: a snapshot was published by SOME
    // coordinator (possibly a now-gone one, e.g. a closed/re-created/popped-out view),
    // the shared SnapshotStore still holds it, and THIS view only knows about it
    // because setState restored the id. This view's OWN coordinator has never
    // completed anything -- lifecycle.publishedSnapshotId is null on it from the start.
    const snapshotStore = new InMemorySnapshotStore(createFixedClock());
    snapshotStore.put(publishedSnapshot());
    const { port } = createFakeSourceFileSystem({ 'a.ts': 'x', 'b.ts': 'y', 'c.ts': 'z' });
    const profileStore = makeProfileStoreDouble([
      { profileId: 'p1', name: 'Alpha', bindingId: null, exclusions: [], maxFileBytes: 5_000_000 },
    ]);
    const deps: CityViewDeps = { profileStore, getFilesystem: () => port, snapshotStore, clock: createFixedClock(), ...dataPortDeps() };
    const view = new CityView(makeLeafDouble() as never, makePluginDouble() as never, deps);
    await view.setState({ ...defaultCityViewState(), profileId: 'p1', snapshotId: 's1' }, {} as never);
    await view.onOpen();

    const runPromise = view.startScan();   // refresh path: state.snapshotId is already 's1'
    await waitUntilRunning(view);
    expect(view.isScanRunning()).toBe(true);
    view.cancelScan();
    await runPromise;

    const notices = [...document.querySelectorAll('.notice')].map((n) => n.textContent ?? '');
    const cancelNotice = notices.find((t) => t.includes('Scan cancelled. The incomplete result was discarded.'));
    expect(cancelNotice).toBeDefined();
    expect(cancelNotice).toContain('Your complete snapshot from');
    expect(cancelNotice).toContain('is unchanged.');
  });

  it('cancels an in-flight scan when the view is closed (fix round 1, Important 2)', async () => {
    const snapshotStore = new InMemorySnapshotStore(createFixedClock());
    snapshotStore.put(publishedSnapshot());
    const { port } = createFakeSourceFileSystem({ 'a.ts': 'x', 'b.ts': 'y', 'c.ts': 'z' });
    const profileStore = makeProfileStoreDouble([
      { profileId: 'p1', name: 'Alpha', bindingId: null, exclusions: [], maxFileBytes: 5_000_000 },
    ]);
    const deps: CityViewDeps = { profileStore, getFilesystem: () => port, snapshotStore, clock: createFixedClock(), ...dataPortDeps() };
    const view = new CityView(makeLeafDouble() as never, makePluginDouble() as never, deps);
    await view.setState({ ...defaultCityViewState(), profileId: 'p1', snapshotId: 's1' }, {} as never);
    await view.onOpen();

    const runPromise = view.startScan();
    await waitUntilRunning(view);
    expect(view.isScanRunning()).toBe(true);

    await view.onClose();
    await runPromise;

    // If onClose had not cancelled it, this fast in-memory "walk" would simply run to
    // completion unobserved and publish a NEW snapshot id -- the retained id changing
    // is exactly what a genuinely-stopped (rather than merely ignored) scan prevents.
    expect(snapshotStore.latestFor('p1')?.snapshotId).toBe('s1');
  });

  it('does not create two profiles from two overlapping startScan() calls (fix round 1, Minor 6)', async () => {
    const profileStore = makeProfileStoreDouble();   // empty: forces resolveOrCreateProfile to CREATE one
    const deps = makeDepsDouble({ profileStore });
    const view = new CityView(makeLeafDouble() as never, makePluginDouble() as never, deps);
    await view.onOpen();

    const p1 = view.startScan();
    const p2 = view.startScan();
    // Let both calls run far enough to reach (or be turned away from)
    // resolveOrCreateProfile, well before either modal could resolve on its own.
    await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
    expect(profileStore.save).toHaveBeenCalledTimes(1);

    // Clean up: cancel whichever modal the surviving call opened, so both promises settle.
    const modal = await waitForModal();
    modal.querySelector<HTMLButtonElement>('[data-action="cancel"]')!.click();
    await Promise.all([p1, p2]);
    document.querySelectorAll('.modal-container').forEach((el) => { el.remove(); });
  });
});
