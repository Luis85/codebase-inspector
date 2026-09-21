<!--
  C08 — the 3D viewport wrapper. Owns sizing (its OWN ResizeObserver, read off its own
  stage element's `.win`/`.doc` — Obsidian's real, ambient HTMLElement prototype
  extension, spec 4.4 — never a bare `window`), the 320 CSS px hard floor, the pixel-
  ratio clamp, and reduced-motion. The stage div is the single focusable, named
  region (spec 4.2: "the VIEW owns focus... mountEl is the single focusable, named
  region"); the canvas the renderer appends into it stays aria-hidden and untabbable
  entirely on the RENDERER's own side (city-renderer.ts, unchanged this task).

  Task 9 fix round 2, item 1 (ruling M68): this component is now the SINGLE owner of
  renderer construction, teardown and sizing — `city-view.ts` provides the real
  `createCityRenderer` factory into the tree (before mount, at the app level) instead
  of constructing its own renderer directly. Every sizing/renderer-lifecycle
  behaviour below is exercised by this component's own tests injecting a double
  factory; in a standalone mount (no factory provided at all — `inject`'s default is
  `null`), this component stays passive: a bare host, nothing more.
-->
<script setup lang="ts">
import { inject, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import type {
  CityRendererEvent, CityRendererPort, CreateCityRenderer,
} from '../../visualization/renderer-port';
import { useCityRendererHandle, useCityStageEl, useLayoutGeneration } from '../renderer-handle';
import { useCityStore } from '../stores/city-store';
import { useInspectorOpener } from '../drawer-focus';
import { COPY_14, CONTEXT_LOST_NOTICE } from '../copy';
// Phase 2 fix wave, I2: the floor is shared with App.vue, which applies the OTHER
// half of the same spec 5.2 sentence (render list-first) against the leaf container
// while this component applies the renderer half against its own stage.
import { MIN_INLINE_SIZE } from '../responsive';

const MAX_PIXEL_RATIO = 2;
// WP-01 ships no label toggle: no control, no microcopy and no spec line defines one,
// and inventing a hide rule would be a design decision the spec does not authorise. The
// call is still made — and re-made on every reconstruct — so the port is DRIVEN rather
// than merely implemented, which is the defect this replaces (setLabels had zero
// production callers). When a toggle arrives it replaces this constant and nothing else.
const LABELS_VISIBLE = true;

type UnavailableReason = 'unsupported' | 'context-lost' | 'initialization-failed';

const createRenderer = inject<CreateCityRenderer | null>('createCityRenderer', null);
const cityRendererHandle = useCityRendererHandle();
const cityStageHandle = useCityStageEl();
const store = useCityStore();
const inspectorOpener = useInspectorOpener();
// Ruling M78: the SHARED token source, not a private counter. `city-view.ts` writes
// setLayout to this same live port on every publish, and the port discards a generation
// lower than one it has already seen — which, with a counter each, is exactly what a
// publish after a reconstruct becomes. See renderer-handle.ts.
const nextLayoutGeneration = useLayoutGeneration();

const stageEl = ref<HTMLElement | null>(null);
// Task 9 fix round 2, item 1: replaces the externally-injected `rendererAvailable`
// ref (now dead, and removed from city-view.ts/App.vue) — this component now
// determines "is the box wide enough" from its OWN measurement, the same
// measurement `applySize` already takes for the hard floor below.
const available = ref(true);
const unavailableReason = ref<UnavailableReason | null>(null);
let resizeObserver: ResizeObserver | null = null;
let layoutAbort: AbortController | null = null;
let unwireStageMigration: (() => void) | null = null;
let motionQuery: MediaQueryList | null = null;
let onMotionChange: (() => void) | null = null;

interface WinBearing { win?: Window }

// Task 9 fix round 1, item 5 (Important, spec 4.4's cross-window rule): takes
// the element explicitly and returns ITS window, with NO bare-`window`
// fallback — every call site below already has a non-null `el` in scope by the
// time it calls this, so there is nothing for a fallback to paper over except a
// real bug (this element's own `.win` extension not having installed, which
// only ever happens outside a real Obsidian host).
function winOf(el: HTMLElement): Window {
  return (el as unknown as WinBearing).win as Window;
}

// Task 9 fix round 3, item 2 (Important): this was dormant text before ruling
// M68 (nothing constructed a renderer in production, so `unavailable` never
// fired against a real handle) -- activated by it. Previously just null'd the
// handle: no `dispose()`, so no `forceContextLoss()`/canvas removal (spec
// 4.2's own designed path, "on unavailable{context-lost} the view disposes
// and reconstructs"), the next resize tick appended a SECOND canvas beside
// the still-live first one, and `onBeforeUnmount` only ever disposed whichever
// renderer was newest -- every earlier one leaked.
//
// Task 10, finding 6: this is the CANVAS-TO-HTML direction, and this component is the
// only thing that receives renderer events at all. Without these two lines
// `city-store.setCamera()` had no production caller (so a camera moved on the canvas
// never reached CityViewState, and nothing persisted it) and a pick in the 3D view
// selected nothing in the list or the inspector — the HTML-to-canvas direction
// (CodebaseFileList -> setSelection) was already wired in task 9, this is its partner.
// `hover-changed` has no store field and is deliberately not mirrored here.
// Ruling M80 (task 11 fix round 1, item 2): context loss DISPOSES AND RECONSTRUCTS
// -- spec 4.2, line 589, verbatim -- self-triggered, not left for whatever next
// happens to cause a resize (which, before this, could be never: the notice below
// is `position: absolute`, so showing it relayouts nothing and generates no
// ResizeObserver callback at all — the view sat on "will rebuild" indefinitely).
// 'unsupported'/'initialization-failed' do NOT self-trigger: they are permanent for
// this platform/session, and an immediate retry would either fail identically or,
// against a test double, misleadingly "succeed" — silently clearing the very
// notice this line just raised. `applySize()` is the SAME reconstruction mechanism
// a real subsequent resize already used (no second code path); `nextTick` defers it
// past the CURRENT reactive flush, so the notice's own DOM update (already queued
// by the `unavailableReason.value` assignment above) commits first.
//
// Ruling M89 (Phase 2 fix wave, M1) corrects ruling M83's boundary, which said the
// context-loss notice "is never painted": it is never painted WHEN THE SELF-HEAL CAN
// RUN. The reconstruction below clears `unavailableReason` within the same microtask
// drain, so on a visible, wide-enough leaf the browser never paints it -- which is why
// checkpoint #3 tells the human to expect a silent rebuild. But when `applySize()`
// returns EARLY -- a 0x0 box (a leaf behind a sibling tab) or a box below the 320 px
// floor -- nothing clears the reason and the notice genuinely renders and stays.
// tests/component/responsive-floor.test.ts asserts both sides of that boundary.
function handleRendererEvent(event: CityRendererEvent): void {
  if (event.type === 'unavailable') {
    unavailableReason.value = event.reason;
    cityRendererHandle.value?.dispose();
    cityRendererHandle.value = null;
    if (event.reason === 'context-lost') void nextTick(() => { applySize(); });
    return;
  }
  if (event.type === 'camera-changed') store.setCamera(event.camera);
  if (event.type === 'entity-picked') selectFromCanvas(event.entityId);
}

/** Fix round 1, item 2. Spec 5.2 says "a click selects and opens the inspector" and says
 *  nothing about the two surfaces differing, so a canvas pick does exactly what a list
 *  row activation does — including recording an opener, because the narrow (<820 px)
 *  drawer returns focus to it on close (drawer-focus.ts). The opener is the STAGE: it is
 *  where the user was, it is the focusable named region, and it is where F/T/+/- and the
 *  arrow keys work once focus lands back. The selection outline itself is not commanded
 *  here — the store watcher below is the single path for that, for both surfaces. */
function selectFromCanvas(entityId: string): void {
  store.select(entityId);
  inspectorOpener.value = stageEl.value;
  store.openInspector();
}

/** THE single store-to-port mirror (fix round 1, items 2 and 3). Before this, the only
 *  caller of setSelection anywhere was an ad-hoc one in CodebaseFileList (now removed,
 *  so there is one path and not two), and setFilter/setLabels had none at all — so a
 *  canvas pick highlighted nothing and spec 5.2's "dims non-matches in place" was absent
 *  from the product even though the port implements it. Re-applied whenever the handle
 *  changes, so the reconstruct spec 4.2 mandates after a context loss does not silently
 *  come back with no selection and an undimmed city. */
function applyStoreState(handle: CityRendererPort | null): void {
  if (!handle) return;
  handle.setSelection(store.selectedEntityId);
  handle.setFilter(store.matchingIds ?? null);   // null = unfiltered, empty = no matches
  handle.setLabels(LABELS_VISIBLE);
  // …including the LAYOUT. `city-view.ts` hands a layout to whichever renderer exists
  // when a snapshot is PUBLISHED, and nothing re-sends it, so any renderer built after
  // that — by the dispose-and-reconstruct spec 4.2 mandates after a context loss, or by
  // leaving and re-entering list mode — came back with an empty scene. The store already
  // holds the current layout unconditionally (it must, for the list-first fallback), so
  // this is a re-send of what is already known, never a rescan.
  if (!store.layout) return;
  layoutAbort?.abort();
  const abort = new AbortController();
  layoutAbort = abort;
  // Task 11 (task-11-context.md section 1): no persisted CameraBookmark was ever
  // pushed INTO the renderer before this — `setCamera` existed only to mirror the
  // renderer's OWN camera-changed event back OUT to the store, so every
  // reconstruction (a context loss, a cross-window migration, a 320px floor round
  // trip) landed wherever `setLayout`'s own auto-fit put it, never where the camera
  // actually was. Applied only AFTER setLayout settles, never before: the FIRST
  // setLayout a fresh renderer receives fits itself (city-renderer.ts's own
  // `hasFitted` guard), and a setCamera issued earlier would just be overwritten.
  //
  // Phase 2c, C1 (Critical): CAPTURED HERE, BEFORE the call — never read out of the
  // store inside the `.then()`. `setLayout`'s own auto-fit is a RIG-INITIATED commit,
  // so it emits `camera-changed`, which `handleRendererEvent` mirrors straight into
  // `store.setCamera` — synchronously, inside the awaited call, before this callback
  // ever runs. Reading `store.camera` there therefore re-applied the auto-fit camera
  // this very call had just caused, and `previous3dCamera` (the fit's own mode is
  // '3d') was clobbered with it. Both are persisted into workspace.json, so the
  // bookmark was destroyed on every context loss, every sub-320px round trip, every
  // pop-out migration and every list <-> 3D round trip. `restored` is the value as of
  // the moment the reconstruction began, which is the only value that means anything.
  //
  // The STORE is put back too, and that half is not optional. `setCamera` is a COMMAND
  // and deliberately emits no `camera-changed` (spec 4.2, so host synchronisation
  // cannot loop) — so re-aiming the renderer alone leaves the store still holding the
  // auto-fit bookmark the fit wrote on its way past, and it is the STORE that
  // `view-state-sync.ts` persists into workspace.json. Renderer-only would have made
  // the two disagree and destroyed the saved bookmark on the next persist anyway.
  // Routed through the same `store.setCamera` the event path uses, so there is one
  // definition of "the camera is now here" and `previous3dCamera` is restored by the
  // same rule in both cases.
  const restored = store.camera;
  void handle.setLayout(store.layout, { generation: nextLayoutGeneration(), signal: abort.signal }).then(() => {
    if (abort.signal.aborted || !restored) return;
    handle.setCamera(restored);
    store.setCamera(restored);
  });
}

watch(() => store.selectedEntityId, (id) => { cityRendererHandle.value?.setSelection(id); });
watch(() => store.matchingIds, (ids) => { cityRendererHandle.value?.setFilter(ids ?? null); });
watch(cityRendererHandle, (handle) => { applyStoreState(handle); });

/** Task 9 fix round 1, item 6 (Important): the hard floor and the zero-box
 *  no-op are two DIFFERENT guards, kept separate on purpose (they used to be
 *  merged into one early return, which left the height guard with no
 *  independent test coverage — a 0x0 box tripped both at once). Below the
 *  floor, an existing renderer is DISPOSED, not merely left un-resized: spec
 *  5.2 says the view "creates no WebGL context at all" below 320px, so a live
 *  context is never left surviving there with a stale size. Task 9 fix round
 *  2, item 1 (ruling M68): this is now the ONLY place that transition happens
 *  at all — city-view.ts's own former, analogous `applyWidth` ->
 *  `teardownRenderer` transition is gone; this component owns it alone. */
function applySize(): void {
  const el = stageEl.value;
  if (!el || !createRenderer) return;
  // Checkpoint #3 defect 1 -- THE CONTENT BOX, never `getBoundingClientRect()`.
  // `getBoundingClientRect()` always returns the BORDER box, whatever `box-sizing`
  // says, and `.ci-viewport__stage` carries `border: 1px solid` (styles.css), so the
  // rect is the content box + 2px in each axis. That figure reached `resize()`, which
  // hands it to `setSize(w, h, true)`, and Three writes it straight to
  // `canvas.style.height`. The canvas is this element's only IN-FLOW child (the label
  // overlay is `position: absolute`), so the stage's CONTENT height then became the
  // PREVIOUS BORDER-box height -- +2px -- the ResizeObserver fired, and it ratcheted
  // forever: "the canvas grows in height all the time". `clientWidth`/`clientHeight`
  // ARE the content box (this element has a border and no padding), so the canvas is
  // sized to exactly the box it lives in and the next measurement returns the SAME
  // number: a fixed point that terminates on the first tick, not a ratchet. Used for
  // every guard below too, so there is ONE measurement rule here and not two -- the
  // observer's own `contentBoxSize` would only cover the observer path, leaving mount,
  // the context-loss rebuild and the cross-window migration on the other rule.
  const width = el.clientWidth;
  const height = el.clientHeight;
  // Task 11 (task-11-context.md section 1): a leaf hidden behind a sibling tab
  // collapses BOTH dimensions to exactly zero (Obsidian hides an inactive leaf's
  // pane via `display:none`, which a real ResizeObserver reports as a zero content
  // box) -- distinct from the 320px floor below, which only ever narrows WIDTH
  // while the leaf stays visible. `clientWidth`/`clientHeight` are zero for a
  // `display: none` subtree too, so this guard reads the same either way.
  // Spec 4.2's pause/resume invariant is explicit:
  // hidden leaves SUSPEND drawing and input, they are never disposed -- before this,
  // `pause()`/`resume()` had no production caller anywhere in `src/`, and this same
  // width check alone tore the whole scene down and rebuilt it on every tab switch.
  if (width === 0 && height === 0) {
    cityRendererHandle.value?.pause();
    return;
  }
  // Spec 5.2 says INLINE SIZE, and the CSS half of the same rule
  // (`@container (max-width: 819px)`) measures the content box as well, so comparing
  // a content-box width here is the more faithful reading, not a looser one.
  if (width < MIN_INLINE_SIZE) {
    available.value = false;
    cityRendererHandle.value?.dispose();
    cityRendererHandle.value = null;
    return;
  }
  available.value = true;
  if (height <= 0) return;   // zero-size box: no-op, independent of the floor
  const win = winOf(el);
  if (!cityRendererHandle.value) {
    // Task 9 fix round 3, item 2: a stale CONTEXT_LOST_NOTICE/COPY-14 must not
    // outlive the reconstruction spec 4.2 says follows it -- cleared exactly
    // where a new renderer is about to exist again, never earlier.
    // Task 9 fix round 4, item 1 (Important): and never LATER, either. The real
    // `createCityRenderer` emits `unavailable{initialization-failed}`
    // SYNCHRONOUSLY from inside itself, before it returns (city-renderer.ts's
    // WebGL-construction `catch`), so clearing below the call wiped the notice
    // the factory had just raised -- COPY-14 never rendered and a WebGL init
    // failure looked like a silent, normal, empty viewport.
    unavailableReason.value = null;
    cityRendererHandle.value = createRenderer(el, win, handleRendererEvent);
    // Re-read on every (re)construction, not only the first mount -- a rebuild
    // after a floor round trip, a context loss or a cross-window migration must
    // see the CURRENT window's preference, never the one captured at mount.
    applyMotionPreference(win);
  }
  const ratio = Math.min(win.devicePixelRatio || 1, MAX_PIXEL_RATIO);
  cityRendererHandle.value?.resize(width, height, ratio);
  cityRendererHandle.value?.resume();   // undoes a previous pause() -- always safe, idempotent
}

/** Task 11: also tracks LIVE OS-level changes, not just the value at construction
 *  time -- `setMotion` had a real re-read on every reconstruction already, but
 *  nothing reacted to the SAME window's preference changing while a renderer
 *  keeps running. Detaches any previous query's listener first, so a rebuild never
 *  accumulates one per reconstruction; `onBeforeUnmount` detaches the last one. */
function applyMotionPreference(win: Window): void {
  if (motionQuery && onMotionChange) motionQuery.removeEventListener('change', onMotionChange);
  motionQuery = win.matchMedia('(prefers-reduced-motion: reduce)');
  onMotionChange = () => {
    cityRendererHandle.value?.setMotion(motionQuery!.matches ? 'reduced' : 'standard');
  };
  motionQuery.addEventListener('change', onMotionChange);
  onMotionChange();
}

/** Builds (or rebuilds) the ResizeObserver watching `el`, off `win`'s OWN
 *  constructor. Task 11 fix round 1, item 3 (Important): migration used to
 *  dispose and reconstruct the RENDERER but leave this observer instance
 *  pointing at the OLD window's `ResizeObserver` constructor — spec 4.4 requires
 *  everything to go through the injected `Window`, and an observer built from
 *  one window has no defined behaviour once its target has moved to another. */
function installResizeObserver(el: HTMLElement, win: Window): void {
  resizeObserver?.disconnect();
  resizeObserver = new (win as unknown as { ResizeObserver: typeof ResizeObserver }).ResizeObserver(() => {
    applySize();
  });
  resizeObserver.observe(el);
}

onMounted(() => {
  cityStageHandle.value = stageEl.value;
  // Deferred one microtask so a test (or a future caller) can finish wiring this
  // element's `.win` before any measurement happens — mirrors the real host, where
  // Obsidian's prototype extension is already in place long before onMounted fires.
  void nextTick(() => {
    const el = stageEl.value;
    if (!el || !createRenderer) return;
    installResizeObserver(el, winOf(el));
    // applySize() itself reads the reduced-motion preference on every construction
    // it performs (including this first one) -- see its own comment; no separate
    // call here avoids reading it twice on the very first mount.
    applySize();
    // Task 11: THIS component's own migration recovery -- distinct from, and in
    // addition to, `city-view.ts`'s `containerEl`-level registration (which exists to
    // retain/destroy the registration itself, spec 4.4). A canvas moved into a
    // different window's document loses its WebGL context in every browser this
    // plugin ships to (the same "no rebind" transition context loss produces), so
    // this disposes and calls `applySize()` again -- by then `winOf(el)` already
    // resolves to the NEW window (Obsidian updates the element's own `.win`/`.doc`
    // before firing this), so the reconstruction, and the palette/motion re-reads it
    // triggers, land there. Fix round 1, item 3: the ResizeObserver itself is
    // rebuilt from the NEW window too — the OLD instance, built off the OLD
    // window's constructor, has no defined behaviour once `el` has moved.
    unwireStageMigration = el.onWindowMigrated(() => {
      cityRendererHandle.value?.dispose();
      cityRendererHandle.value = null;
      installResizeObserver(el, winOf(el));
      applySize();
    });
  });
});

onBeforeUnmount(() => {
  resizeObserver?.disconnect();
  resizeObserver = null;
  unwireStageMigration?.();
  unwireStageMigration = null;
  if (motionQuery && onMotionChange) motionQuery.removeEventListener('change', onMotionChange);
  motionQuery = null;
  onMotionChange = null;
  layoutAbort?.abort();
  layoutAbort = null;
  cityRendererHandle.value?.dispose();
  cityRendererHandle.value = null;
  cityStageHandle.value = null;
});

defineExpose({ stageEl, cityRendererHandle, unavailableReason });
</script>

<template>
  <div class="ci-viewport">
    <div
      ref="stageEl"
      data-ci-role="stage"
      class="ci-viewport__stage"
      tabindex="0"
      aria-label="Codebase city — 3D view"
      aria-describedby="ci-viewport-help"
    />
    <p
      id="ci-viewport-help"
      class="ci-viewport__help visually-hidden"
    >
      Arrow keys rotate, Shift with arrow keys pans, plus and minus zoom, F fits the
      view, T switches to top view, Enter focuses the current selection.
    </p>
    <p
      v-if="!available && !unavailableReason"
      class="ci-viewport__notice"
    >
      {{ COPY_14 }}
    </p>
    <p
      v-else-if="unavailableReason === 'context-lost'"
      class="ci-viewport__notice"
    >
      {{ CONTEXT_LOST_NOTICE }}
    </p>
    <p
      v-else-if="unavailableReason"
      class="ci-viewport__notice"
    >
      {{ COPY_14 }}
    </p>
    <!-- Task 10 (F5, see CityStage.vue): CameraControls slots in here, anchoring
         `--overlay` against this element's own `position: relative` box. -->
    <slot />
  </div>
</template>
