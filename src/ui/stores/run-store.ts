// Mirrors ScanCoordinator's ScanLifecycleState (spec 4.1's InventoryRunState plus
// task 8's own banner/publishedSnapshotId) into a Pinia store, so the Vue tree has a
// reactive read of scan progress without holding a reference to the coordinator
// itself. This store never starts, cancels or otherwise drives a scan — it is a pure
// mirror; CityView (unmodified this task) is what subscribes to the real
// ScanCoordinator and calls `setLifecycle` on whatever transition it observes.
//
// Ruling M35 (task-9-context.md §3): ScanLifecycleState's own `selectedEntityId`/
// `query` fields are inert in run-state.ts (no action sets them) and are NOT the
// source of truth this store's consumers should read for inspection context — that
// is city-store.ts's `selectedEntityId`/`query`. They are still mirrored here
// verbatim (never dropped, never re-derived) so a future task wiring the two
// together has a faithful reflection of the reducer's own output to compare against.
import { defineStore } from 'pinia';
import type { ScanLifecycleState } from '../../application/run-state';
import { initialScanLifecycleState } from '../../application/run-state';

export const useRunStore = defineStore('city-run', {
  state: (): ScanLifecycleState => initialScanLifecycleState(),
  actions: {
    /** Replaces the mirrored lifecycle wholesale. Never mutates the object handed
     *  in — Pinia's own `$patch`-free whole-state replacement copies each field by
     *  value, so the caller's own `lifecycle` object is left untouched. */
    setLifecycle(lifecycle: ScanLifecycleState): void {
      this.run = lifecycle.run;
      this.approval = lifecycle.approval;
      this.generation = lifecycle.generation;
      this.publishedSnapshotId = lifecycle.publishedSnapshotId;
      this.banner = lifecycle.banner;
      this.selectedEntityId = lifecycle.selectedEntityId;
      this.query = lifecycle.query;
    },
  },
});
