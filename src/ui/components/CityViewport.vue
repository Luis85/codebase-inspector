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
import { inject, nextTick, onBeforeUnmount, onMounted, ref } from 'vue';
import type {
  CityRendererEvent, CreateCityRenderer,
} from '../../visualization/renderer-port';
import { useCityRendererHandle, useCityStageEl } from '../renderer-handle';
import { COPY_14, CONTEXT_LOST_NOTICE } from '../copy';

const MIN_INLINE_SIZE = 320;     // spec 5.2 hard floor, CSS px
const MAX_PIXEL_RATIO = 2;

type UnavailableReason = 'unsupported' | 'context-lost' | 'initialization-failed';

const createRenderer = inject<CreateCityRenderer | null>('createCityRenderer', null);
const cityRendererHandle = useCityRendererHandle();
const cityStageHandle = useCityStageEl();

const stageEl = ref<HTMLElement | null>(null);
// Task 9 fix round 2, item 1: replaces the externally-injected `rendererAvailable`
// ref (now dead, and removed from city-view.ts/App.vue) — this component now
// determines "is the box wide enough" from its OWN measurement, the same
// measurement `applySize` already takes for the hard floor below.
const available = ref(true);
const unavailableReason = ref<UnavailableReason | null>(null);
let resizeObserver: ResizeObserver | null = null;

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
function handleRendererEvent(event: CityRendererEvent): void {
  if (event.type === 'unavailable') {
    unavailableReason.value = event.reason;
    cityRendererHandle.value?.dispose();
    cityRendererHandle.value = null;
  }
}

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
    cityRendererHandle.value = createRenderer(el, win, handleRendererEvent);
    // Task 9 fix round 3, item 2: a stale CONTEXT_LOST_NOTICE/COPY-14 must not
    // outlive the reconstruction spec 4.2 says follows it -- cleared exactly
    // where a new renderer actually starts existing again, never earlier.
    unavailableReason.value = null;
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
