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

const MIN_INLINE_SIZE = 320;     // spec 5.2 hard floor, CSS px
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
function handleRendererEvent(event: CityRendererEvent): void {
  if (event.type === 'unavailable') {
    unavailableReason.value = event.reason;
    cityRendererHandle.value?.dispose();
    cityRendererHandle.value = null;
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
  layoutAbort = new AbortController();
  void handle.setLayout(store.layout, {
    generation: nextLayoutGeneration(), signal: layoutAbort.signal,
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
  const rect = el.getBoundingClientRect();
  if (rect.width < MIN_INLINE_SIZE) {
    available.value = false;
    cityRendererHandle.value?.dispose();
    cityRendererHandle.value = null;
    return;
  }
  available.value = true;
  if (rect.height <= 0) return;   // zero-size box: no-op, independent of the floor
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
  }
  const ratio = Math.min(win.devicePixelRatio || 1, MAX_PIXEL_RATIO);
  cityRendererHandle.value?.resize(rect.width, rect.height, ratio);
}

function applyMotionPreference(win: Window): void {
  const query = win.matchMedia('(prefers-reduced-motion: reduce)');
  cityRendererHandle.value?.setMotion(query.matches ? 'reduced' : 'standard');
}

onMounted(() => {
  cityStageHandle.value = stageEl.value;
  // Deferred one microtask so a test (or a future caller) can finish wiring this
  // element's `.win` before any measurement happens — mirrors the real host, where
  // Obsidian's prototype extension is already in place long before onMounted fires.
  void nextTick(() => {
    const el = stageEl.value;
    if (!el || !createRenderer) return;
    const win = winOf(el);
    resizeObserver = new (win as unknown as { ResizeObserver: typeof ResizeObserver }).ResizeObserver(() => {
      applySize();
    });
    resizeObserver.observe(el);
    applySize();
    applyMotionPreference(win);
  });
});

onBeforeUnmount(() => {
  resizeObserver?.disconnect();
  resizeObserver = null;
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
  </div>
</template>
