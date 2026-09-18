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
import type { CodebaseSnapshot, CityViewState } from '../domain/model';
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

  /** `scan-codebase` (no snapshot: the full consent chain; a snapshot present: a silent
   *  refresh against the stored scope, keeping the previous city visible) and the
   *  welcome shell's "Select a codebase" button both call this one method. A no-op
   *  while a run is already in flight, never throws. */
  async startScan(): Promise<void> {
    if (this.coordinator.state.status === 'running' || this.coordinator.state.status === 'cancelling') return;
    const profile = await resolveOrCreateProfile(this.deps.profileStore, this.state.profileId);
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
    this.vueApp.provide('onSelectCodebase', () => { void this.startScan(); });
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
      this.showNotice(this.cancelledNoticeText(lifecycle));
      return;
    }
    if (run.status === 'failed') {
      this.showNotice(lifecycle.banner ?? 'Scan failed.');
    }
  }

  /** A one-shot Notice with Obsidian's own default auto-dismiss timer -- nothing here
   *  needs to retain the instance afterwards, unlike `progressNotice`, which is updated
   *  in place across several PROGRESS ticks. */
  private showNotice(message: string): void {
    const notice = new Notice(message, 6000);
    void notice;
  }

  /** COPY-10, verbatim, when a previous snapshot is retained; the base sentence alone
   *  when there is none (a cancelled FIRST scan has no "your complete snapshot" to name). */
  private cancelledNoticeText(lifecycle: ScanLifecycleState): string {
    const previous = lifecycle.publishedSnapshotId ? this.deps.snapshotStore.get(lifecycle.publishedSnapshotId) : null;
    if (!previous) return CANCELLED_BANNER;
    const time = new Date(previous.providerRun.capturedAt).toLocaleTimeString();
    return `${CANCELLED_BANNER} Your complete snapshot from ${time} is unchanged.`;
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
    const layout = computeLayout(snapshot);
    this.layoutAbort?.abort();
    this.layoutAbort = new AbortController();
    this.layoutGeneration += 1;
    await this.renderer.setLayout(layout, { generation: this.layoutGeneration, signal: this.layoutAbort.signal });
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
