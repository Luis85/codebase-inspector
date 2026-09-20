// Step definitions for the scenarios a USER performs in the view: selection, the
// inspector, search, Escape, the camera controls, pointer gestures, the consent modal's
// focus return, the no-renderer fallback and the clipboard fallback.
//
// Every "When" below goes through the DOM -- a click on a real button, a real `input`
// event, a real `keydown`, a real pointer gesture -- never a store action standing in
// for one (task-12-context.md §0).
import { expect, vi } from 'vitest';
import { nextTick } from 'vue';
import type { App } from 'obsidian';
import {
  MOVED_3D_CAMERA, buttonNamed, clickReal, fileRows, mountCity, pressKey, put, searchInput,
  take, typeQuery, ui,
} from '../world';
import type { StepTable } from '../feature-runner';
import type { World } from '../world';
import { useRunStore } from '../../../src/ui/stores/run-store';
import { createPicking } from '../../../src/visualization/picking';
import { openScopeModal } from '../../../src/host/modals/scope-modal';
import { COPY_14, COPY_27, COPY_30, formatCopy11 } from '../../../src/ui/copy';
import type { CameraBookmark, CodebaseProfile } from '../../../src/domain/model';

/** What `setLayout`'s own auto-fit commits on a fresh renderer, mirrored back out as
 *  `camera-changed` exactly as city-renderer.ts does. Every scenario therefore starts
 *  with a REAL camera bookmark, so "unchanged" is never trivially "still null". */
const FIT_CAMERA: CameraBookmark = {
  projection: 'orthographic', mode: '3d',
  position: [20, 20, 20], target: [0, 0, 0], up: [0, 1, 0], zoom: 1,
};

interface Baseline {
  camera: CameraBookmark | null;
  query: string;
  selectedEntityId: string | null;
  snapshotId: string;
  lots: string;
}

function baselineOf(world: World): Baseline {
  const harness = ui(world);
  return {
    camera: harness.store.camera ? { ...harness.store.camera } : null,
    query: harness.store.query,
    selectedEntityId: harness.store.selectedEntityId,
    snapshotId: harness.store.snapshot!.snapshotId,
    lots: JSON.stringify(harness.layout.lots.map((lot) => lot.center)),
  };
}

function markBaseline(world: World): void {
  put(world, 'baseline', baselineOf(world));
}

function expectCameraUnchanged(world: World): void {
  const before = take<Baseline>(world, 'baseline');
  const harness = ui(world);
  expect(harness.store.camera).toEqual(before.camera);
  // Nothing COMMANDED the camera either: an unchanged bookmark that was moved and moved
  // back would satisfy the value check alone.
  expect(harness.renderer?.calls.setCamera).not.toHaveBeenCalled();
  expect(harness.renderer?.calls.nudgeCamera).not.toHaveBeenCalled();
  expect(harness.renderer?.calls.fit).not.toHaveBeenCalled();
}

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
    // COPY-30, the selection-outside-filter notice, AND COPY-11's own count, which is
    // what tells a reader the snapshot still holds the files the filter hid.
    expect(harness.container.querySelector('.ci-app__selection-notice')?.textContent).toContain(COPY_30);
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

  'a canvas with pointer intent wired to the real picking module': (world) => {
    const canvas = document.body.createEl('canvas');
    canvas.getBoundingClientRect = () => ({
      width: 400, height: 300, top: 0, left: 0, right: 400, bottom: 300, x: 0, y: 0, toJSON: () => ({}),
    });
    const onPick = vi.fn();
    const onOrbit = vi.fn();
    const picking = createPicking({
      win: window, canvas,
      hitTest: () => 'repo\u0000file\u0000src/a.ts',   // ALWAYS a hit: a miss would pass vacuously
      onPick, onHover: () => {}, onOrbit, onPan: () => {}, onZoom: () => {},
      isActive: () => true,
    });
    world.cleanups.push(() => { picking.dispose(); canvas.remove(); });
    put(world, 'canvas', canvas);
    put(world, 'onPick', onPick);
    put(world, 'onOrbit', onOrbit);
  },

  'I drag the canvas beyond the click threshold': (world) => {
    const canvas = take<HTMLCanvasElement>(world, 'canvas');
    const at = (type: string, x: number, y: number): void => {
      canvas.dispatchEvent(new MouseEvent(type, { clientX: x, clientY: y, button: 0, bubbles: true }));
    };
    at('pointerdown', 100, 100);
    at('pointermove', 118, 104);   // 18 px: well past DRAG_THRESHOLD_CSS_PX (5)
    at('pointermove', 140, 112);
    at('pointerup', 140, 112);
  },

  'the camera changes': (world) => {
    expect(take<ReturnType<typeof vi.fn>>(world, 'onOrbit')).toHaveBeenCalled();
  },

  'releasing the pointer does not select another file': (world) => {
    expect(take<ReturnType<typeof vi.fn>>(world, 'onPick')).not.toHaveBeenCalled();
  },

  'I opened scope review from the Scan action': async (world) => {
    const harness = ui(world);
    markBaseline(world);
    const scan = harness.container.createEl('button', { text: 'Scan codebase' });
    scan.setAttribute('aria-label', 'Scan codebase');
    put(world, 'scan-action', scan);
    const profile: CodebaseProfile = {
      profileId: 'p1', name: 'Alpha', bindingId: null,
      exclusions: ['.git', 'node_modules'], maxFileBytes: 1_000_000,
    };
    scan.focus();
    // The REAL modal, opened from a real control, with the real focus capture.
    put(world, 'scope-promise', openScopeModal({} as App, { profile, resolvedRoot: 'C:\\Projects\\alpha' }));
    await nextTick();
    expect(document.querySelector('.modal-container'), 'the scope modal did not open').not.toBeNull();
  },

  'I close the modal': async (world) => {
    const cancel = document.querySelector<HTMLButtonElement>('.modal-container [data-action="cancel"]');
    expect(cancel, 'the scope modal has no cancel control').not.toBeNull();
    cancel!.click();
    expect(await take<Promise<unknown>>(world, 'scope-promise')).toBeNull();
  },

  'focus returns to the Scan action': (world) => {
    expect(document.activeElement).toBe(take<HTMLElement>(world, 'scan-action'));
  },

  'the query, selection, and snapshot remain unchanged': (world) => {
    const before = take<Baseline>(world, 'baseline');
    const harness = ui(world);
    expect(harness.store.query).toBe(before.query);
    expect(harness.store.selectedEntityId).toBe(before.selectedEntityId);
    expect(harness.store.snapshot!.snapshotId).toBe(before.snapshotId);
  },

  'a snapshot with included files and exact measurements': async (world) => {
    const harness = await mountCity(world, { files: 6, directories: 2 });
    expect(harness.snapshot.observations.every((o) => o.status === 'measured')).toBe(true);
    expect(harness.renderer, 'no renderer was constructed to begin with').not.toBeNull();
  },

  'rendering becomes unavailable': async (world) => {
    const harness = ui(world);
    harness.emit({ type: 'unavailable', reason: 'unsupported' });
    await nextTick();
    await nextTick();
  },

  'I can inspect those files through the HTML inventory': async (world) => {
    const harness = ui(world);
    expect(harness.container.querySelector('.ci-viewport__notice')?.textContent).toContain(COPY_14);
    const rows = fileRows(harness);
    expect(rows.length).toBe(6);
    await clickReal(rows[2]!);
    const inspector = harness.container.querySelector('.ci-inspector');
    expect(inspector, 'the HTML inventory stopped working without a renderer').not.toBeNull();
    expect(inspector!.textContent).toMatch(/\d+ lines/);
    expect(inspector!.textContent).toMatch(/\d+ bytes/);
  },

  'no replacement scan starts automatically': (world) => {
    const harness = ui(world);
    // 'unsupported' is permanent for this platform/session: spec §4.2 says the view
    // does NOT self-heal from it, and nothing anywhere may take a renderer failure as
    // authorisation to re-enumerate the source.
    expect(useRunStore().run.status).toBe('idle');
    expect(harness.store.snapshot!.snapshotId).toBe(harness.snapshot.snapshotId);
  },

  'clipboard access is unavailable': (world) => {
    // The REAL seam `useClipboard()` resolves through -- the stage element's own
    // window's `navigator.clipboard` -- made to reject exactly as a denied permission
    // does. Not an injected double: this is the production path, refusing.
    const navigator = window.navigator as unknown as Record<string, unknown>;
    const previous = Object.getOwnPropertyDescriptor(window.navigator, 'clipboard');
    Object.defineProperty(window.navigator, 'clipboard', {
      configurable: true,
      value: { writeText: () => Promise.reject(new Error('clipboard permission denied')) },
    });
    world.cleanups.push(() => {
      if (previous) Object.defineProperty(window.navigator, 'clipboard', previous);
      else delete navigator.clipboard;
    });
  },

  'I copy its relative path': async (world) => {
    const harness = ui(world);
    await clickReal(buttonNamed(harness, 'Copy relative path'));
    await nextTick();
  },

  'the interface exposes selectable path text': (world) => {
    const harness = ui(world);
    const fallback = harness.container.querySelector<HTMLInputElement>('.ci-inspector__fallback input');
    expect(fallback, 'a failed copy left the user no way to get the path').not.toBeNull();
    expect(fallback!.readOnly).toBe(true);
    expect(fallback!.value).toBe(take<string>(world, 'entityId'));
  },

  'no success message is shown for a failed clipboard write': (world) => {
    const live = ui(world).container.querySelector('.ci-inspector__live');
    expect(live?.textContent?.trim()).toBe('');
    expect(live?.textContent ?? '').not.toContain(COPY_27);
  },
};
