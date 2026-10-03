// ItemView owning onOpen/onClose/getState/setState (task 3), the scan lifecycle
// wiring (task 8: coordinator, consent chain, progress/cancellation notices, handing
// a completed snapshot's layout to the renderer), and task 11's per-leaf snapshot
// reconciliation plus CityViewState<->store sync (view-reconciliation.ts,
// view-state-sync.ts). Part 5 (V1): the scan lifecycle itself lives in
// city-scan-controller.ts and layout publishing in layout-publisher.ts; the public
// methods below are one-line delegations, so commands.ts and every host test are
// unchanged.
//
// Ruling M68 (task 9): renderer CONSTRUCTION, teardown and sizing live in
// `CityViewport.vue`, the single owner — this file only PROVIDES the real
// `createCityRenderer` factory into the tree (before `mount()`, at the app level,
// since a component's own `provide()` only resolves for ITS descendants) and reads
// the SAME shared handle for the two things only the host layer can do: react to
// `workspace.on('css-change')`, and hand a completed snapshot's layout to whichever
// renderer currently exists.
//
// Host rules this file exists to satisfy (spec 4.4): WebGL context creation happens
// in onOpen, never the constructor; Vue mounts on this.contentEl, never
// containerEl.children[1]; each view gets its OWN Pinia instance; getState() returns
// identifiers and presentation state only; setState validates through the same
// runtime validator as settings; below the 320 CSS px floor no WebGL context exists
// at all (CityViewport's own guard); visibility NEVER authorises a scan.
import { ItemView, Notice } from 'obsidian';
import type { EventRef, Plugin, ViewStateResult, WorkspaceLeaf } from 'obsidian';
import { createApp, shallowRef, watch, type App as VueApp, type ShallowRef } from 'vue';
import { createPinia, type Pinia } from 'pinia';
import RootComponent from '../ui/App.vue';
import { createCityRenderer } from '../visualization/city-renderer';
import { useCityStore } from '../ui/stores/city-store';
import { useRunStore } from '../ui/stores/run-store';
import { CITY_RENDERER_KEY, LAYOUT_GENERATION_KEY, createLayoutGenerationSource } from '../ui/renderer-handle';
import { reactToLifecycleChange } from './lifecycle-notices';
import { wireWindowMigration } from './window-migration';
import { reconcileEveryView } from './leaf-registry';
import { applyReconciliationTo } from './view-reconciliation';
import { pickUiState, seedStoreFromState } from './view-state-sync';
import { CityScanController, provideScanCallbacks, type CityViewDeps } from './city-scan-controller';
import { createLayoutPublisher, type LayoutPublisher } from './layout-publisher';
import { requestFallowRun, requestReportImport, unwireDataPorts, wireDataPorts } from './data-ports';
import { useAnalysisStore } from '../ui/stores/analysis-store';
import type { CityRendererPort } from '../visualization/renderer-port';
import type { ScanLifecycleState } from '../application/run-state';
import type { CodebaseSnapshot, CityViewState } from '../domain/model';
import { defaultCityViewState, decodeCityViewState } from './view-state';
import { readPalette } from './theme-bridge';

export type { CityViewDeps } from './city-scan-controller';

export const CITY_VIEW_TYPE = 'codebase-inspector-city';

export class CityView extends ItemView {
  private readonly plugin: Plugin;
  private readonly deps: CityViewDeps;
  /** Part 5 (V1): the coordinator, the consent chain and the start guard. */
  private readonly scanController: CityScanController;
  private vueApp: VueApp | null = null;
  private pinia: Pinia | null = null;
  // Task 9 fix round 2, item 1 (ruling M68): the SHARED renderer handle, provided into
  // the Vue tree at the APP level (a component-level provide only resolves `inject()`
  // calls made by ITS OWN descendants, never by this plain-class code). `CityViewport.vue`
  // is the only WRITER; this file only READS it (theme-colour refresh on `css-change`,
  // and publishing a snapshot's layout) — it never constructs, disposes or sizes anything.
  private readonly cityRendererHandle: ShallowRef<CityRendererPort | null> = shallowRef(null);
  private unwatchRendererForColors: (() => void) | null = null;
  private cssChangeRef: EventRef | null = null;
  private unsubscribeCoordinator: (() => void) | null = null;
  private state: CityViewState = defaultCityViewState();
  // Task 9 fix round 1, item 1 (ruling M66): each view's OWN store instances, resolved by
  // passing `this.pinia` explicitly (Pinia's pattern for a store outside a component's
  // setup), never "whichever pinia is currently active" — the same discipline that keeps
  // `createPinia()` itself per-view (spec 4.4).
  private cityStore: ReturnType<typeof useCityStore> | null = null;
  private runStore: ReturnType<typeof useRunStore> | null = null;
  // Ruling M78: ONE monotonic token source per view, shared with `CityViewport`, which
  // writes setLayout to the same live port. Two private counters meant two sequences
  // against one `latestGeneration`, so a publish after a reconstruct was silently never
  // applied. See renderer-handle.ts.
  private readonly nextLayoutGeneration = createLayoutGenerationSource();
  /** Part 5 (V1): computeLayout, setCity and setLayout, with its own AbortController. */
  private readonly layoutPublisher: LayoutPublisher;
  // Task 11: retained so onClose can call it -- never re-derived, never dropped.
  private unwireWindowMigration: (() => void) | null = null;
  // Task 11 fix round 1, item 1: true once a REAL (validated) setState payload has
  // arrived, whenever that happens relative to onOpen (spec 11's open question).
  // Guards seeding the store from `this.state` -- a fresh view's own constructor
  // default must never be mistaken for a genuine restore (view-state.ts's own
  // `DecodedCityViewState.ok` comment).
  private stateWasRestored = false;
  private unwatchStateSync: (() => void) | null = null;

  constructor(leaf: WorkspaceLeaf, plugin: Plugin, deps: CityViewDeps) {
    super(leaf);
    this.plugin = plugin;
    this.deps = deps;
    this.scanController = new CityScanController(plugin, deps, {
      viewState: () => this.state,
      showNotice: (message) => { this.showNotice(message); },
    });
    this.layoutPublisher = createLayoutPublisher({
      handle: this.cityRendererHandle,
      nextGeneration: this.nextLayoutGeneration,
      setCity: (snapshot, layout) => { this.cityStore?.setCity(snapshot, layout); },
      notify: (message) => { this.showNotice(message); },
    });
  }

  override getViewType(): string { return CITY_VIEW_TYPE; }
  override getDisplayText(): string { return 'Codebase city'; }
  override getIcon(): string { return 'building-2'; }

  /** `scan-codebase` (spec 5: doubles as refresh). Rulings M46 and M53: see
   *  city-scan-controller.ts. A no-op while a run is in flight; never throws. */
  async startScan(): Promise<void> { await this.scanController.startScan(); }

  /** Ruling M46: "Select a codebase" (COPY-02) ALWAYS runs the full consent chain. */
  async selectCodebase(): Promise<void> { await this.scanController.selectCodebase(); }

  /** `cancel-scan`'s callback body (ruling M36); a no-op unless a run is running. */
  cancelScan(): void { this.scanController.cancelScan(); }

  isScanRunning(): boolean { return this.scanController.isScanRunning(); }

  /** Part 6 Y39: `import-analysis-report` is offered only while this leaf shows a snapshot. */
  hasSnapshot(): boolean { return (this.cityStore?.snapshot ?? null) !== null; }

  /** Part 6 Y39: Data & scans, plus a request SourcesScreen turns into the S14 dialog.
   *  Nothing without a snapshot: the first bind would silently drop the request. */
  openReportImport(): void { if (this.pinia && this.hasSnapshot()) requestReportImport(this.pinia); }

  /** Part 7 Z35: Data & scans, plus a request SourcesScreen turns into a run or the review. */
  requestFallowRun(): void { if (this.pinia && this.hasSnapshot()) requestFallowRun(this.pinia); }

  /** Part 7 Z35: this leaf's codebase has an analysis probing, running or cancelling. */
  isAnalysisActive(): boolean { return this.pinia ? useAnalysisStore(this.pinia).active : false; }

  /** Part 7 Z35 (M36): probing or running, so there is something to cancel. */
  isAnalysisCancellable(): boolean { return this.pinia ? useAnalysisStore(this.pinia).cancellable : false; }

  cancelAnalysis(): void { if (this.pinia) useAnalysisStore(this.pinia).cancel(); }

  override async onOpen(): Promise<void> {
    this.contentEl.classList.add('codebase-inspector-root');

    this.pinia = createPinia();
    // This view's OWN store instances (item 1, ruling M66) — explicit `pinia`
    // argument, never the ambient "currently active" one, so two CityViews never
    // share data even if Vue's own per-app resolution were ever bypassed.
    this.cityStore = useCityStore(this.pinia);
    this.runStore = useRunStore(this.pinia);
    wireDataPorts(this.pinia, this.deps); // Part 6 Y11: before mount, so App's first bind uses the registry.
    // typescript-eslint's type-aware linting resolves a cross-file .vue import as an
    // untyped/error module (it has no Vue SFC language-service plugin, unlike vue-tsc,
    // which DOES type-check this correctly — see `npm run typecheck`). Real behaviour
    // is unaffected; this is a lint-tooling gap, not an unsafe value.
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument -- see comment above: vue-tsc, not eslint's type-aware linting, is the accurate check here
    this.vueApp = createApp(RootComponent);
    // 'onSelectCodebase' and (task 5, F7) 'onScanRequested', provided before mount.
    provideScanCallbacks(this.vueApp, this.scanController);
    // Task 9 fix round 2, item 1 (ruling M68): the shared handle AND the real
    // factory, both provided at the APP level, BEFORE mount — `CityViewport`
    // is the only thing that ever WRITES the handle or calls the factory;
    // this file only ever READS the handle afterwards.
    this.vueApp.provide(CITY_RENDERER_KEY, this.cityRendererHandle);
    this.vueApp.provide(LAYOUT_GENERATION_KEY, this.nextLayoutGeneration);
    this.vueApp.provide('createCityRenderer', createCityRenderer);
    this.vueApp.use(this.pinia);
    this.vueApp.mount(this.contentEl);

    // Task 11: containerEl, per spec 4.4's cross-window rule -- see window-migration.ts.
    this.unwireWindowMigration = wireWindowMigration(this.containerEl);

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

    this.unsubscribeCoordinator = this.scanController.subscribe((lifecycle) => { this.onLifecycleChange(lifecycle); });

    // Reopening shows retained in-memory state (spec 4.5): if a prior scan already
    // published a snapshot this view's own persisted state points at, render it again
    // without starting anything -- restoring a view never authorises a scan.
    if (this.state.snapshotId) {
      const existing = this.deps.snapshotStore.get(this.state.snapshotId);
      if (existing) void this.layoutPublisher.publish(existing);
    }

    // Task 11 fix round 1, item 1: seeds the store AFTER the block above, so a
    // restored query's own match set is computed against a real `store.snapshot`
    // rather than the empty one `setQuery` falls back to. Covers "setState arrived
    // BEFORE onOpen"; `setState` itself covers the other ordering.
    if (this.stateWasRestored) seedStoreFromState(this.cityStore, this.state);
    // The one real source of truth for "did the live UI change" from here on --
    // mirrored back into `this.state` so `getState()`/workspace.json reflect a
    // selection, query, camera or view-mode change made with no rescan at all
    // (spec 4.2: "the view mirrors [camera-changed] into CityViewState").
    this.unwatchStateSync = watch(() => pickUiState(this.cityStore!), (live) => {
      this.state = { ...this.state, ...live };
    });
  }

  override async onClose(): Promise<void> {
    // Fix round 1, Important 2: closing the tab mid-scan must actually STOP the walk
    // (CityScanController.cancelIfRunning), not merely discard its result later.
    this.scanController.cancelIfRunning();
    if (this.cssChangeRef) {
      this.plugin.app.workspace.offref(this.cssChangeRef);
      this.cssChangeRef = null;
    }
    this.unwatchRendererForColors?.();
    this.unwatchRendererForColors = null;
    this.unsubscribeCoordinator?.();
    this.unsubscribeCoordinator = null;
    this.unwireWindowMigration?.();
    this.unwireWindowMigration = null;
    this.unwatchStateSync?.();
    this.unwatchStateSync = null;
    this.layoutPublisher.abort();
    // Ruling M68: no `teardownRenderer()` here — `CityViewport.vue`'s own
    // `onBeforeUnmount` (its ResizeObserver disconnect, `renderer.dispose()`, which
    // itself calls `forceContextLoss()`, spec 4.4, and clearing the shared handle)
    // fires as part of THIS `unmount()` call. Disposing here too would be the
    // double-dispose ruling M68 warned about.
    this.vueApp?.unmount();
    this.vueApp = null;
    if (this.pinia) unwireDataPorts(this.pinia); // Part 6 R2: the plugin's ports outlive this leaf.
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
    // never partially applying it.
    const decoded = decodeCityViewState(state, this.state);
    this.state = decoded.state;
    if (!decoded.ok) return;
    this.stateWasRestored = true;
    // Spec 11's open question: ordering between setState and onOpen on workspace
    // restore is not guaranteed. `onOpen` seeds the store when IT runs after this;
    // this covers setState arriving AFTER onOpen already ran (the store exists).
    if (this.cityStore) seedStoreFromState(this.cityStore, this.state);
  }

  /** Reacts to every run-lifecycle transition (spec 7) — the decision logic lives in
   *  `lifecycle-notices.ts`'s `reactToLifecycleChange` (task 9 fix round 1, item 1).
   *  This method is just the host-specific wiring: which store, which snapshot store,
   *  which callbacks. */
  private onLifecycleChange(lifecycle: ScanLifecycleState): void {
    const updated = reactToLifecycleChange(
      lifecycle, this.deps.snapshotStore, this.state.snapshotId, this.runStore,
      { publishLayout: (snapshot) => { void this.layoutPublisher.publish(snapshot); }, showNotice: (m) => { this.showNotice(m); } },
    );
    if (updated) this.state = { ...this.state, ...updated };
    // Task 11: a sibling leaf on the same profile knows nothing about THIS
    // coordinator's completion (leaf-registry.ts: ScanCoordinator is one per view).
    if (lifecycle.run.status === 'complete' && lifecycle.publishedSnapshotId) {
      const snapshot = this.deps.snapshotStore.get(lifecycle.publishedSnapshotId);
      if (snapshot) reconcileEveryView(this.plugin.app, snapshot);
    }
  }

  /** Called by `reconcileEveryView` for EVERY open CityView, including this one --
   *  see view-reconciliation.ts for the guard, the identity match, and Minor 5's
   *  sibling-vs-own notice wording. */
  applyReconciliation(snapshot: CodebaseSnapshot): void {
    if (!this.cityStore) return;
    const { notice } = applyReconciliationTo(this.cityStore, this.state, snapshot);
    if (notice) this.showNotice(notice);
  }

  /** A one-shot Notice for a terminal (cancelled/failed) transition, a scan-start
   *  failure or a render failure — never for progress, which is `runStore`'s and
   *  `StatusBanner`'s job. Nothing here retains the instance afterwards. */
  private showNotice(message: string): void {
    void new Notice(message, 6000);
  }
}
