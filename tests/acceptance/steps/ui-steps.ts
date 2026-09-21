// Step definitions for the scenarios a USER performs INSIDE the view: selection, the
// inspector, search, Escape, the camera controls and pointer gestures. The consent
// chain, the no-renderer fallback and the clipboard fallback moved to consent-steps.ts
// when this file reached the tests/** 450-line cap; the shared baseline helpers moved to
// ../baseline.ts so both modules share one definition of "unchanged".
//
// Every "When" below goes through the DOM -- a click on a real button, a real `input`
// event, a real `keydown`, a real pointer gesture -- never a store action standing in
// for one (task-12-context.md §0).
import { expect, vi } from 'vitest';
import { nextTick } from 'vue';
import {
  MOVED_3D_CAMERA, buttonNamed, clickReal, fileRows, mountCity, pressKey, put, searchInput,
  take, typeQuery, ui,
} from '../world';
import { FIT_CAMERA, expectCameraUnchanged, markBaseline } from '../baseline';
import type { Baseline } from '../baseline';
import type { StepTable } from '../feature-runner';
import type { World } from '../world';
import { createPicking } from '../../../src/visualization/picking';
import { COPY_30_EXPLANATION, formatCopy11 } from '../../../src/ui/copy';

async function selectFirstRow(world: World): Promise<void> {
  const harness = ui(world);
  const row = fileRows(harness)[0]!;
  put(world, 'row', row);
  put(world, 'entityId', row.textContent.trim());
  await clickReal(row);
  put(world, 'selectedId', harness.store.selectedEntityId);
  markBaseline(world);
}

export const uiSteps: StepTable<World> = {
  'an inventory snapshot is visible in the city': async (world) => {
    const harness = await mountCity(world, { files: 9, directories: 3 });
    harness.emit({ type: 'camera-changed', camera: FIT_CAMERA });
    await nextTick();
    expect(fileRows(harness).length).toBe(9);
    markBaseline(world);
  },

  'the camera is positioned away from the default view': async (world) => {
    const harness = ui(world);
    harness.emit({ type: 'camera-changed', camera: MOVED_3D_CAMERA });
    await nextTick();
    expect(harness.store.camera).toEqual(MOVED_3D_CAMERA);
    markBaseline(world);
  },

  'I select a file from the file list': selectFirstRow,
  'a file is selected from the file list': selectFirstRow,

  'that file is selected in the city and inspector': (world) => {
    const harness = ui(world);
    const selected = take<string>(world, 'selectedId');
    expect(selected).not.toBeNull();
    // The CITY: the one store-to-port mirror CityViewport owns.
    expect(harness.renderer?.calls.setSelection).toHaveBeenCalledWith(selected);
    // The INSPECTOR: really on screen, showing this file's own measurements.
    const inspector = harness.container.querySelector('.ci-inspector');
    expect(inspector, 'the inspector did not open').not.toBeNull();
    const path = take<string>(world, 'entityId');
    expect(inspector!.textContent).toContain(path.slice(path.lastIndexOf('/') + 1));
    expect(inspector!.textContent).toMatch(/\d+ lines/);
  },

  'the camera bookmark remains unchanged': expectCameraUnchanged,

  'keyboard focus remains on the activated file control': (world) => {
    expect(document.activeElement).toBe(take<HTMLElement>(world, 'row'));
  },

  'I close its inspector': async (world) => {
    const harness = ui(world);
    await clickReal(buttonNamed(harness, 'Close'));
  },

  'the selected file remains selected': (world) => {
    const harness = ui(world);
    expect(harness.store.selectedEntityId).toBe(take<string>(world, 'selectedId'));
    expect(harness.container.querySelector('.ci-inspector')).toBeNull();
  },

  'the Details action can reopen the same file': async (world) => {
    const harness = ui(world);
    await clickReal(take<HTMLElement>(world, 'row'));
    const inspector = harness.container.querySelector('.ci-inspector');
    expect(inspector, 'the same row did not reopen the inspector').not.toBeNull();
    expect(harness.store.selectedEntityId).toBe(take<string>(world, 'selectedId'));
  },

  'I enter a query that does not match that file': async (world) => {
    await typeQuery(ui(world), 'zzz-no-such-path');
  },

  'its details remain available': (world) => {
    const harness = ui(world);
    expect(harness.store.selectedEntityId).toBe(take<string>(world, 'selectedId'));
    const inspector = harness.container.querySelector('.ci-inspector');
    expect(inspector, 'a filtered-out selection lost its inspector').not.toBeNull();
    expect(inspector!.textContent).toMatch(/\d+ lines/);
  },

  'the interface explains the search mismatch': (world) => {
    const harness = ui(world);
    // COPY-30's own explanation, AND COPY-11's own count, which is what tells a
    // reader the snapshot still holds the files the filter hid. Task 9 (F13): the
    // notice's OLD prose tail ("Reveal file or clear selection.") is real controls
    // now, not text, so only the lead sentence (COPY_30_EXPLANATION) still renders.
    const notice = harness.container.querySelector('.ci-app__selection-notice');
    expect(notice?.textContent).toContain(COPY_30_EXPLANATION);
    expect(notice?.querySelector('.ci-selection-notice__reveal')).not.toBeNull();
    expect(notice?.querySelector('.ci-selection-notice__clear')).not.toBeNull();
    expect(harness.container.querySelector('.ci-file-list__empty')?.textContent)
      .toContain(formatCopy11(9, 'zzz-no-such-path'));
  },

  'file lot coordinates remain unchanged': (world) => {
    const harness = ui(world);
    expect(JSON.stringify(harness.layout.lots.map((lot) => lot.center)))
      .toBe(take<Baseline>(world, 'baseline').lots);
    // …and the filter was applied by DIMMING in place, never by rebuilding the layout:
    // the store still holds the SAME layout, for the same snapshot, lot for lot.
    expect(harness.store.layout!.snapshotId).toBe(harness.layout.snapshotId);
    expect(harness.store.layout!.lots.map((lot) => lot.entityId))
      .toEqual(harness.layout.lots.map((lot) => lot.entityId));
    expect(harness.container.querySelectorAll('.ci-file-list__row--dimmed').length).toBe(9);
  },

  'the search field has a nonempty query': async (world) => {
    const harness = ui(world);
    await typeQuery(harness, 'file-1');
    expect(harness.store.query).toBe('file-1');
    markBaseline(world);
  },

  'I press Escape in the search field': async (world) => {
    const harness = ui(world);
    const input = searchInput(harness);
    input.focus();
    pressKey(input, 'Escape');
    await nextTick();
  },

  'only the query clears': (world) => {
    const harness = ui(world);
    expect(harness.store.query).toBe('');
    expect(searchInput(harness).value).toBe('');
    expect(harness.store.matchingIds).toBeNull();
    // Focus is left exactly where it was -- Escape never blurs the field.
    expect(document.activeElement).toBe(searchInput(harness));
  },

  'the selected file and camera remain unchanged': (world) => {
    const before = take<Baseline>(world, 'baseline');
    expect(ui(world).store.selectedEntityId).toBe(before.selectedEntityId);
    expectCameraUnchanged(world);
  },

  'a Markdown note editor is visible beside it': (world) => {
    // OUTSIDE `.codebase-inspector-root`: a sibling leaf in the same workspace, which
    // is what makes "this view owns focus" a real question rather than a formality.
    const note = document.body.createEl('textarea');
    note.setAttribute('aria-label', 'Markdown note');
    put(world, 'note', note);
    markBaseline(world);
  },

  'I type a slash and press Escape in the note editor': async (world) => {
    const note = take<HTMLTextAreaElement>(world, 'note');
    note.focus();
    note.value = '/';
    note.dispatchEvent(new Event('input', { bubbles: true }));
    pressKey(note, '/');
    pressKey(note, 'Escape');
    await nextTick();
  },

  'the plugin query, selection, and camera do not change': (world) => {
    const before = take<Baseline>(world, 'baseline');
    const harness = ui(world);
    expect(harness.store.query).toBe(before.query);
    expect(harness.store.selectedEntityId).toBe(before.selectedEntityId);
    expect(searchInput(harness).value).toBe(before.query);
    expectCameraUnchanged(world);
  },

  'focus stays in the note editor': (world) => {
    expect(document.activeElement).toBe(take<HTMLTextAreaElement>(world, 'note'));
  },

  'a nondefault 3D camera bookmark': async (world) => {
    const harness = ui(world);
    harness.emit({ type: 'camera-changed', camera: MOVED_3D_CAMERA });
    await nextTick();
    expect(harness.store.camera).toEqual(MOVED_3D_CAMERA);
  },

  'I switch to top view and pan': async (world) => {
    const harness = ui(world);
    await clickReal(buttonNamed(harness, 'Top'));
    expect(harness.renderer?.calls.setCameraMode).toHaveBeenCalledWith('top');
    expect(harness.store.viewMode).toBe('top');
    await clickReal(buttonNamed(harness, 'Pan left'));
    expect(harness.renderer?.calls.nudgeCamera).toHaveBeenCalled();
    // The rig commits the pan and reports it back; the store must now hold a TOP
    // bookmark, so "restored" below cannot pass by nothing having happened.
    harness.emit({
      type: 'camera-changed',
      camera: { ...MOVED_3D_CAMERA, mode: 'top', zoom: 9.5, target: [99, 0, 99] },
    });
    await nextTick();
    expect(harness.store.camera?.mode).toBe('top');
  },

  'I return to 3D': async (world) => {
    const harness = ui(world);
    await clickReal(buttonNamed(harness, 'Return to 3D view'));
  },

  'the saved 3D bookmark is restored': (world) => {
    const harness = ui(world);
    // Two independent halves: the port is commanded back into '3d' (camera-rig.ts
    // restores its own `saved3d` IN FULL on that call), and the VIEW's own retained
    // bookmark -- the one persisted into workspace.json -- comes back exactly.
    expect(harness.renderer?.calls.setCameraMode).toHaveBeenLastCalledWith('3d');
    expect(harness.store.viewMode).toBe('3d');
    expect(harness.store.camera).toEqual(MOVED_3D_CAMERA);
  },

  // Review M1: this scenario used to build a bare <canvas> of its own and assert only
  // that `onPick` was not called -- so it never mounted anything, its Given described an
  // implementation rather than a user's situation, and its Then had drifted off the
  // original's "does not select another file". It now starts from a REAL selection in a
  // REAL mounted city, and the canvas is a real child of the real stage element, wired
  // exactly as city-renderer.ts wires it: a pick SELECTS through the store and an orbit
  // COMMITS a camera, so "did not select" and "the camera changed" are statements about
  // the same state a user sees, not about spy call counts.
  //
  // `createPicking` is still called directly, and that is the point rather than a
  // shortcut: the 5 CSS px threshold under test lives in `picking.ts`, the renderer
  // double has no canvas of its own, and defect 9 taught this branch that an engagement
  // gate between the canvas and picking is exactly where a dead surface hides -- so
  // `isActive` here is a REAL condition (the view is in a spatial mode), not a hardcoded
  // true.
  'I drag the canvas beyond the click threshold': (world) => {
    const harness = ui(world);
    const canvas = harness.stage.createEl('canvas');
    canvas.getBoundingClientRect = () => ({
      width: 400, height: 300, top: 0, left: 0, right: 400, bottom: 300, x: 0, y: 0, toJSON: () => ({}),
    });
    const other = fileRows(harness)[4]!;
    const onPick = vi.fn((entityId: string) => { harness.store.select(entityId); });
    const picking = createPicking({
      win: window,
      canvas,
      // ALWAYS a hit, and a hit on a DIFFERENT file than the selected one: a hitTest
      // that returned null would make "did not select another file" pass vacuously.
      hitTest: () => harness.snapshot.entities.find((e) => e.path === other.textContent.trim())!.id,
      onPick,
      onHover: () => {},
      onOrbit: () => {
        harness.emit({ type: 'camera-changed', camera: { ...MOVED_3D_CAMERA, zoom: 4.25 } });
      },
      onPan: () => {},
      onZoom: () => {},
      isActive: () => harness.store.viewMode !== 'list',
    });
    world.cleanups.push(() => { picking.dispose(); canvas.remove(); });
    put(world, 'onPick', onPick);

    const at = (type: string, x: number, y: number): void => {
      canvas.dispatchEvent(new MouseEvent(type, { clientX: x, clientY: y, button: 0, bubbles: true }));
    };
    at('pointerdown', 100, 100);
    at('pointermove', 118, 104);   // 18 px: well past DRAG_THRESHOLD_CSS_PX (5)
    at('pointermove', 140, 112);
    at('pointerup', 140, 112);
  },

  'the camera changes': (world) => {
    const before = take<Baseline>(world, 'baseline');
    const harness = ui(world);
    expect(harness.store.camera).not.toEqual(before.camera);
    expect(harness.store.camera?.zoom).toBe(4.25);
  },

  'releasing the pointer does not select another file': (world) => {
    const harness = ui(world);
    // The ORIGINAL scenario's own Then: the selection is what it was, not merely that a
    // spy went uncalled.
    expect(harness.store.selectedEntityId).toBe(take<string>(world, 'selectedId'));
    expect(harness.container.querySelectorAll('.ci-file-list__row--selected')).toHaveLength(1);
    expect(take<ReturnType<typeof vi.fn>>(world, 'onPick')).not.toHaveBeenCalled();
  },
};
