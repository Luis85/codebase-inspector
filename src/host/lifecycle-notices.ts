// Split out of city-view.ts (task 9 fix round 1, item 1's store wiring pushed that
// file over the 400-line budget) purely for size, by responsibility — no logic
// changed, only moved. This is the orchestration for "what does one run-lifecycle
// transition mean for the store, the renderer and the user-facing notices",
// leaving city-view.ts with just the host-specific plumbing (Vue mounting,
// renderer construction, sizing) that only IT can do.
import { CANCELLED_BANNER } from '../application/run-state';
import type { ScanLifecycleState } from '../application/run-state';
import type { SnapshotStore } from '../application/ports/snapshot-store';
import type { CodebaseSnapshot } from '../domain/model';

/** The "Your complete snapshot from {time} is unchanged" half of COPY-10, or ''
 *  when there is no retained snapshot to name (a cancelled/failed FIRST scan).
 *
 *  Fix round 1, Important 1: `lifecycle.publishedSnapshotId` is the COORDINATOR's
 *  own record, set only by a SCAN_COMPLETED this exact coordinator instance
 *  dispatched. `ScanCoordinator` is per-CityView (Fact F), so after a view is
 *  closed and re-created (or popped out) with a snapshot already restored via
 *  setState, a fresh coordinator's `publishedSnapshotId` is null even though the
 *  shared, in-memory SnapshotStore still holds — and this view is still SHOWING —
 *  a complete snapshot. Falling back to `fallbackSnapshotId` (the CALLER's own
 *  persisted identifier, restored by setState/onOpen regardless of which
 *  coordinator instance produced it) is what keeps this sentence appearing after
 *  that re-creation, which is exactly the checkpoint #2 line this covers. */
function retainedSnapshotSuffix(
  lifecycle: ScanLifecycleState,
  snapshotStore: SnapshotStore,
  fallbackSnapshotId: string | null,
): string {
  const snapshotId = lifecycle.publishedSnapshotId ?? fallbackSnapshotId;
  const previous = snapshotId ? snapshotStore.get(snapshotId) : null;
  if (!previous) return '';
  const time = new Date(previous.providerRun.capturedAt).toLocaleTimeString();
  return ` Your complete snapshot from ${time} is unchanged.`;
}

export interface LifecycleNoticeCallbacks {
  /** Fire-and-forget from this function's own perspective — the caller (CityView)
   *  owns whatever async/error handling `publishLayout` itself needs. */
  publishLayout(snapshot: CodebaseSnapshot): void;
  showNotice(message: string): void;
}

/** Structural, not `ReturnType<typeof useRunStore>`, so this file does not need to
 *  import the store's own defineStore machinery just to name a one-method shape. */
export interface LifecycleRunStore {
  setLifecycle(lifecycle: ScanLifecycleState): void;
}

/** Reacts to every run-lifecycle transition (spec 7). Mirrors EVERY transition
 *  into `runStore` first, unconditionally (task 9 fix round 1, item 1, ruling M66)
 *  — the one production caller `setLifecycle` had none of before, and the reason
 *  `AnnouncementRegion`/`StatusBanner` could never show progress, cancellation or
 *  failure. A completed run returns the view's own new identifiers (profileId,
 *  snapshotId) for the caller to persist and publishes the new layout; a
 *  cancelled or failed run publishes NOTHING and only ever surfaces a message —
 *  returns null, so the caller's own `state.snapshotId` is untouched by either.
 *
 *  Task 8's own progress `Notice` stopgap (formerly here, `formatProgressMessage`)
 *  is REMOVED, not merely left alongside: `StatusBanner.vue` now renders the
 *  identical COPY-08 text, visibly, inside the view itself, driven by this same
 *  `runStore.setLifecycle` call — keeping both would be two visible progress
 *  surfaces updating on every PROGRESS tick, which is exactly the "racing"
 *  outcome the fix brief warned against. The cancelled/failed one-shot `Notice`
 *  toasts are NOT removed: a transient toast for a terminal event is not "racing"
 *  a persistent banner the way a second progress meter would be, and no finding
 *  named them. */
export function reactToLifecycleChange(
  lifecycle: ScanLifecycleState,
  snapshotStore: SnapshotStore,
  currentSnapshotId: string | null,
  runStore: LifecycleRunStore | null,
  callbacks: LifecycleNoticeCallbacks,
): { profileId: string; snapshotId: string } | null {
  runStore?.setLifecycle(lifecycle);
  const run = lifecycle.run;
  if (run.status === 'running') return null;

  if (run.status === 'complete') {
    const snapshot = lifecycle.publishedSnapshotId ? snapshotStore.get(lifecycle.publishedSnapshotId) : null;
    if (!snapshot) return null;
    callbacks.publishLayout(snapshot);
    return { profileId: snapshot.repositoryId, snapshotId: snapshot.snapshotId };
  }
  if (run.status === 'cancelled') {
    callbacks.showNotice(`${CANCELLED_BANNER}${retainedSnapshotSuffix(lifecycle, snapshotStore, currentSnapshotId)}`);
    return null;
  }
  if (run.status === 'failed') {
    const base = lifecycle.banner ?? 'Scan failed.';
    callbacks.showNotice(`${base}${retainedSnapshotSuffix(lifecycle, snapshotStore, currentSnapshotId)}`);
  }
  return null;
}
