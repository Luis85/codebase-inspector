// WP-02 Part 5 (V1): the scan lifecycle, cut out of city-view.ts (399/400) with no behaviour
// change. One controller, and so one ScanCoordinator, per CityView (leaf-registry.ts: the
// coordinator is per view). CityView keeps `startScan`, `selectCodebase`, `cancelScan` and
// `isScanRunning` as one-line delegations, so commands.ts, the acceptance steps and every
// host test stay untouched. `provideScanCallbacks` is the one place the Vue tree's scan
// callbacks are provided.
import type { Plugin } from 'obsidian';
import type { App as VueApp } from 'vue';
import { ScanCoordinator, createCancellationToken } from '../application/scan-coordinator';
import { resolveOrCreateProfile, runInitialScan, runRefresh } from './scan-flow';
import { validationFailureText } from '../domain/validator';
import type { ScanLifecycleState } from '../application/run-state';
import type { CityViewState, CodebaseProfile } from '../domain/model';
import type { ProfileStore } from '../application/ports/profile-store';
import type { SourceFileSystemPort } from '../application/ports/source-filesystem-port';
import type { SnapshotStore } from '../application/ports/snapshot-store';
import type { Clock } from '../application/ports/clock';
import type { ReviewRepository } from '../ui/stores/ports/review-repository';

/** Task 8: what a CityView needs to run a scan, beyond the plain `Plugin` reference. All
 *  of them are plugin-level singletons (main.ts constructs one of each and passes the same
 *  instances to every CityView); `getFilesystem` stays a LAZY factory (task 7's pattern),
 *  so the real Node-backed port is never built earlier than a view that might use it. */
export interface CityViewDeps {
  profileStore: ProfileStore;
  getFilesystem: () => SourceFileSystemPort;
  snapshotStore: SnapshotStore;
  clock: Clock;
  /** Part 6 Y11: the plugin's review repository registry (`registry.for`), one repository
   *  per codebase shared by every leaf. `wireDataPorts` hands it to the review store. */
  reviewRepositoryFor: (repositoryId: string) => ReviewRepository;
}

/** What the controller reads from, and reports to, the CityView that owns it. */
export interface ScanViewBridge {
  /** The view's persisted identifiers, read at call time: the view replaces its state
   *  object on every change, so a captured copy would go stale. */
  viewState: () => Pick<CityViewState, 'profileId' | 'snapshotId'>;
  showNotice: (message: string) => void;
}

export class CityScanController {
  private readonly plugin: Plugin;
  private readonly deps: CityViewDeps;
  private readonly view: ScanViewBridge;
  private readonly coordinator: ScanCoordinator;
  // Fix round 1, Minor 6: `coordinator.state.status` alone does not guard the WHOLE of
  // startScan() -- it stays 'idle' until AFTER both consent modals resolve, so two fast
  // clicks (or two scan-codebase invocations) both pass that check, both resolve/create
  // a profile, and both open a modal. This flag closes the gap for the async method
  // itself, independent of the coordinator's own state.
  private startingScan = false;

  constructor(plugin: Plugin, deps: CityViewDeps, view: ScanViewBridge) {
    this.plugin = plugin;
    this.deps = deps;
    this.view = view;
    this.coordinator = new ScanCoordinator({
      port: deps.getFilesystem(), store: deps.snapshotStore, clock: deps.clock, createCancellationToken,
    });
  }

  /** `scan-codebase`'s own behaviour (spec 5: "scan-codebase doubles as refresh") --
   *  refreshes silently against the stored scope when a snapshot already exists, else
   *  runs the full consent chain. A no-op while a run is already in flight, never
   *  throws. Ruling M46: deliberately distinct from `selectCodebase()` (which the
   *  welcome shell's button calls and ALWAYS opens the modal) -- two names make the
   *  intention explicit at every call site rather than a boolean a caller could pick wrong. */
  async startScan(): Promise<void> {
    await this.withScanGuard(async (profile) => {
      const snapshotId = this.view.viewState().snapshotId;
      if (snapshotId) {
        const existing = this.deps.snapshotStore.get(snapshotId);
        if (existing) {
          await runRefresh(this.plugin.app, this.coordinator, profile, existing.scope, this.deps.clock, this.deps.profileStore);
          return;
        }
        // The in-memory store no longer has this id (e.g. the plugin reloaded) --
        // fall through to a full consent chain rather than "refreshing" against nothing.
      }
      await runInitialScan(this.plugin.app, this.coordinator, profile, this.deps.getFilesystem(), this.deps.profileStore);
    });
  }

  /** Ruling M46: "Select a codebase" (COPY-02) ALWAYS opens the source modal and runs the
   *  full consent chain, whether or not a snapshot already exists — re-selecting a
   *  different codebase must stay reachable. */
  async selectCodebase(): Promise<void> {
    await this.withScanGuard((profile) => (
      runInitialScan(this.plugin.app, this.coordinator, profile, this.deps.getFilesystem(), this.deps.profileStore)
    ));
  }

  /** `cancel-scan`'s callback body. Its checkCallback (commands.ts) already refuses to
   *  invoke this unless a run is running (ruling M36), but this stays defensive on its
   *  own -- cancel() itself is a no-op for a stale/unknown runId regardless. */
  cancelScan(): void {
    const run = this.coordinator.state;
    if (run.status === 'running') this.coordinator.cancel(run.runId);
  }

  isScanRunning(): boolean {
    return this.coordinator.state.status === 'running';
  }

  /** Fix round 1, Important 2 (called from `CityView.onClose`): closing the tab mid-scan
   *  must not leave an unstoppable walk running with no UI (cancel-scan's checkCallback
   *  needs an active CityView, which is gone the instant onClose runs). Discarding the
   *  result after the fact is not the same as actually STOPPING the disk I/O. */
  cancelIfRunning(): void {
    if (this.coordinator.state.status === 'running') this.coordinator.cancel(this.coordinator.state.runId);
  }

  subscribe(listener: (lifecycle: ScanLifecycleState) => void): () => void {
    return this.coordinator.subscribe(listener);
  }

  /** Shared guard for both entry points: refuses to start while the coordinator is
   *  already running/cancelling OR another call is still resolving a profile/showing a
   *  modal (fix round 1, Minor 6 -- two fast clicks across EITHER method share one
   *  in-flight flag). Resolves the profile once, then hands it to `body`. */
  private async withScanGuard(body: (profile: CodebaseProfile) => Promise<void>): Promise<void> {
    if (this.startingScan) return;
    if (this.coordinator.state.status === 'running' || this.coordinator.state.status === 'cancelling') return;
    this.startingScan = true;
    try {
      const profile = await resolveOrCreateProfile(
        this.deps.profileStore, this.view.viewState().profileId, this.plugin.app.vault.configDir,
      );
      await body(profile);
    } catch (e) {
      // Fix wave item 1 (C1): the destination ruling M53's deliberate propagation never
      // had. Both entry points are `void view.startScan()`, so without this a rejection
      // -- a scope the store refuses, or PluginDataProfileStore.list() throwing on one
      // hand-edited record -- was an unhandled rejection in a console nobody opens.
      this.view.showNotice(validationFailureText(e));
    } finally {
      this.startingScan = false;
    }
  }
}

/** The scan callbacks the Vue tree injects (NoSnapshot and the welcome action, NavColumn,
 *  AppToolbar (Scan, Cancel scan), Data & scans), provided at the APP level before
 *  `mount()` (ruling M68's pattern: a component's own provide() only resolves for its
 *  descendants). Each calls the SAME method its command-palette twin calls, never the
 *  coordinator directly. */
export function provideScanCallbacks(app: VueApp, controller: CityScanController): void {
  app.provide('onSelectCodebase', () => { void controller.selectCodebase(); });
  // Task 5 (F7): the toolbar's Scan control, calling the SAME method the
  // 'scan-codebase' palette command calls.
  app.provide('onScanRequested', () => { void controller.startScan(); });
  // Part 5 V6: Cancel scan in the city toolbar and on Data & scans, calling the SAME method
  // the 'cancel-scan' command calls. cancelScan() is itself a no-op unless a run is running.
  app.provide('onCancelScan', () => { controller.cancelScan(); });
}
