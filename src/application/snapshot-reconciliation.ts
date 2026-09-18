// Task 11: per-leaf snapshot reconciliation (spec 4.2; spec 6's highest-value
// invariant list: "a removed selected file must be reported, never replaced by
// index"). Pure and synchronous — it authorises nothing (no scan, no coordinator
// call, no store write, no filesystem access) and touches no CityViewState field it
// is not explicitly documented to touch below.
//
// Matches by ENTITY IDENTITY (repositoryId + kind + POSIX root-relative path,
// NUL-joined — entity-id.ts, spec 4.1), never by array position. A rescan's
// `entities` array carries no ordering guarantee at all (a different walk order, a
// different sort upstream, entities inserted or removed anywhere) — an index-based
// lookup would silently re-select whatever entity now happens to occupy the OLD
// selection's array slot. That failure looks completely plausible on screen (a file
// IS still selected, a name IS still shown) and is simply wrong.
import type { CityViewState, CodebaseSnapshot } from '../domain/model';

/** Exported so a caller building its own copy of the sentence (a Notice, a toast,
 *  an announcement region) cannot drift from the substring every reconciliation
 *  test greps for. */
export const SELECTION_REMOVED_NOTICE = 'The selected file is no longer in this snapshot and has been deselected.';

export interface ReconciliationResult {
  state: CityViewState;
  notice: string | null;
}

/** Reconciles `previous` (this leaf's own current view state — never a persisted or
 *  restored copy the caller has not kept live) against `next` (a snapshot that has
 *  just replaced whatever this leaf was showing, for the SAME profile).
 *
 *  Only `selectedEntityId` is inspected, and only it (plus `inspectorOpen`, which
 *  city-store.ts's own `clearSelection` clears in lockstep for exactly the same
 *  reason: an inspector open on nothing selected is not a state this app ever
 *  otherwise reaches) is ever changed. `query`, `camera`, `previous3dCamera`,
 *  `viewMode`, `profileId` and `snapshotId` are returned byte-for-byte unchanged —
 *  reconciliation is a narrow correction, never a reset. No selection at all is a
 *  no-op: there is nothing to lose. */
export function reconcileSelection(previous: CityViewState, next: CodebaseSnapshot): ReconciliationResult {
  if (previous.selectedEntityId === null) return { state: previous, notice: null };
  const stillExists = next.entities.some((entity) => entity.id === previous.selectedEntityId);
  if (stillExists) return { state: previous, notice: null };
  return {
    state: { ...previous, selectedEntityId: null, inspectorOpen: false },
    notice: SELECTION_REMOVED_NOTICE,
  };
}
