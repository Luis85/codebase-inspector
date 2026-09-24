import { createApp, nextTick, shallowRef, watch, type ShallowRef } from 'vue';
import { createPinia } from 'pinia';
import App from '../../src/ui/App.vue';
import { createCityRenderer } from '../../src/visualization/city-renderer';
import {
  CITY_RENDERER_KEY, LAYOUT_GENERATION_KEY, createLayoutGenerationSource,
} from '../../src/ui/renderer-handle';
import { readPalette } from '../../src/host/theme-bridge';
import { useCityStore } from '../../src/ui/stores/city-store';
import { useReportStore } from '../../src/ui/stores/report-store';
import { useReviewStore } from '../../src/ui/stores/review-store';
import { useRunStore } from '../../src/ui/stores/run-store';
import { useEvidenceStore } from '../../src/ui/stores/evidence-store';
import { useLensStore } from '../../src/ui/stores/lens-store';
import { useAnalysisStore } from '../../src/ui/stores/analysis-store';
import { createFakeFallowAnalysis } from '../fixtures/fake-fallow-analysis';
import { InMemoryEvidenceStore } from '../../src/adapters/storage/in-memory-evidence-store';
import {
  DEMO_FALLOW_FILE_NAME, HARNESS_BINDING, cancellingLifecycle, completedAnalysisState, demoCollectedReport,
  demoEvidenceReport, demoFallowReportText, demoImportJson, demoRunReview, failedAnalysisState, openFailureLog,
  runningAnalysisState, runningLifecycle, seedDemoItems,
} from './seed';
import { harnessLayout, harnessSnapshot } from './fixture';
import { HARNESS_THEME_EVENT } from './theme';
import type { CityRendererPort } from '../../src/visualization/renderer-port';
import type { RouteId } from '../../src/domain/route-ids';

export type ScreenId = 's05' | 's06' | 's07' | 's08' | 's09' | 's10' | 's11';

export interface HarnessOptions {
  screen: ScreenId;
  route?: RouteId;
  select?: string;
  tab?: string;
  items?: 'demo';
  edit?: 'first';
  run?: 'running' | 'cancelling';
  importFile?: 'demo';
  report?: 'demo';
  lens?: 'findings';
  fallow?: 'review' | 'routes' | 'installed';
  analysis?: 'running' | 'failed' | 'collected';
  /** WP-03 N38: highlight the selected file's first highlightable cycle (city, with
   *  report=demo and a selection that is a cycle member). */
  relations?: 'cycle';
}

export async function mountHarness(root: HTMLElement, options: HarnessOptions): Promise<void> {
  root.classList.add('codebase-inspector-root');

  // Fix round 1, Finding A. MUST run before `app.mount(root)`: CityViewport's own
  // `applyMotionPreference` reads `win.matchMedia('(prefers-reduced-motion: reduce)')
  // exactly ONCE, synchronously, the moment the renderer is first constructed (inside
  // the `onMounted -> nextTick -> applySize()` chain `app.mount` triggers) — there is
  // no later hook this file can use to change the rig's `motion` setting before that
  // first read. See the comment on `forceReducedMotion` for why this is the fix and
  // not a shortcut.
  forceReducedMotion(window);

  // Same gap city-view.ts already carries an identical line for (src/host/city-view.ts,
  // near its own `createApp(RootComponent)`): typescript-eslint's type-aware linting
  // resolves a cross-file .vue import as an untyped/error module — it has no Vue SFC
  // language-service plugin, unlike vue-tsc, which DOES type-check this correctly (see
  // `npm run typecheck`). Real behaviour is unaffected; this is a lint-tooling gap, not
  // an unsafe value.
  // eslint-disable-next-line @typescript-eslint/no-unsafe-argument -- see comment above: vue-tsc, not eslint's type-aware linting, is the accurate check here
  const app = createApp(App);
  const pinia = createPinia();
  app.use(pinia);
  // Part 6 Y28: what wireDataPorts gives a real CityView — one session evidence repository.
  // The harness has one leaf, so one instance. Set before mount, so App's repository watcher
  // binds the evidence store against it.
  useEvidenceStore(pinia).setRepository(new InMemoryEvidenceStore());

  // Part 7 Z42: a scripted fallow analysis service (it runs nothing); `?analysis=` seeds it.
  const fallowAnalysis = createFakeFallowAnalysis();
  useAnalysisStore(pinia).setService(fallowAnalysis);

  const handle = shallowRef<CityRendererPort | null>(null);
  app.provide(CITY_RENDERER_KEY, handle);
  app.provide(LAYOUT_GENERATION_KEY, createLayoutGenerationSource());
  // Fix round 1, Finding B: EVERY screen gets the real factory, s11 included. Withholding
  // it for s11 (the previous code here) does not reach docs/concept/design/screens/
  // s11-fallback.md's own "WebGL failed, was lost without recovery, or the user selected
  // list-only inspection" fallback path at all — CityViewport's `inject('createCityRenderer',
  // null)` default is a FOURTH state the screen spec never describes, where
  // `rendererStateChanged`/`rendererUnavailableReason` never fire and the renderer-
  // unavailable surface (COPY_14, src/ui/view-surface.ts) never renders, which is why the
  // canvas region photographed blank with no explanation. S11 reaches its real,
  // spec-described list-only path through `applyScreenState`'s `store.setViewMode('list')`
  // below, which unmounts CityViewport before the factory is ever consulted regardless of
  // whether one was provided — so withholding it was dead code that also hid a real gap.
  // Capturing the OTHER path S11 admits — an actual WebGL failure — is Task 0c's job, by
  // launching Chromium with WebGL disabled; noted here so that task inherits it.
  app.provide('createCityRenderer', createCityRenderer);

  app.mount(root);

  // Fix round 1: mirrors src/host/city-view.ts's own `watch(cityRendererHandle, ...)`
  // (the ONLY production initial-paint path — see instanced-city.ts:16-17's "materials
  // keep Three's own default white" until the first setColors). Without this the
  // harness never called setColors at all: CityViewport's `onMounted -> nextTick ->
  // applySize()` chain assigns `handle.value` asynchronously, one tick after this
  // synchronous `app.mount()` call returns, so registering the watch here — still
  // synchronously, still before that tick runs — catches the ref's first assignment
  // the same way city-view.ts's does. `watch()` needs no `immediate: true` for that:
  // it fires on the CHANGE this tick produces, not on a value already present.
  // Never stopped: the harness page just navigates away between shots, unlike
  // city-view.ts's `unwatchRendererForColors`, which has a real view lifecycle to
  // unwind.
  watch(handle, (renderer) => {
    renderer?.setColors(readPalette(root));
  });

  const store = useCityStore();
  store.setCity(harnessSnapshot(), harnessLayout());

  applyScreenState(store, options.screen);
  if (options.select) {
    const target = options.select === 'first'
      ? store.layout?.lots[0]?.entityId
      : store.snapshot?.entities.find((e) => e.kind === 'file' && e.path === options.select)?.id;
    if (target) store.select(target);
  }

  if (options.run) {
    // Part 5 V6: the toolbar's and Data & scans' Cancel are enabled only while running.
    // Part 6 Y4: `cancelling` shows the city's cancelling banner over the snapshot.
    useRunStore().setLifecycle(options.run === 'running' ? runningLifecycle() : cancellingLifecycle());
  }

  if (options.report === 'demo') {
    // Part 6 §5: a SYNTHETIC fallow report (seed.ts) through the real reader, builder and
    // evidence store, so every surface says "fallow · imported report" because it took the
    // real path. Bound here rather than left to App's repository watcher, which runs only on
    // the next flush; binding the same id again is a no-op (R7).
    const snapshot = store.snapshot;
    if (!snapshot) throw new Error('harness: report=demo found no snapshot');
    const evidence = useEvidenceStore();
    evidence.bindRepository(snapshot.repositoryId);
    if (!evidence.attach(demoEvidenceReport(snapshot))) throw new Error('harness: report=demo was refused by the evidence store');
  }
  if (options.lens === 'findings') {
    // Part 6 Y40: the select exists only with evidence, and so does the lens.
    const lens = useLensStore();
    lens.setLens('findings');
    if (lens.lens !== 'findings') throw new Error('harness: lens=findings needs report=demo');
  }

  if (options.analysis) {
    // Part 7 Z42: a run as the plugin's coordinator would report it, on the harness codebase.
    const snapshot = store.snapshot;
    if (!snapshot) throw new Error('harness: analysis= found no snapshot');
    const evidence = useEvidenceStore();
    evidence.bindRepository(snapshot.repositoryId);
    fallowAnalysis.setBinding(snapshot.repositoryId, HARNESS_BINDING);
    if (options.analysis === 'running') fallowAnalysis.setState(snapshot.repositoryId, runningAnalysisState(snapshot));
    if (options.analysis === 'failed') {
      if (!evidence.attach({ ...demoEvidenceReport(snapshot), staleReason: 'failed-run' })) throw new Error('harness: analysis=failed was refused');
      fallowAnalysis.setState(snapshot.repositoryId, failedAnalysisState());
    }
    if (options.analysis === 'collected') {
      if (!evidence.attach(demoCollectedReport(snapshot))) throw new Error('harness: analysis=collected was refused');
      fallowAnalysis.setState(snapshot.repositoryId, completedAnalysisState(snapshot));
    }
  }

  const route = options.route ?? 'city';
  store.navigate(route);
  if (options.relations === 'cycle') {
    // WP-03 N38: a headless capture cannot click, so the harness clicks the city
    // Relations section's own Highlight cycle button (CityRelationsPanel.vue) — the same
    // real DOM, real store command every `options.tab` click below already takes, not a
    // shortcut through useRelationsStore directly. Needs report=demo and a selection that
    // is a member of one of its cycles (screen=s07 plus select=<a cycle member's path>).
    await nextTick();
    const button = root.querySelector<HTMLElement>('.ci-city-relations__highlight');
    if (!button) throw new Error('harness: relations=cycle found no cycle to highlight for the current selection (add report=demo and select a cycle member)');
    button.click();
    await nextTick();
  }
  if (route !== 'city') {
    // Only the city route creates a renderer; every other screen is plain DOM and is
    // drawn once Vue has flushed.
    await nextTick();
    if (options.analysis === 'failed') { openFailureLog(root); await nextTick(); }
    if (options.items === 'demo') {
      // Part 5 V8: App's repository watcher bound the review store to this snapshot and
      // started a load. A second load settles after the first (same depth, in order), so
      // awaiting it guarantees no load lands on top of the items seedDemoItems adds below.
      await useReviewStore().load();
      // Part 4: the workbench and report shots need work items. Part 5 V30: seedDemoItems
      // throws unless all three were created, so a refused add fails the capture.
      await seedDemoItems((store.layout?.lots ?? []).slice(0, 3).map((l) => l.entityId));
      await nextTick();
    }
    if (options.edit === 'first') {
      // Part 5 V29: the editor open, so the label style is seen in both themes.
      const card = root.querySelector<HTMLElement>('.ci-work-card');
      if (!card) throw new Error('harness: edit=first found no work card (add items=demo)');
      card.click();
      await nextTick();
      await nextTick();
    }
    if (options.tab) {
      // Part 3 §4: a headless capture cannot click, so the harness selects the tab.
      root.querySelector<HTMLElement>(`[role="tab"][data-tab-id="${CSS.escape(options.tab)}"]`)?.click();
      await nextTick();
    }
    if (options.importFile === 'demo') {
      // Part 5 V13: a capture cannot use the file picker, so the Import row's own
      // <input type="file"> gets a fixed file and the `change` event a real pick fires.
      const input = root.querySelector<HTMLInputElement>('.ci-settings__import-file');
      const firstPath = store.snapshot?.entities.find((e) => e.kind === 'file')?.path;
      if (!input || !firstPath) throw new Error('harness: import=demo found no import input (add tab=privacy)');
      const transfer = new DataTransfer();
      transfer.items.add(new File([demoImportJson(firstPath, useReportStore().sections)], 'review-state.json', { type: 'application/json' }));
      input.files = transfer.files;
      input.dispatchEvent(new Event('change'));
      await until(() => root.querySelector('.ci-dialog') !== null);
    }
    if (options.fallow === 'review') {
      // Part 6 Y38: the S14 dialog at its review step. requestImport() is the command's own
      // path (Y39): SourcesScreen consumes it and opens the dialog a tick later. As for
      // import=demo, a capture cannot use the file picker, so the dialog's own hidden input
      // (Task 10: `.ci-connect-fallow__file`, outside the CiDialog focus trap) gets the
      // synthetic report and the `change` event a real pick fires. The review step is the
      // one that renders Attach.
      const snapshot = store.snapshot;
      if (route !== 'sources' || !snapshot) throw new Error('harness: fallow=review needs route=sources and a snapshot');
      useEvidenceStore().requestImport();
      await until(() => root.querySelector('.ci-connect-fallow__file') !== null);
      const input = root.querySelector<HTMLInputElement>('.ci-connect-fallow__file');
      if (!input) throw new Error('harness: fallow=review found no file input in the dialog');
      const transfer = new DataTransfer();
      transfer.items.add(new File([demoFallowReportText(snapshot)], DEMO_FALLOW_FILE_NAME, { type: 'application/json' }));
      input.files = transfer.files;
      input.dispatchEvent(new Event('change'));
      await until(() => root.querySelector('.ci-connect-fallow__attach') !== null);
    }
    if (options.fallow === 'routes') {
      // Part 7 Z29: the dialog's step 1, with both routes.
      if (route !== 'sources') throw new Error('harness: fallow=routes needs route=sources');
      useEvidenceStore().requestImport();
      await until(() => root.querySelector('.ci-connect-fallow__use-installed') !== null);
    }
    if (options.fallow === 'installed') {
      // Part 7 Z30/Z31: the command's own path: a run request whose answer is the review.
      const snapshot = store.snapshot;
      if (route !== 'sources' || !snapshot) throw new Error('harness: fallow=installed needs route=sources and a snapshot');
      fallowAnalysis.next.run = { kind: 'review', review: demoRunReview(snapshot), reason: 'untrusted' };
      useAnalysisStore().requestRun();
      await until(() => root.querySelector('.ci-fallow-installed__trust') !== null);
    }
    document.body.dataset.ciHarnessReady = 'true';
    return;
  }

  // The renderer re-reads its palette on Obsidian's `css-change`; here, on ours. This
  // is a SEPARATE path from the watch above — that one paints the FIRST time a
  // renderer exists; this one repaints on a later theme change within the same page.
  window.addEventListener(HARNESS_THEME_EVENT, () => {
    handle.value?.setColors(readPalette(root));
  });

  await waitUntilDrawn(root, handle, options.screen);
  document.body.dataset.ciHarnessReady = 'true';
}

// Fix round 1, Finding A's root cause, found by instrumenting camera-rig.ts and
// city-renderer.ts directly (temporarily; not part of this diff) and comparing the
// automatic first fit against a manual "Fit" click: BOTH computed byte-identical
// bounds/target/theta/phi/position/cssWidth/cssHeight — the stage was never
// mis-sized, disproving the "stage has no size yet" hypothesis this fix round
// started with. The two differed only in what the user SAW, because
// camera-rig.ts's `commit()` (called by `fit()`, and again by any later
// `setCameraMode()`) TWEENS to a discrete camera move over TWEEN_MS (220ms)
// whenever `motion === 'standard'` — and `CityRendererPort` exposes no way for a
// caller outside the renderer to ask "is a tween still running": `getCamera()`
// documents itself as reporting the LOGICAL destination, never the live,
// mid-tween one. A readiness mark that only waits for a sized canvas therefore
// photographs the camera partway through that 220ms walk — indistinguishable, on
// screen, from a broken fit, and exactly the "camera appears to be inside the
// floor" defect fix round 1 found on 6/6 repeats.
//
// `setMotion('reduced')` is not a shortcut around that: it is the SAME real,
// already-shipped accessibility path CityViewport's own `applyMotionPreference`
// takes when the OS reports `prefers-reduced-motion: reduce` (src/ui/components/
// CityViewport.vue). `commit()`'s own branch shows why it changes nothing about
// WHAT gets framed: with `motion === 'reduced'`, `live = copyBookmark(bookmark)`
// applies the SAME target/position/zoom `fit()` computed, immediately, with no
// interpolation — the settled frame is byte-identical to what a completed tween
// reaches. This wraps `matchMedia`, the same real browser API CityViewport itself
// calls (never a fake DOM, matching tests/mocks/jsdom-gaps.ts's own precedent for
// this exact query under jsdom) — it does not touch camera-rig.ts, city-renderer.ts
// or CityViewport.vue, all of which are unmodified by this fix.
function forceReducedMotion(win: Window): void {
  const real = win.matchMedia.bind(win);
  win.matchMedia = (query: string): MediaQueryList => {
    if (query !== '(prefers-reduced-motion: reduce)') return real(query);
    return {
      matches: true, media: query, onchange: null,
      addListener: () => {}, removeListener: () => {},
      addEventListener: () => {}, removeEventListener: () => {},
      dispatchEvent: () => false,
    };
  };
}

function applyScreenState(store: ReturnType<typeof useCityStore>, screen: ScreenId): void {
  const firstFile = store.layout?.lots[0]?.entityId ?? null;
  switch (screen) {
    case 's07':
      if (firstFile) { store.select(firstFile); store.openInspector(); }
      break;
    case 's08':
      // A query that matches some files and not the selected one, which is what puts
      // COPY-30's "outside these filters" notice on screen — one of the two surfaces
      // Task 9 turns into real controls.
      if (firstFile) store.select(firstFile);
      store.setQuery('main');
      store.confirmSearch();
      break;
    case 's09':
      store.setViewMode('top');
      break;
    case 's11':
      store.setViewMode('list');
      break;
    default:
      break;                                   // s05, s06 and s10 are the resting state
  }
}

// `waitUntilDrawn` is what makes a capture trustworthy. Waiting for the canvas element
// to exist is not waiting for the city to draw — that is the mistake the source harness
// records paying for.
async function waitUntilDrawn(
  root: HTMLElement, handle: ShallowRef<CityRendererPort | null>, screen: ScreenId,
): Promise<void> {
  await nextTick();
  if (screen === 's11') {
    // No canvas by design. The fallback list IS the drawn state.
    await until(() => root.querySelector('.ci-file-list__row') !== null);
    return;
  }
  await until(() => {
    const canvas = root.querySelector('canvas');
    // A canvas with a zero-sized drawing buffer has not drawn; a canvas sized to the
    // stage has. This is the difference between photographing the city and
    // photographing an empty box that will contain one shortly.
    return canvas instanceof HTMLCanvasElement && canvas.width > 0 && canvas.height > 0;
  });
  // Fix round 1: a sized canvas is necessary and NOT sufficient (Finding A) — `resize()`
  // runs synchronously as soon as the renderer is constructed, well before `setLayout`'s
  // chunked, async `buildCity` has resolved and called `swapCity()`, which is the ONLY
  // place `rig.setBounds()`/the first `rig.fit()` run. `.ci-city-labels__label` elements
  // (label-overlay.ts's real DOM text, created inside that same `swapCity()` call) are
  // this harness's only externally-observable proof that swapCity — and therefore the
  // first fit — has actually happened, since CityRendererPort exposes no "has laid out
  // yet" query of its own. Combined with `forceReducedMotion` above (which makes that
  // fit's own camera move apply instantly, with no tween left to still be running), a
  // label's presence means the camera is not just aimed correctly but already AT that
  // aim, not partway there.
  await until(() => root.querySelector('.ci-city-labels__label') !== null);
  // Fix round 1, a second gap found alongside Finding A while verifying S09: nothing in
  // src/ui/** reacts to `store.viewMode` becoming 'top' by calling the renderer's own
  // `setCameraMode('top')` — the ONLY production caller of that method is
  // CameraControls.vue's `top()`, a click/key handler, which calls it TOGETHER WITH
  // `store.setViewMode`. Seeding `store.viewMode` alone (`applyScreenState`'s s09 case)
  // therefore flips the Top/3D button's label without moving the camera at all — a real
  // gap this harness exposed rather than caused (see the fix round 1 report: a
  // `viewMode: 'top'` restored from persisted state on reopen would hit the exact same
  // desync, since nothing re-syncs the renderer's camera mode to it either). Reached
  // here the SAME way CameraControls.vue reaches it, so S09 photographs what a real Top
  // click does, not a button whose label lied.
  if (screen === 's09') handle.value?.setCameraMode('top');
  // One more frame after all of the above, so what is photographed is a drawn frame
  // rather than a cleared one.
  await new Promise<void>((resolve) => { window.requestAnimationFrame(() => { window.requestAnimationFrame(() => resolve()); }); });
}

async function until(predicate: () => boolean, timeoutMs = 10_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!predicate()) {
    if (Date.now() > deadline) throw new Error('the harness never reached its drawn state; a capture would photograph a loading frame');
    await new Promise((resolve) => window.setTimeout(resolve, 16));
  }
}
