// Split out of city-view.ts, task 11 fix round 1 item 0 (it and city-view.test.ts
// and tests/mocks/obsidian.ts were all at their max-lines cap). Also carries fix
// round 1, Minor 5: a SIBLING leaf's own snapshot and layout are untouched by
// reconciliation (multiple leaves stay independent, ruling M9) — so telling a
// sibling "the selected file is no longer in THIS snapshot" was untrue: that
// sibling's own list still shows the file, because its own snapshot never changed.
import { reconcileSelection } from '../application/snapshot-reconciliation';
import type { EntityId } from '../domain/entity-id';
import type { CityViewState, CodebaseSnapshot } from '../domain/model';

export const SIBLING_RECONCILIATION_NOTICE =
  'A newer scan of this codebase no longer contains the selected file.';

/** Structural, not `ReturnType<typeof useCityStore>` — see view-state-sync.ts's own
 *  comment for why. */
export interface ReconciliationStore {
  readonly selectedEntityId: EntityId | null;
  clearSelection(): void;
}

/** Called once per completed scan, for EVERY open CityView (leaf-registry.ts's
 *  `reconcileEveryView`) — including the view whose OWN coordinator produced
 *  `snapshot`, distinguished from a sibling's by comparing `state.snapshotId`
 *  (already updated to `snapshot.snapshotId` by the caller's own lifecycle merge,
 *  for the view that owns this scan, BEFORE this runs) against `snapshot.snapshotId`
 *  itself. A different profile is a no-op; this never touches this view's own
 *  snapshot/layout/camera/query, and never authorises a scan (spec 4.2). */
export function applyReconciliationTo(
  store: ReconciliationStore, state: CityViewState, snapshot: CodebaseSnapshot,
): { notice: string | null } {
  if (state.profileId !== snapshot.repositoryId) return { notice: null };
  const live: CityViewState = { ...state, selectedEntityId: store.selectedEntityId };
  const { notice } = reconcileSelection(live, snapshot);
  if (!notice) return { notice: null };
  store.clearSelection();
  const isOwnSnapshot = state.snapshotId === snapshot.snapshotId;
  return { notice: isOwnSnapshot ? notice : SIBLING_RECONCILIATION_NOTICE };
}
