// Step definitions for the HOST LIFECYCLE scenarios: enable/restore without scanning,
// two leaves, snapshot reconciliation, pop-out migration, real-renderer disposal, and
// the theme-change repair.
//
// Every one of these builds a real `CityView` (the real ItemView, the real Vue mount,
// the real stores, the real reconciliation) over doubles for only what Obsidian itself
// provides -- see view-harness.ts. `rendererControl` (world.ts) decides whether
// `createCityRenderer` hands back a recording double or the genuine production factory.
import { expect, vi } from 'vitest';
import { nextTick } from 'vue';
import CodebaseInspectorPlugin from '../../../src/main';
import { CityView } from '../../../src/host/city-view';
import { defaultCityViewState } from '../../../src/host/view-state';
import { SELECTION_REMOVED_NOTICE } from '../../../src/application/snapshot-reconciliation';
import { SIBLING_RECONCILIATION_NOTICE } from '../../../src/host/view-reconciliation';
import { CATEGORY_IDS } from '../../../src/domain/classify';
import { buildSnapshotFixture } from '../../fixtures/snapshot-builder';
import { createPopoutWindow, migrateElement } from '../../mocks/window-harness';
import { callFor, makeViewHarness, rows, sizeStage } from '../view-harness';
import { MOVED_3D_CAMERA, put, rendererControl, take } from '../world';
import type { StepTable } from '../feature-runner';
import type { World, RendererCall } from '../world';
import type { ViewHarness } from '../view-harness';
import type { CodebaseSnapshot } from '../../../src/domain/model';

export const lifecycleSteps: StepTable<World> = {
  // ---- Do not scan while enabling or restoring the plugin ---------------------------
  'I enable Codebase Inspector or restore a saved workspace': async (world) => {
    const harness = makeViewHarness(world);
    put(world, 'view', harness);
    // ENABLE: the real plugin's own onload, over a double for what Obsidian provides.
    const localStore = new Map<string, unknown>();
    const plugin = Object.create(CodebaseInspectorPlugin.prototype) as CodebaseInspectorPlugin & Record<string, unknown>;
    const registrations = { views: 0, commands: 0, ribbons: 0, leavesOpened: 0 };
    Object.assign(plugin, {
      app: {
        workspace: {
          onLayoutReady: vi.fn(), getLeavesOfType: vi.fn(() => []),
          getLeaf: vi.fn(() => { registrations.leavesOpened += 1; return { setViewState: vi.fn(async () => {}) }; }),
          revealLeaf: vi.fn(async () => {}), on: vi.fn(() => ({})), offref: vi.fn(),
        },
        vault: { adapter: { read: vi.fn(), list: vi.fn() }, configDir: '.obsidian' },
        loadLocalStorage: vi.fn((key: string) => localStore.get(key) ?? null),
        saveLocalStorage: vi.fn((key: string, value: unknown) => { localStore.set(key, value); }),
      },
      registerView: vi.fn(() => { registrations.views += 1; }),
      addRibbonIcon: vi.fn(() => { registrations.ribbons += 1; }),
      addCommand: vi.fn(() => { registrations.commands += 1; }),
      addSettingTab: vi.fn(),
      loadData: vi.fn(async () => ({})), saveData: vi.fn(async () => {}),
    });
    plugin.onload();
    put(world, 'registrations', registrations);
    // RESTORE: a view whose persisted CityViewState already names a snapshot.
    await harness.open('p1', 4);
  },

  'no source enumeration or analyzer process starts without explicit approval': (world) => {
    const harness = take<ViewHarness>(world, 'view');
    const registrations = take<{ views: number; commands: number; ribbons: number; leavesOpened: number }>(
      world, 'registrations',
    );
    // onload REGISTERS ONLY -- and, per the user's own directive, opens no leaf either.
    expect(registrations.views).toBe(1);
    expect(registrations.commands).toBeGreaterThan(0);
    expect(registrations.leavesOpened).toBe(0);
    // No onUserEnable OVERRIDE of its own (the base class declares one): enabling the
    // plugin opens nothing, per the user's directive recorded in src/main.ts.
    expect(Object.prototype.hasOwnProperty.call(CodebaseInspectorPlugin.prototype, 'onUserEnable')).toBe(false);
    // …and restoring a view that already names a snapshot read NOTHING from the source.
    expect(harness.port.readLog()).toEqual([]);
    const view = harness.views[0]!;
    expect(view.isScanRunning()).toBe(false);
    // The retained snapshot IS on screen: this is not passing because nothing loaded.
    expect(rows(view).length).toBe(4);
  },

  // ---- Preserve independent state across two leaves ---------------------------------
  'two inspector leaves use the same immutable snapshot': async (world) => {
    const harness = makeViewHarness(world);
    put(world, 'view', harness);
    const first = await harness.open('shared', 4);
    // The SAME snapshot object out of the one shared, in-memory SnapshotStore.
    const second = new CityView({ width: 1000, height: 700 } as never, harness.plugin as never, harness.deps);
    await second.setState({ ...defaultCityViewState(), profileId: 'shared', snapshotId: 'snap-shared' }, {} as never);
    await second.onOpen();
    sizeStage(second);
    await nextTick();
    await nextTick();
    harness.views.push(second);
    world.cleanups.push(async () => { await second.onClose(); });
    expect(rows(first).length).toBe(4);
    expect(rows(second).length).toBe(4);
    put(world, 'leaf1', first);
    put(world, 'leaf2', second);
  },

  'I select a file and move the camera in the first leaf': async (world) => {
    const first = take<CityView>(world, 'leaf1');
    rows(first)[1]!.click();
    callFor(first).onEvent({ type: 'camera-changed', camera: MOVED_3D_CAMERA });
    await nextTick();
    expect(first.contentEl.querySelector('.ci-file-list__row--selected')).not.toBeNull();
  },

  'the second leaf retains its own query, selection, and camera': (world) => {
    const second = take<CityView>(world, 'leaf2');
    expect(second.contentEl.querySelector('.ci-file-list__row--selected')).toBeNull();
    expect(second.contentEl.querySelector('.ci-inspector')).toBeNull();
    expect(second.contentEl.querySelector<HTMLInputElement>('.ci-search__input')!.value).toBe('');
    // Its own renderer, its own camera: nothing was pushed into it.
    expect(callFor(second).port.calls.setCamera).not.toHaveBeenCalled();
    expect(callFor(second).port).not.toBe(callFor(take<CityView>(world, 'leaf1')).port);
    // getState is what workspace.json persists, per leaf.
    expect((second.getState() as { selectedEntityId: string | null }).selectedEntityId).toBeNull();
  },

  // ---- Reconcile a file removed from the next snapshot ------------------------------
  'I selected a file in snapshot A': async (world) => {
    const harness = makeViewHarness(world);
    put(world, 'view', harness);
    const view = await harness.open('recon', 4);
    const row = rows(view)[2]!;
    put(world, 'removed-path', row.textContent.trim());
    row.click();
    await nextTick();
    put(world, 'leaf1', view);
    put(world, 'selectedId', (view.getState() as { selectedEntityId: string | null }).selectedEntityId);
    expect(take<string>(world, 'selectedId')).not.toBeNull();
  },

  'compatible snapshot B no longer contains that file': async (world) => {
    const view = take<CityView>(world, 'leaf1');
    // The SAME repository, one file short: a compatible successor, not a different
    // codebase. The removed file is the one that was selected (index 2 of 4 -> the
    // successor's index 2 is a DIFFERENT file, which is what makes the second
    // assertion below meaningful).
    const next: CodebaseSnapshot = {
      ...buildSnapshotFixture({ files: 4, directories: 2, repositoryId: 'recon' }),
      snapshotId: 'snap-recon-2',
    };
    const removedPath = take<string>(world, 'removed-path');
    const survivors = next.entities.filter((e) => e.path !== removedPath);
    const survivorIds = new Set(survivors.map((e) => e.id));
    const trimmed: CodebaseSnapshot = {
      ...next, entities: survivors,
      observations: next.observations.filter((o) => survivorIds.has(o.entityId)),
    };
    view.applyReconciliation(trimmed);
    await nextTick();
    put(world, 'next-snapshot', trimmed);
  },

  'the interface explains that the file is absent': () => {
    const notices = Array.from(document.querySelectorAll('.notice')).map((n) => n.textContent ?? '');
    // This leaf did not produce the new snapshot itself (its own `state.snapshotId` is
    // still snapshot A's), so the SIBLING wording is the correct one -- view-
    // reconciliation.ts's fix round 1, Minor 5: telling a sibling "no longer in THIS
    // snapshot" would be untrue, because the sibling's own list still shows the file.
    // Both sentences say the same thing, and both are asserted against their exported
    // constants rather than retyped.
    expect(notices.some((n) => n.includes(SIBLING_RECONCILIATION_NOTICE))).toBe(true);
    expect(SELECTION_REMOVED_NOTICE).toMatch(/no longer/);
    expect(SIBLING_RECONCILIATION_NOTICE).toMatch(/no longer contains the selected file/);
  },

  'it does not select a different file by render-array index': (world) => {
    const view = take<CityView>(world, 'leaf1');
    const state = view.getState() as { selectedEntityId: string | null };
    expect(state.selectedEntityId).toBeNull();
    expect(view.contentEl.querySelector('.ci-file-list__row--selected')).toBeNull();
    // The successor's own entity at the same index still exists and was NOT chosen.
    const successorAtSameIndex = take<CodebaseSnapshot>(world, 'next-snapshot')
      .entities.filter((e) => e.kind === 'file')[2];
    expect(successorAtSameIndex).toBeDefined();
    expect(state.selectedEntityId).not.toBe(successorAtSameIndex!.id);
  },

  // ---- Move a view to a pop-out window ----------------------------------------------
  'an inspector view has selection and a camera bookmark': async (world) => {
    const harness = makeViewHarness(world);
    put(world, 'view', harness);
    const view = await harness.open('popout', 4);
    rows(view)[0]!.click();
    callFor(view).onEvent({ type: 'camera-changed', camera: MOVED_3D_CAMERA });
    await nextTick();
    put(world, 'leaf1', view);
    put(world, 'before-state', view.getState());
    put(world, 'before-renderers', rendererControl.calls.length);
  },

  'I move it to a pop-out window': async (world) => {
    const view = take<CityView>(world, 'leaf1');
    const popout = createPopoutWindow();
    put(world, 'popout', popout);
    migrateElement(view.containerEl, popout);
    // The migrated stage has to be re-measured in its new realm, exactly as a real
    // ResizeObserver in that window would do.
    sizeStage(view);
    popout.triggerResize();
    await nextTick();
    await nextTick();
  },

  'its renderer and events use the owning window context': (world) => {
    const view = take<CityView>(world, 'leaf1');
    const popout = take<ReturnType<typeof createPopoutWindow>>(world, 'popout');
    expect(rendererControl.calls.length).toBeGreaterThan(take<number>(world, 'before-renderers'));
    const latest = rendererControl.calls.at(-1)!;
    expect(latest.win).toBe(popout.win);
    expect(latest.mountEl.ownerDocument).toBe(popout.doc);
    expect(view.contentEl.ownerDocument).toBe(popout.doc);
  },

  'the saved selection and camera can be restored': (world) => {
    const view = take<CityView>(world, 'leaf1');
    const before = take<Record<string, unknown>>(world, 'before-state');
    const after = view.getState();
    expect(after.selectedEntityId).toBe(before.selectedEntityId);
    expect(after.camera).toEqual(before.camera);
    // The reconstructed renderer was re-aimed at the retained bookmark, not left at
    // whatever setLayout's own auto-fit produced.
    expect(rendererControl.calls.at(-1)!.port.calls.setCamera).toHaveBeenCalledWith(before.camera);
  },

  'closing the original window leaves no stale handlers': async (world) => {
    const view = take<CityView>(world, 'leaf1');
    const before = rendererControl.calls.at(-1)!;
    await view.onClose();
    expect(before.port.calls.dispose).toHaveBeenCalled();
    // Every renderer this view ever built is disposed, not only the newest.
    for (const call of rendererControl.calls) expect(call.port.calls.dispose).toHaveBeenCalled();
    // And the css-change subscription was handed back.
    expect(take<ViewHarness>(world, 'view').app.workspace.offref).toHaveBeenCalled();
  },

  // ---- Dispose the real Three.js renderer --------------------------------------------
  'a real Three.js inspector view has been opened': async (world) => {
    rendererControl.useReal = true;
    const { stubGetContext, captureGetContext } = await import('../../fixtures/renderer-doubles');
    const restore = captureGetContext();
    world.cleanups.push(restore);
    stubGetContext('ok');
    const harness = makeViewHarness(world);
    put(world, 'view', harness);
    const view = await harness.open('real', 4);
    put(world, 'leaf1', view);
    const canvas = view.contentEl.querySelector('canvas');
    expect(canvas, 'the real renderer produced no canvas').not.toBeNull();
    put(world, 'canvas', canvas);
    put(world, 'mount', canvas!.parentElement);
    const { webglInstances } = await import('../wp01.steps');
    expect(webglInstances.length).toBeGreaterThan(0);
    put(world, 'webgl', webglInstances.at(-1));
  },

  'I close the view and disable the plugin': async (world) => {
    await take<CityView>(world, 'leaf1').onClose();
    await nextTick();
  },

  'its owned graphics resources, controls, observers, and scheduled frames are released': (world) => {
    const webgl = take<{ dispose: ReturnType<typeof vi.fn>; forceContextLoss: ReturnType<typeof vi.fn> }>(world, 'webgl');
    expect(webgl.dispose).toHaveBeenCalled();
    expect(webgl.forceContextLoss).toHaveBeenCalled();
    // The canvas is gone from the DOM, so no surface outlives the view.
    const mount = take<HTMLElement>(world, 'mount');
    expect(mount.querySelector('canvas')).toBeNull();
    expect(take<HTMLCanvasElement>(world, 'canvas').isConnected).toBe(false);
  },

  'late asynchronous callbacks cannot mutate the detached view': async (world) => {
    const view = take<CityView>(world, 'leaf1');
    const webgl = take<{ render: ReturnType<typeof vi.fn> }>(world, 'webgl');
    const framesBefore = webgl.render.mock.calls.length;
    // A snapshot arriving after the view is gone: the reconciliation path a closed or
    // rebound view is exactly the target of.
    view.applyReconciliation({
      ...buildSnapshotFixture({ files: 2, repositoryId: 'real' }), snapshotId: 'snap-late',
    });
    await nextTick();
    await new Promise((resolve) => window.setTimeout(resolve, 20));
    expect(webgl.render.mock.calls.length).toBe(framesBefore);
    expect(view.contentEl.querySelector('canvas')).toBeNull();
    expect(view.contentEl.querySelector('.ci-file-list__row')).toBeNull();
  },

  // ---- REPAIR 2: theme change while a city is open -----------------------------------
  'a city is rendered with a selection and a moved camera': async (world) => {
    const harness = makeViewHarness(world);
    put(world, 'view', harness);
    const view = await harness.open('theme', 4);
    // jsdom has neither an Obsidian theme nor a 2D canvas context, so the two halves of
    // the real path answer differently here: the TOKEN LOOKUP is answered by a stand-in
    // on the very element `readPalette` reads from, and `cssColorToSrgbBytes` -- which
    // resolves oklch()/color-mix() by painting into a 1x1 canvas -- always returns its
    // documented neutral, because `getContext('2d')` is null. So this scenario asserts
    // the CHANNEL, not the pixel: every token the scene draws with is READ AGAIN and
    // handed to setColors. `readPalette` and `theme-bridge.ts` are otherwise untouched
    // production code. (The pixel half is checked against a real host at checkpoint
    // level; see docs/superpowers/notes/2026-09-17-wp01-gate-evidence.md, G4.)
    const theme = { tokens: { '--ci-surface': '#1e1e1e' } as Record<string, string>, reads: [] as string[] };
    (view.contentEl as unknown as { getCssPropertyValue: (t: string) => string })
      .getCssPropertyValue = (token: string) => { theme.reads.push(token); return theme.tokens[token] ?? ''; };
    put(world, 'theme', theme);
    rows(view)[1]!.click();
    callFor(view).onEvent({ type: 'camera-changed', camera: MOVED_3D_CAMERA });
    await nextTick();
    put(world, 'leaf1', view);
    const call = callFor(view);
    put(world, 'call', call);
    put(world, 'layout-before', view.contentEl.querySelector('.ci-file-list')!.textContent);
    put(world, 'setLayout-before', call.port.calls.setLayout.mock.calls.length);
    put(world, 'setColors-before', call.port.calls.setColors.mock.calls.length);
    put(world, 'setSelection-before', call.port.calls.setSelection.mock.calls.length);
    put(world, 'camera-before', view.getState().camera);
    put(world, 'selection-before', view.getState().selectedEntityId);
  },

  'the Obsidian theme changes from dark to light': async (world) => {
    const harness = take<ViewHarness>(world, 'view');
    const theme = take<{ tokens: Record<string, string>; reads: string[] }>(world, 'theme');
    theme.tokens['--ci-surface'] = '#ffffff';
    theme.reads.length = 0;                       // only what the CHANGE itself re-reads
    expect(harness.cssChange.length, 'nothing subscribed to css-change').toBeGreaterThan(0);
    // The event carries no payload: everything is re-read (theme-bridge.ts).
    for (const handler of harness.cssChange) handler();
    await nextTick();
  },

  'every colour the scene draws is re-supplied': (world) => {
    const call = take<RendererCall>(world, 'call');
    const theme = take<{ tokens: Record<string, string>; reads: string[] }>(world, 'theme');
    expect(call.port.calls.setColors.mock.calls.length).toBeGreaterThan(take<number>(world, 'setColors-before'));
    const palette = call.port.calls.setColors.mock.calls.at(-1)![0] as Record<string, unknown>;
    // Every field of CityPalette (spec §4.2's seven, no more and no fewer).
    expect(Object.keys(palette).sort()).toEqual([
      'background', 'categories', 'districtBorder', 'districtSurface', 'labelText',
      'selection', 'unavailable',
    ]);
    expect(Object.keys(palette.categories as Record<string, string>)).toHaveLength(CATEGORY_IDS.length);
    // …and every token behind them was READ AGAIN by this change, never served from a
    // cache: the six scene tokens plus one per category.
    for (const token of ['--ci-surface', '--ci-panel', '--ci-border', '--ci-text', '--ci-action', '--ci-text-muted']) {
      expect(theme.reads, token).toContain(token);
    }
    for (const id of CATEGORY_IDS) expect(theme.reads).toContain(`--ci-cat-${id}`);
  },

  'no building has moved': (world) => {
    const call = take<RendererCall>(world, 'call');
    const view = take<CityView>(world, 'leaf1');
    expect(call.port.calls.setLayout.mock.calls.length).toBe(take<number>(world, 'setLayout-before'));
    expect(view.contentEl.querySelector('.ci-file-list')!.textContent).toBe(take<string>(world, 'layout-before'));
  },

  'the camera is unchanged': (world) => {
    const call = take<RendererCall>(world, 'call');
    expect(take<CityView>(world, 'leaf1').getState().camera).toEqual(take<unknown>(world, 'camera-before'));
    expect(call.port.calls.setCamera).not.toHaveBeenCalled();
    expect(call.port.calls.nudgeCamera).not.toHaveBeenCalled();
    expect(call.port.calls.fit).not.toHaveBeenCalled();
  },

  'the selection is unchanged': (world) => {
    const call = take<RendererCall>(world, 'call');
    const view = take<CityView>(world, 'leaf1');
    expect(view.getState().selectedEntityId).toBe(take<string>(world, 'selection-before'));
    expect(call.port.calls.setSelection.mock.calls.length).toBe(take<number>(world, 'setSelection-before'));
    expect(view.contentEl.querySelector('.ci-file-list__row--selected')).not.toBeNull();
  },
};
