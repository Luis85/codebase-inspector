// ItemView owning onOpen/onClose/getState/setState (task 3), plus the scan lifecycle
// wiring (task 8): the coordinator, the consent chain, progress/cancellation notices,
// and handing a completed snapshot's layout to the renderer. Task 9 replaces the
// welcome-shell UI with the real C01 shell; tasks 10-11 replace the renderer and add
// per-leaf snapshot reconciliation. This file's own responsibilities do not change.
//
// Host rules this file exists to satisfy (spec 4.4):
// - WebGL context creation happens in onOpen, never the constructor.
// - Vue mounts on this.contentEl (not containerEl.children[1]); each view creates its
//   OWN Pinia instance.
// - getState() returns identifiers and presentation state only; setState validates
//   through the same runtime validator as settings, because workspace.json is
//   user-editable.
// - No bare window/document/ResizeObserver: everything goes through contentEl.win.
// - Below the 320 CSS px hard floor, no WebGL context is created at all.
// - pause/resume invariant (spec 4.2): visibility NEVER authorises a scan -- nothing in
//   applyWidth/ensureRenderer below calls the coordinator at all.
import { ItemView, Notice } from 'obsidian';
import type { EventRef, Plugin, ViewStateResult, WorkspaceLeaf } from 'obsidian';
import { createApp, ref, type App as VueApp, type Ref } from 'vue';
import { createPinia, type Pinia } from 'pinia';
import RootComponent from '../ui/App.vue';
import { createCityRenderer } from '../visualization/city-renderer';
import { computeLayout } from '../domain/layout/layout';
import { ScanCoordinator, createCancellationToken, formatProgressMessage } from '../application/scan-coordinator';
import { CANCELLED_BANNER } from '../application/run-state';
import { resolveOrCreateProfile, runInitialScan, runRefresh } from './scan-flow';
import type { CityRendererEvent, CityRendererPort } from '../visualization/renderer-port';
import type { ScanLifecycleState } from '../application/run-state';
import type { CodebaseSnapshot, CityViewState, CodebaseProfile } from '../domain/model';
import type { ProfileStore } from '../application/ports/profile-store';
import type { SourceFileSystemPort } from '../application/ports/source-filesystem-port';
import type { SnapshotStore } from '../application/ports/snapshot-store';
import type { Clock } from '../application/ports/clock';
import { defaultCityViewState, decodeCityViewState } from './view-state';
import { readPalette } from './theme-bridge';

// lib.dom.d.ts declares ResizeObserver only as a bare global `var`, not as a member of
// `Window` (a lib.dom gap) — even though at runtime it is a real property of every
// window, including a popped-out one. This augmentation lets
// `containerEl.win.ResizeObserver` type-check, so this file can honour the
// cross-window rule (spec 4.4) instead of reaching for the bare global.
declare global {
  interface Window {
    ResizeObserver: typeof ResizeObserver;
  }
}

export const CITY_VIEW_TYPE = 'codebase-inspector-city';
const MIN_INLINE_SIZE = 320;   // spec 5.2 hard floor, CSS px, measured on the leaf

interface ExposedRoot {
  rendererHost: HTMLElement | null;
}

/** Task 8: what a CityView needs to run a scan, beyond the plain `Plugin` reference task
 *  3 already took. All four are plugin-level singletons (main.ts constructs one of
 *  each and passes the same instances to every CityView); `getFilesystem` stays a
 *  LAZY factory (task 7's own pattern, task-8-context.md section 3) so building the
 *  real Node-backed port never happens any earlier than a view that might actually use
 *  it being constructed. */
export interface CityViewDeps {
  profileStore: ProfileStore;
  getFilesystem: () => SourceFileSystemPort;
  snapshotStore: SnapshotStore;
  clock: Clock;
}

export class CityView extends ItemView {
  private readonly plugin: Plugin;
  private readonly deps: CityViewDeps;
  private readonly coordinator: ScanCoordinator;
  private vueApp: VueApp | null = null;
  private pinia: Pinia | null = null;
  private renderer: CityRendererPort | null = null;
  private rendererMountEl: HTMLElement | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private cssChangeRef: EventRef | null = null;
  private unsubscribeCoordinator: (() => void) | null = null;
  private state: CityViewState = defaultCityViewState();
  private progressNotice: Notice | null = null;
  // Fix round 1, Minor 6: `coordinator.state.status` alone does not guard the WHOLE of
  // startScan() -- it stays 'idle' until AFTER both consent modals resolve, so two fast
  // clicks (or two scan-codebase invocations) both pass that check, both resolve/create
  // a profile, and both open a modal. This flag closes the gap for the async method
  // itself, independent of the coordinator's own state.
  private startingScan = false;
  private layoutGeneration = 0;
  private layoutAbort: AbortController | null = null;
  // Owned here, injected into App.vue, so a resize-driven availability change never
  // requires remounting the welcome shell.
  private readonly rendererAvailable: Ref<boolean> = ref(false);

  constructor(leaf: WorkspaceLeaf, plugin: Plugin, deps: CityViewDeps) {
    super(leaf);
    this.plugin = plugin;
    this.deps = deps;
    this.coordinator = new ScanCoordinator({
      port: deps.getFilesystem(), store: deps.snapshotStore, clock: deps.clock, createCancellationToken,
    });
  }

  override getViewType(): string { return CITY_VIEW_TYPE; }
  override getDisplayText(): string { return 'Codebase city'; }
  override getIcon(): string { return 'building-2'; }

  /** `scan-codebase`'s own behaviour (spec 5: "scan-codebase doubles as refresh") --
   *  refreshes silently against the stored scope when a snapshot already exists, else
   *  runs the full consent chain. A no-op while a run is already in flight, never
   *  throws.
   *
   *  Ruling M46 (fix round 3, Important): this is now DELIBERATELY distinct from
   *  `selectCodebase()` below, which the welcome shell's "Select a codebase" button
   *  calls. Before this fix both were the same method, so once a snapshot existed the
   *  button silently re-ran the SAME scope with no modal — indistinguishable from doing
   *  nothing, and re-selecting a different codebase became unreachable. Spec §5's
   *  "doubles as refresh" attaches to the `scan-codebase` COMMAND specifically, not to
   *  COPY-02's source-selection action — they are two different user intentions task 8
   *  originally collapsed into one. Chose two separate methods over a boolean
   *  parameter: a `forceFullChain` flag would let a caller silently pick the wrong one
   *  by accident, where two names make the intention explicit at every call site
   *  (commands.ts vs. App.vue's injected callback). */
  async startScan(): Promise<void> {
    await this.withScanGuard(async (profile) => {
      if (this.state.snapshotId) {
        const existing = this.deps.snapshotStore.get(this.state.snapshotId);
        if (existing) {
          await runRefresh(this.coordinator, profile, existing.scope, this.deps.clock);
          return;
        }
        // The in-memory store no longer has this id (e.g. the plugin reloaded) --
        // fall through to a full consent chain rather than "refreshing" against nothing.
      }
      await runInitialScan(this.plugin.app, this.coordinator, profile, this.deps.getFilesystem());
    });
  }

  /** Ruling M46: "Select a codebase" (COPY-02, App.vue) ALWAYS opens the source modal
   *  and runs the full consent chain, whether or not a snapshot already exists —
   *  re-selecting a different codebase must stay reachable. See `startScan()`'s own
   *  comment for why this is a second method rather than a flag. */
  async selectCodebase(): Promise<void> {
    await this.withScanGuard((profile) => runInitialScan(this.plugin.app, this.coordinator, profile, this.deps.getFilesystem()));
  }

  /** Shared guard for both entry points above: refuses to start while `this.coordinator`
   *  is already running/cancelling OR another call is still resolving a profile/showing
   *  a modal (fix round 1, Minor 6 -- `coordinator.state.status` alone stays 'idle' for
   *  the whole time either modal is open, so two fast clicks across EITHER method must
   *  share one in-flight flag, not one per method). Resolves the profile once, then
   *  hands it to `body`. */
  private async withScanGuard(body: (profile: CodebaseProfile) => Promise<void>): Promise<void> {
    if (this.startingScan) return;
    if (this.coordinator.state.status === 'running' || this.coordinator.state.status === 'cancelling') return;
    this.startingScan = true;
    try {
      const profile = await resolveOrCreateProfile(
        this.deps.profileStore, this.state.profileId, this.plugin.app.vault.configDir,
      );
      await body(profile);
    } finally {
      this.startingScan = false;
    }
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

  override async onOpen(): Promise<void> {
    this.contentEl.classList.add('codebase-inspector-root');

    this.pinia = createPinia();
    // typescript-eslint's type-aware linting resolves a cross-file .vue import as an
    // untyped/error module (it has no Vue SFC language-service plugin, unlike vue-tsc,
    // which DOES type-check this correctly — see `npm run typecheck`). Real behaviour
    // is unaffected; this is a lint-tooling gap, not an unsafe value.
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument -- see comment above: vue-tsc, not eslint's type-aware linting, is the accurate check here
    this.vueApp = createApp(RootComponent);
    this.vueApp.provide('rendererAvailable', this.rendererAvailable);
    this.vueApp.provide('onSelectCodebase', () => { void this.selectCodebase(); });
    this.vueApp.use(this.pinia);
    const instance = this.vueApp.mount(this.contentEl) as unknown as ExposedRoot;
    this.rendererMountEl = instance.rendererHost;

    const win = this.contentEl.win;               // never a bare window
    this.resizeObserver = new win.ResizeObserver(() => { this.applyWidth(); });
    this.resizeObserver.observe(this.contentEl);
    this.applyWidth();      // decide once synchronously; the observer covers later drags

    this.cssChangeRef = this.plugin.app.workspace.on('css-change', () => {
      // Re-reads every cached colour. Never moves buildings, changes camera, or
      // clears state (spec 4.4).
      this.renderer?.setColors(readPalette(this.contentEl));
    });

    this.unsubscribeCoordinator = this.coordinator.subscribe((lifecycle) => { this.onLifecycleChange(lifecycle); });

    // Reopening shows retained in-memory state (spec 4.5): if a prior scan already
    // published a snapshot this view's own persisted state points at, render it again
    // without starting anything -- restoring a view never authorises a scan.
    if (this.state.snapshotId) {
      const existing = this.deps.snapshotStore.get(this.state.snapshotId);
      if (existing) void this.publishLayout(existing);
    }
  }

  override async onClose(): Promise<void> {
    // Fix round 1, Important 2: closing the tab mid-scan must not leave an unstoppable
    // walk running with no UI and no way to reach it (cancel-scan's checkCallback needs
    // an active CityView, which is gone the instant this runs). The result is discarded
    // either way once mayPublish sees a run this coordinator no longer tracks as
    // running, but that discarding-after-the-fact is not the same as actually STOPPING
    // the disk I/O, which real cancellation does.
    if (this.coordinator.state.status === 'running') this.coordinator.cancel(this.coordinator.state.runId);
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    if (this.cssChangeRef) {
      this.plugin.app.workspace.offref(this.cssChangeRef);
      this.cssChangeRef = null;
    }
    this.unsubscribeCoordinator?.();
    this.unsubscribeCoordinator = null;
    this.progressNotice?.hide();
    this.progressNotice = null;
    this.layoutAbort?.abort();
    this.teardownRenderer();
    this.vueApp?.unmount();
    this.vueApp = null;
    this.pinia = null;
    this.rendererMountEl = null;
  }

  override getState(): Record<string, unknown> {
    // Identifiers and presentation state only — never a snapshot, a resolved
    // absolute path, or scan authorisation (spec 4.4).
    return { ...this.state };
  }

  override async setState(state: unknown, _result: ViewStateResult): Promise<void> {
    // workspace.json is user-editable: validated through the same runtime validator
    // as settings. An invalid payload keeps whatever state this view already had,
    // never partially applying it. Independent of setState/onOpen ordering on
    // workspace restore (spec 11, open question) — this only ever touches `this.state`
    // and never reads anything onOpen sets up, so either order produces the same
    // result.
    this.state = decodeCityViewState(state, this.state);
  }

  /** Reacts to every run-lifecycle transition (spec 7). Progress gets one persistent,
   *  updated-in-place Notice (COPY-08, a plain count, never a percentage); every
   *  terminal transition dismisses it. A completed run updates this view's own
   *  identifiers and publishes the new layout; a cancelled or failed run publishes
   *  NOTHING and only ever surfaces a message -- `this.state.snapshotId` (and therefore
   *  the rendered city) is untouched by either. */
  private onLifecycleChange(lifecycle: ScanLifecycleState): void {
    const run = lifecycle.run;
    if (run.status === 'running') {
      const message = formatProgressMessage(run.processedFiles);
      if (this.progressNotice) this.progressNotice.setMessage(message);
      else this.progressNotice = new Notice(message, 0);
      return;
    }
    this.progressNotice?.hide();
    this.progressNotice = null;

    if (run.status === 'complete') {
      const snapshot = lifecycle.publishedSnapshotId ? this.deps.snapshotStore.get(lifecycle.publishedSnapshotId) : null;
      if (!snapshot) return;
      this.state = { ...this.state, profileId: snapshot.repositoryId, snapshotId: snapshot.snapshotId };
      void this.publishLayout(snapshot);
      return;
    }
    if (run.status === 'cancelled') {
      this.showNotice(`${CANCELLED_BANNER}${this.retainedSnapshotSuffix(lifecycle)}`);
      return;
    }
    if (run.status === 'failed') {
      const base = lifecycle.banner ?? 'Scan failed.';
      this.showNotice(`${base}${this.retainedSnapshotSuffix(lifecycle)}`);
    }
  }

  /** A one-shot Notice with Obsidian's own default auto-dismiss timer -- nothing here
   *  needs to retain the instance afterwards, unlike `progressNotice`, which is updated
   *  in place across several PROGRESS ticks. */
  private showNotice(message: string): void {
    const notice = new Notice(message, 6000);
    void notice;
  }

  /** The "Your complete snapshot from {time} is unchanged" half of COPY-10, or '' when
   *  there is no retained snapshot to name (a cancelled/failed FIRST scan).
   *
   *  Fix round 1, Important 1: `lifecycle.publishedSnapshotId` is the COORDINATOR's own
   *  record, set only by a SCAN_COMPLETED this exact coordinator instance dispatched.
   *  `ScanCoordinator` is per-CityView (Fact F), so after a view is closed and
   *  re-created (or popped out) with a snapshot already restored via setState, a fresh
   *  coordinator's `publishedSnapshotId` is null even though the shared, in-memory
   *  SnapshotStore still holds — and this view is still SHOWING — a complete snapshot.
   *  Falling back to `this.state.snapshotId` (this view's own persisted identifier,
   *  restored by setState/onOpen regardless of which coordinator instance produced it)
   *  is what keeps this sentence appearing after that re-creation, which is exactly the
   *  checkpoint #2 line this covers. */
  private retainedSnapshotSuffix(lifecycle: ScanLifecycleState): string {
    const snapshotId = lifecycle.publishedSnapshotId ?? this.state.snapshotId;
    const previous = snapshotId ? this.deps.snapshotStore.get(snapshotId) : null;
    if (!previous) return '';
    const time = new Date(previous.providerRun.capturedAt).toLocaleTimeString();
    return ` Your complete snapshot from ${time} is unchanged.`;
  }

  /** Obligation 7 (task-8 brief step 4): recomputes layout from the published snapshot
   *  and hands it to setLayout with {generation, signal}. `layoutGeneration` is a
   *  CityView-LOCAL monotonic counter, deliberately distinct from the scan run's own
   *  `generation` (ScanLifecycleState/RunIdentity) — spec 4.2 only requires SOME
   *  strictly-increasing per-call token so the renderer can discard a stale or
   *  superseded setLayout call; nothing requires it to be numerically the same value as
   *  the run that produced the snapshot, and a run generation is not even defined any
   *  more once a run reaches 'complete' (spec 4.1's frozen union drops it there). */
  private async publishLayout(snapshot: CodebaseSnapshot): Promise<void> {
    if (!this.renderer) return;
    // Fix round 1, Minor 8: this runs from `void this.publishLayout(...)` at every call
    // site, so an uncaught throw here would be an unhandled promise rejection, not a
    // catchable error anywhere. `setLayout` itself never rejects (spec 4.2), but
    // `computeLayout` is a plain function with no such contract -- catch it here, once,
    // rather than requiring every current and future call site to remember `.catch()`.
    try {
      const layout = computeLayout(snapshot);
      this.layoutAbort?.abort();
      this.layoutAbort = new AbortController();
      this.layoutGeneration += 1;
      await this.renderer.setLayout(layout, { generation: this.layoutGeneration, signal: this.layoutAbort.signal });
    } catch {
      this.showNotice('The city could not be rendered from the latest scan.');
    }
  }

  private applyWidth(): void {
    const rect = this.contentEl.getBoundingClientRect();
    const available = rect.width >= MIN_INLINE_SIZE;
    this.rendererAvailable.value = available;
    if (available) {
      const justCreated = this.ensureRenderer();
      const pixelRatio = this.contentEl.win.devicePixelRatio || 1;
      this.renderer?.resize(rect.width, rect.height, pixelRatio);
      // A renderer created by a resize (e.g. a leaf dragged wider) needs whatever was
      // already published re-applied -- resize never implies fit and setLayout is
      // never re-run just because visibility changed (spec 4.2: visibility never
      // authorises a SCAN, but a renderer that did not exist yet still needs today's
      // already-approved layout, not a new one).
      if (justCreated && this.state.snapshotId) {
        const existing = this.deps.snapshotStore.get(this.state.snapshotId);
        if (existing) void this.publishLayout(existing);
      }
    } else {
      this.teardownRenderer();
    }
  }

  private ensureRenderer(): boolean {
    if (this.renderer || !this.rendererMountEl) return false;
    const win = this.contentEl.win;
    this.renderer = createCityRenderer(this.rendererMountEl, win, (event) => {
      this.onRendererEvent(event);
    });
    this.renderer.setColors(readPalette(this.contentEl));
    return true;
  }

  private onRendererEvent(event: CityRendererEvent): void {
    if (event.type === 'unavailable') {
      // No self-healing (spec 4.2): drop the reference. A later resize/onOpen is
      // what constructs a fresh renderer, never a restore.
      this.rendererAvailable.value = false;
      this.teardownRenderer();
    }
  }

  private teardownRenderer(): void {
    if (!this.renderer) return;
    this.renderer.dispose();
    this.renderer = null;
  }
}
