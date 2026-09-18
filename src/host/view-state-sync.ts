// Task 11 fix round 1, item 1 (Important): `CityViewState` was never synchronised
// with the live UI in EITHER direction — nothing wrote the live store back into it
// (so `getState()`/`workspace.json` never captured a selection, query, camera or
// view-mode change made without a rescan), and nothing seeded the store FROM a
// restored `CityViewState` either (so even a correctly persisted camera was never
// applied — `store.camera` stayed `null` after a reload and the first `setLayout`
// always auto-fit). Spec §5 line 791 names "workspace state" as this task's own;
// spec §4.2 says outright that the view "mirrors [camera-changed] into
// CityViewState for persistence"; spec §4.1 calls `previous3dCamera` load-bearing
// for exactly the round trip this file restores.
//
// A narrow structural interface, never `ReturnType<typeof useCityStore>` — this
// file does not need Pinia's own `defineStore` machinery to name the six fields
// and five actions it actually touches (the same reasoning lifecycle-notices.ts's
// own `LifecycleRunStore` interface already gives for the identical choice).
import type { EntityId } from '../domain/entity-id';
import type { CameraBookmark, CityViewState } from '../domain/model';

export interface ViewStateSyncTarget {
  readonly selectedEntityId: EntityId | null;
  readonly query: string;
  readonly viewMode: '3d' | 'top' | 'list';
  readonly camera: CameraBookmark | null;
  readonly previous3dCamera: CameraBookmark | null;
  readonly inspectorOpen: boolean;
  select(entityId: EntityId): void;
  setQuery(query: string): void;
  setCamera(camera: CameraBookmark): void;
  setViewMode(mode: '3d' | 'top' | 'list'): void;
  openInspector(): void;
}

type UiSlice = Pick<CityViewState,
  'selectedEntityId' | 'query' | 'viewMode' | 'camera' | 'previous3dCamera' | 'inspectorOpen'>;

/** Reads the six UI-facing fields off the live store — the exact slice `city-view.ts`
 *  watches to keep `this.state` (and therefore `getState()`) current. A plain
 *  function, not a class method, so it is trivially unit-testable against the
 *  structural interface above. */
export function pickUiState(store: ViewStateSyncTarget): UiSlice {
  return {
    selectedEntityId: store.selectedEntityId,
    query: store.query,
    viewMode: store.viewMode,
    camera: store.camera,
    previous3dCamera: store.previous3dCamera,
    inspectorOpen: store.inspectorOpen,
  };
}

/** Pushes a RESTORED `CityViewState` into the live store, once, after either onOpen
 *  or a late `setState` delivers it (spec 11's open question: ordering between the
 *  two is not guaranteed, so `city-view.ts` calls this from both places and it must
 *  be idempotent). `camera` and `previous3dCamera` are restored through TWO calls to
 *  the store's own `setCamera` action, never a new setter: `setCamera` only updates
 *  `previous3dCamera` when the bookmark's own mode is '3d' (city-store.ts), so
 *  seeding `previous3dCamera` FIRST and `camera` SECOND reconstructs both fields
 *  exactly, even when they differ (e.g. restored in 'top' mode with a distinct
 *  retained 3D bookmark) — without adding a raw setter the live UI could also
 *  reach and that spec 4.2's "the bookmark wins" rule does not otherwise allow. */
export function seedStoreFromState(store: ViewStateSyncTarget, state: CityViewState): void {
  if (state.previous3dCamera) store.setCamera(state.previous3dCamera);
  if (state.camera) store.setCamera(state.camera);
  if (state.selectedEntityId) store.select(state.selectedEntityId);
  if (state.query) store.setQuery(state.query);
  store.setViewMode(state.viewMode);
  if (state.inspectorOpen && state.selectedEntityId) store.openInspector();
}
