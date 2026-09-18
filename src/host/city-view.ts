// ItemView owning onOpen/onClose/getState/setState (task 3), plus the scan lifecycle
// wiring (task 8): the coordinator, the consent chain, progress/cancellation notices,
// and handing a completed snapshot's layout to the renderer. Task 9 replaces the
// welcome-shell UI with the real C01 shell; task 11 adds per-leaf snapshot
// reconciliation. This file's own responsibilities do not change.
//
// Task 9 fix round 2, item 1 (ruling M68): renderer CONSTRUCTION, teardown and
// sizing moved OUT of this file and into `CityViewport.vue`, which is now their
// single owner — this file used to build its own renderer directly and never
// publish it into the Vue tree, so the shared `cityRendererHandle` was permanently
// null in production and the WCAG 2.5.7 camera controls (round 1, item 3) commanded
// nothing. This file now PROVIDES the real `createCityRenderer` factory into the
// tree (before `mount()`, at the app level — a component's own `provide()` only
// resolves for ITS descendants, never for code outside the tree) and reads the SAME
// shared handle `CityViewport` populates for the two things only the host layer can
// do: react to `workspace.on('css-change')`, and hand a completed snapshot's layout
// to whichever renderer currently exists.
//
// Host rules this file exists to satisfy (spec 4.4):
// - WebGL context creation happens in onOpen, never the constructor: still true —
//   CityViewport's own `onMounted` runs as part of the SAME `mount()` call this
//   file's `onOpen` makes, never earlier.
// - Vue mounts on this.contentEl (not containerEl.children[1]); each view creates its
//   OWN Pinia instance.
// - getState() returns identifiers and presentation state only; setState validates
//   through the same runtime validator as settings, because workspace.json is
//   user-editable.
// - Below the 320 CSS px hard floor, no WebGL context is created at all — now
//   CityViewport's own `applySize()` guard, not this file's.
// - pause/resume invariant (spec 4.2): visibility NEVER authorises a scan -- nothing
//   in this file (or in CityViewport's own sizing) calls the coordinator at all.
import { ItemView, Notice } from 'obsidian';
import type { EventRef, Plugin, ViewStateResult, WorkspaceLeaf } from 'obsidian';
import { createApp, shallowRef, watch, type App as VueApp, type ShallowRef } from 'vue';
import { createPinia, type Pinia } from 'pinia';
import RootComponent from '../ui/App.vue';
import { createCityRenderer } from '../visualization/city-renderer';
import { computeLayout } from '../domain/layout/layout';
import { ScanCoordinator, createCancellationToken } from '../application/scan-coordinator';
import { resolveOrCreateProfile, runInitialScan, runRefresh } from './scan-flow';
import { useCityStore } from '../ui/stores/city-store';
import { useRunStore } from '../ui/stores/run-store';
import { CITY_RENDERER_KEY, LAYOUT_GENERATION_KEY, createLayoutGenerationSource } from '../ui/renderer-handle';
import { reactToLifecycleChange } from './lifecycle-notices';
import type { CityRendererPort } from '../visualization/renderer-port';
import type { ScanLifecycleState } from '../application/run-state';
import type { CodebaseSnapshot, CityViewState, CodebaseProfile } from '../domain/model';
import type { ProfileStore } from '../application/ports/profile-store';
import type { SourceFileSystemPort } from '../application/ports/source-filesystem-port';
import type { SnapshotStore } from '../application/ports/snapshot-store';
import type { Clock } from '../application/ports/clock';
import { defaultCityViewState, decodeCityViewState } from './view-state';
import { validationFailureText } from '../domain/validator';
import { readPalette } from './theme-bridge';
import { CITY_RENDER_FAILURE_NOTICE } from '../ui/copy';

export const CITY_VIEW_TYPE = 'codebase-inspector-city';

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
  // Task 9 fix round 2, item 1 (ruling M68): the SHARED renderer handle,
  // provided into the Vue tree at the APP level (`this.vueApp.provide(...)`,
  // below) rather than via a component's own `provide()` — a component-level
  // provide only resolves `inject()` calls made by ITS OWN descendants, never
  // by this file's plain-class code. `CityViewport.vue` is the only WRITER;
  // this file only ever READS it, for the two things only the host layer can
  // do (theme-colour refresh on `css-change`, and handing a snapshot's layout
  // to whichever renderer currently exists) — it never constructs, disposes or
  // sizes anything itself any more.
  private readonly cityRendererHandle: ShallowRef<CityRendererPort | null> = shallowRef(null);
  private unwatchRendererForColors: (() => void) | null = null;
  private cssChangeRef: EventRef | null = null;
  private unsubscribeCoordinator: (() => void) | null = null;
  private state: CityViewState = defaultCityViewState();
  // Task 9 fix round 1, item 1 (ruling M66): each view's OWN store instances,
  // resolved by passing `this.pinia` explicitly to the store getters (Pinia's
  // documented pattern for using a store outside a component's setup) rather than
  // relying on "whichever pinia is currently active" — the same discipline that
  // keeps `createPinia()` itself per-view (spec 4.4), not a module-level singleton.
  private cityStore: ReturnType<typeof useCityStore> | null = null;
  private runStore: ReturnType<typeof useRunStore> | null = null;
  // Fix round 1, Minor 6: `coordinator.state.status` alone does not guard the WHOLE of
  // startScan() -- it stays 'idle' until AFTER both consent modals resolve, so two fast
  // clicks (or two scan-codebase invocations) both pass that check, both resolve/create
  // a profile, and both open a modal. This flag closes the gap for the async method
  // itself, independent of the coordinator's own state.
  private startingScan = false;
  // Ruling M78: ONE monotonic token source per view, shared with `CityViewport`, which
  // writes setLayout to the same live port this file does (on every reconstruct, where
  // this file writes on every publish). Two private counters meant two sequences against
  // one `latestGeneration`, and the port correctly discarded whichever was lower — so a
  // publish after a reconstruct was silently never applied, leaving the city showing a
  // snapshot the store no longer held. See renderer-handle.ts for the full reasoning.
  private readonly nextLayoutGeneration = createLayoutGenerationSource();
  private layoutAbort: AbortController | null = null;

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
          await runRefresh(this.plugin.app, this.coordinator, profile, existing.scope, this.deps.clock, this.deps.profileStore);
          return;
        }
        // The in-memory store no longer has this id (e.g. the plugin reloaded) --
        // fall through to a full consent chain rather than "refreshing" against nothing.
      }
      await runInitialScan(this.plugin.app, this.coordinator, profile, this.deps.getFilesystem(), this.deps.profileStore);
    });
  }

  /** Ruling M46: "Select a codebase" (COPY-02, App.vue) ALWAYS opens the source modal
   *  and runs the full consent chain, whether or not a snapshot already exists —
   *  re-selecting a different codebase must stay reachable. See `startScan()`'s own
   *  comment for why this is a second method rather than a flag. */
  async selectCodebase(): Promise<void> {
    await this.withScanGuard((profile) => (
      runInitialScan(this.plugin.app, this.coordinator, profile, this.deps.getFilesystem(), this.deps.profileStore)
    ));
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
    } catch (e) {
      // Fix wave item 1 (C1): the destination ruling M53's deliberate propagation never
      // had. Both entry points are `void view.startScan()`, so without this a rejection
      // -- a scope the store refuses, or PluginDataProfileStore.list() throwing on one
      // hand-edited record -- was an unhandled rejection in a console nobody opens.
      this.showNotice(validationFailureText(e));
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
    // This view's OWN store instances (item 1, ruling M66) — explicit `pinia`
    // argument, never the ambient "currently active" one, so two CityViews never
    // share data even if Vue's own per-app resolution were ever bypassed.
    this.cityStore = useCityStore(this.pinia);
    this.runStore = useRunStore(this.pinia);
    // typescript-eslint's type-aware linting resolves a cross-file .vue import as an
    // untyped/error module (it has no Vue SFC language-service plugin, unlike vue-tsc,
    // which DOES type-check this correctly — see `npm run typecheck`). Real behaviour
    // is unaffected; this is a lint-tooling gap, not an unsafe value.
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument -- see comment above: vue-tsc, not eslint's type-aware linting, is the accurate check here
    this.vueApp = createApp(RootComponent);
    this.vueApp.provide('onSelectCodebase', () => { void this.selectCodebase(); });
    // Task 9 fix round 2, item 1 (ruling M68): the shared handle AND the real
    // factory, both provided at the APP level, BEFORE mount — `CityViewport`
    // is the only thing that ever WRITES the handle or calls the factory;
    // this file only ever READS the handle afterwards, directly (below, and
    // in `publishLayout`).
    this.vueApp.provide(CITY_RENDERER_KEY, this.cityRendererHandle);
    this.vueApp.provide(LAYOUT_GENERATION_KEY, this.nextLayoutGeneration);
    this.vueApp.provide('createCityRenderer', createCityRenderer);
    this.vueApp.use(this.pinia);
    this.vueApp.mount(this.contentEl);

    // Applies the current theme the moment a renderer exists — on first
    // construction, and again on any later reconstruction (e.g. after a
    // context-lost dispose-and-rebuild) — without CityViewport itself needing
    // to import theme-bridge.ts (a host-layer concern; CityViewport stays
    // ignorant of Obsidian's theme system entirely, same as it already never
    // imports 'obsidian'). `watch()` works outside a component's setup exactly
    // like this — it is Vue's reactivity system, not the injection system.
    this.unwatchRendererForColors = watch(this.cityRendererHandle, (renderer) => {
      renderer?.setColors(readPalette(this.contentEl));
    });

    this.cssChangeRef = this.plugin.app.workspace.on('css-change', () => {
      // Re-reads every cached colour. Never moves buildings, changes camera, or
      // clears state (spec 4.4).
      this.cityRendererHandle.value?.setColors(readPalette(this.contentEl));
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
    if (this.cssChangeRef) {
      this.plugin.app.workspace.offref(this.cssChangeRef);
      this.cssChangeRef = null;
    }
    this.unwatchRendererForColors?.();
    this.unwatchRendererForColors = null;
    this.unsubscribeCoordinator?.();
    this.unsubscribeCoordinator = null;
    this.layoutAbort?.abort();
    // Task 9 fix round 2, item 1 (ruling M68): no more `this.teardownRenderer()`
    // here — `CityViewport.vue`'s own `onBeforeUnmount` (its ResizeObserver
    // disconnect, `renderer.dispose()` — which itself calls `forceContextLoss()`,
    // spec 4.4 — and clearing the shared handle) fires as part of THIS
    // `unmount()` call, synchronously, cascading down from this file's root
    // component exactly like every other descendant's own cleanup. Calling
    // `teardownRenderer()` here too would be the double-dispose ruling M68
    // warned providing the factory without consolidating would create.
    this.vueApp?.unmount();
    this.vueApp = null;
    this.pinia = null;
    this.cityStore = null;
    this.runStore = null;
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

  /** Reacts to every run-lifecycle transition (spec 7) — the actual decision logic
   *  now lives in `lifecycle-notices.ts`'s `reactToLifecycleChange` (task 9 fix
   *  round 1, item 1: extracted purely to keep this file under the 400-line
   *  budget; no logic changed). This method is just the host-specific wiring:
   *  which store, which snapshot store, which callbacks. */
  private onLifecycleChange(lifecycle: ScanLifecycleState): void {
    const updated = reactToLifecycleChange(
      lifecycle, this.deps.snapshotStore, this.state.snapshotId, this.runStore,
      { publishLayout: (snapshot) => { void this.publishLayout(snapshot); }, showNotice: (m) => { this.showNotice(m); } },
    );
    if (updated) this.state = { ...this.state, ...updated };
  }

  /** A one-shot Notice for a terminal (cancelled/failed) transition or a scan-start
   *  failure — never for progress, which is `runStore`'s and `StatusBanner`'s job
   *  now (item 1). Nothing here retains the instance afterwards. */
  private showNotice(message: string): void {
    void new Notice(message, 6000);
  }

  /** Obligation 7 (task-8 brief step 4): recomputes layout from the published snapshot
   *  and hands it to setLayout with {generation, signal}. `layoutGeneration` is a
   *  CityView-LOCAL monotonic counter, deliberately distinct from the scan run's own
   *  `generation` (ScanLifecycleState/RunIdentity) — spec 4.2 only requires SOME
   *  strictly-increasing per-call token so the renderer can discard a stale or
   *  superseded setLayout call; nothing requires it to be numerically the same value as
   *  the run that produced the snapshot, and a run generation is not even defined any
   *  more once a run reaches 'complete' (spec 4.1's frozen union drops it there).
   *
   *  Task 9 fix round 1, item 1 (ruling M66): `cityStore.setCity(snapshot, layout)`
   *  runs UNCONDITIONALLY, before the `this.renderer` guard — the HTML list,
   *  inspector and legend must hold real data below the 320 px floor and before the
   *  first size measurement too, where no renderer exists at all (spec 5.2:
   *  "list-first" is the fallback, not a degraded, dataless mode). `computeLayout`
   *  gets its own try/catch for exactly the reason Minor 8's comment below states —
   *  it has no never-throws contract, and this now runs even when there is no
   *  renderer to catch a later throw for it. */
  private async publishLayout(snapshot: CodebaseSnapshot): Promise<void> {
    let layout;
    try {
      layout = computeLayout(snapshot);
    } catch {
      this.showNotice(CITY_RENDER_FAILURE_NOTICE);
      return;
    }
    this.cityStore?.setCity(snapshot, layout);
    const renderer = this.cityRendererHandle.value;
    if (!renderer) return;
    // Fix round 1, Minor 8: this runs from `void this.publishLayout(...)` at every call
    // site, so an uncaught throw here would be an unhandled promise rejection, not a
    // catchable error anywhere. `setLayout` itself never rejects (spec 4.2).
    try {
      this.layoutAbort?.abort();
      this.layoutAbort = new AbortController();
      await renderer.setLayout(layout, {
        generation: this.nextLayoutGeneration(), signal: this.layoutAbort.signal,
      });
    } catch {
      this.showNotice(CITY_RENDER_FAILURE_NOTICE);
    }
  }
}
