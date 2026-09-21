// Task 11 fix round 1, item 1 (Important). `CityViewState` was never synchronised
// with the live UI in either direction: nothing wrote the live store back into it,
// and nothing seeded the store FROM it on restore. Pure logic against a structural
// double — no DOM, no Pinia, no Obsidian — so this lives under the 'node' project.
import { describe, expect, it, vi } from 'vitest';
import { pickUiState, seedStoreFromState } from '../../src/host/view-state-sync';
import { defaultCityViewState } from '../../src/host/view-state';
import { makeEntityId } from '../../src/domain/entity-id';
import type { ViewStateSyncTarget } from '../../src/host/view-state-sync';
import type { CameraBookmark, CityViewState } from '../../src/domain/model';
import type { RouteId } from '../../src/domain/route-ids';

const CAMERA_3D: CameraBookmark = {
  projection: 'orthographic', mode: '3d', position: [1, 2, 3], target: [0, 0, 0], up: [0, 1, 0], zoom: 1.5,
};
const CAMERA_TOP: CameraBookmark = {
  projection: 'orthographic', mode: 'top', position: [0, 9, 0], target: [0, 0, 0], up: [0, 0, -1], zoom: 2,
};

/** A real (if minimal) implementation of the store's own camera-ownership rule --
 *  `setCamera` only overwrites `previous3dCamera` when the incoming bookmark's own
 *  mode is '3d' -- copied from city-store.ts's own action, because the fix this
 *  guards depends on exactly that rule, not a stand-in that trivially always wins. */
function makeStoreDouble(): ViewStateSyncTarget & { selectSpy: ReturnType<typeof vi.fn> } {
  let selectedEntityId: string | null = null;
  let query = '';
  let viewMode: '3d' | 'top' | 'list' = '3d';
  let camera: CameraBookmark | null = null;
  let previous3dCamera: CameraBookmark | null = null;
  let inspectorOpen = false;
  let route: RouteId = 'city';
  const selectSpy = vi.fn((id: string) => { selectedEntityId = id; });
  return {
    get selectedEntityId() { return selectedEntityId; },
    get query() { return query; },
    get viewMode() { return viewMode; },
    get camera() { return camera; },
    get previous3dCamera() { return previous3dCamera; },
    get inspectorOpen() { return inspectorOpen; },
    get route() { return route; },
    select: selectSpy,
    setQuery: (q: string) => { query = q; },
    setCamera: (next: CameraBookmark) => {
      camera = next;
      if (next.mode === '3d') previous3dCamera = next;
    },
    setViewMode: (mode) => { viewMode = mode; },
    openInspector: () => { if (selectedEntityId) inspectorOpen = true; },
    navigate: vi.fn((r: RouteId) => { route = r; }),
    selectSpy,
  };
}

describe('pickUiState', () => {
  it('reads exactly the six UI-facing fields off the store', () => {
    const store = makeStoreDouble();
    store.setCamera(CAMERA_3D);
    store.select(makeEntityId('p1', 'file', 'a.ts'));
    store.setQuery('needle');
    const picked = pickUiState(store);
    expect(picked).toEqual({
      selectedEntityId: makeEntityId('p1', 'file', 'a.ts'),
      query: 'needle',
      viewMode: '3d',
      camera: CAMERA_3D,
      previous3dCamera: CAMERA_3D,
      inspectorOpen: false,
      route: 'city',
    });
  });
});

describe('seedStoreFromState', () => {
  it('restores selection, query, view mode and inspector state', () => {
    const store = makeStoreDouble();
    const state: CityViewState = {
      ...defaultCityViewState(),
      selectedEntityId: makeEntityId('p1', 'file', 'a.ts'),
      query: 'needle',
      viewMode: 'top',
      camera: CAMERA_TOP,
      inspectorOpen: true,
    };
    seedStoreFromState(store, state);
    expect(store.selectSpy).toHaveBeenCalledWith(makeEntityId('p1', 'file', 'a.ts'));
    expect(store.query).toBe('needle');
    expect(store.viewMode).toBe('top');
    expect(store.inspectorOpen).toBe(true);
  });

  it('restores BOTH camera and previous3dCamera exactly, even when they differ', () => {
    // The reachable case a single setCamera call cannot produce: saved while in
    // 'top' mode, with a DIFFERENT retained 3D bookmark from earlier in the
    // session -- exactly what spec 4.1 calls previous3dCamera load-bearing for.
    const store = makeStoreDouble();
    const state: CityViewState = {
      ...defaultCityViewState(), viewMode: 'top', camera: CAMERA_TOP, previous3dCamera: CAMERA_3D,
    };
    seedStoreFromState(store, state);
    expect(store.camera).toEqual(CAMERA_TOP);
    expect(store.previous3dCamera).toEqual(CAMERA_3D);
  });

  it('never opens the inspector without a selection', () => {
    const store = makeStoreDouble();
    const state: CityViewState = { ...defaultCityViewState(), inspectorOpen: true, selectedEntityId: null };
    seedStoreFromState(store, state);
    expect(store.inspectorOpen).toBe(false);
  });

  it('is a no-op for a state with nothing to restore beyond the view mode', () => {
    const store = makeStoreDouble();
    seedStoreFromState(store, defaultCityViewState());
    expect(store.selectSpy).not.toHaveBeenCalled();
    expect(store.camera).toBeNull();
    expect(store.query).toBe('');
  });
});
