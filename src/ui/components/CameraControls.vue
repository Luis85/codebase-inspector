<!--
  C09 — WCAG 2.5.7's own requirement: EVERY dragging gesture (zoom, rotate both ways,
  pan all four directions) has a single-pointer (click) alternative here, plus Fit,
  Top and Focus. Button presses use the BUTTON increments (zoom x1.2, rotate pi/8, pan
  30 px); keyboard presses on the canvas itself use the KEYBOARD increments from
  keymap.ts (orbit 0.12 rad, zoom x1.15, pan 30 px — the same as the buttons, spec
  5.2). Key handling only ever listens while the canvas stage element (shared via
  renderer-handle.ts) is the document's own active element — never a host-wide
  Obsidian command/hotkey; this component never imports 'obsidian' at all.
-->
<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useCityRendererHandle, useCityStageEl } from '../renderer-handle';
import { useCityStore } from '../stores/city-store';
import { cameraKeyCommand } from '../interaction/keymap';
import type { CameraKeyCommand } from '../interaction/keymap';
import { contentBoxInlineSize, narrowContainer } from '../container-box';
import { DRAWER_MAX_INLINE_SIZE } from '../responsive';

const BUTTON_ZOOM_FACTOR = 1.2;
const BUTTON_ROTATE_STEP = Math.PI / 8;
const BUTTON_PAN_STEP = 30;

const renderer = useCityRendererHandle();
const stage = useCityStageEl();
const store = useCityStore();

// Task 10 (F5): explicit test/override seam for the disclosure's INITIAL state.
// jsdom has no layout engine, so camera-controls.test.ts pins the narrow case
// directly through this prop rather than faking a real ResizeObserver round trip;
// left unset (`undefined`) in production, where the real measurement below always
// wins. `undefined`, not a boolean default, is load-bearing — `false` would be
// indistinguishable from "the caller explicitly said not collapsed" — and `default:
// undefined` (via `withDefaults`, not a bare `defineProps`) is what that actually
// takes: a `Boolean`-typed prop Vue does not otherwise see a `default` key for is
// cast to `false` whenever it is ABSENT (Vue's own "an absent boolean attribute
// means false" convention for template usage), so a plain `defineProps<{
// stepsCollapsed?: boolean }>()` made every mount that never passes this prop at
// all -- every real one -- indistinguishable from one that explicitly passed
// `false`, permanently short-circuiting the real measurement below.
const props = withDefaults(defineProps<{ stepsCollapsed?: boolean }>(), { stepsCollapsed: undefined });

// Task 10: the six STEP controls (Rotate x2, Pan x4 — named for the STEP increments
// this file already defines, BUTTON_ROTATE_STEP/BUTTON_PAN_STEP, unlike
// BUTTON_ZOOM_FACTOR) collapse behind a disclosure below the SAME 820px leaf
// threshold App.vue's own Files drawer already uses (DRAWER_MAX_INLINE_SIZE) — one
// definition of "narrow" for the whole shell, not a second number invented here.
// `v-if` in the template below, never `hidden`/`v-show`: the cascade trap this
// stylesheet is exposed to (see CityHeader.vue's own comment) only bites an element
// the UA toggles via the `hidden` attribute or a `display` `v-show` writes; `v-if`
// removes the group from the DOM outright, so no author `display` declaration can
// ever silently re-enable it.
//
// `null` means "not yet knowable" — distinct from `true`/`false` — so a caller can
// tell "no opinion yet" from a real answer and never overwrite one with the other.
// A width of exactly 0 reads the same way (jsdom's own default rect, or a leaf
// paused behind a sibling tab, CityViewport's own zero-box guard): "narrow" would
// collapse a mount that has not measured anything real yet.
function computeStepsOpen(el: HTMLElement | null): boolean | null {
  if (props.stepsCollapsed !== undefined) return !props.stepsCollapsed;
  if (!el) return null;
  const width = contentBoxInlineSize(narrowContainer(el));
  return width > 0 ? width >= DRAWER_MAX_INLINE_SIZE : null;
}

// Computed SYNCHRONOUSLY at setup, not deferred to `onMounted` — `stage.value` is
// already resolved by the time setup runs (provide/inject, and every existing
// standalone mount's own `global.provide`), and a ref mutated only later, inside
// `onMounted`, would not reach the FIRST render until Vue's next microtask flush —
// a tick a synchronous `mount()` caller (this file's own tests included) never
// waits for. Defaults OPEN when not yet knowable: foundations/04 says a
// keyboard-only alternative is not sufficient, so a fresh mount must never start
// narrower than it needs to before it has measured anything.
const stepsOpen = ref(computeStepsOpen(stage.value) ?? true);

/** Re-applied once more from the shared stage watch below, for the one case the
 *  synchronous read above cannot cover: CameraControls is now a DOM descendant of
 *  CityViewport's own `.ci-viewport` (see the watch's own comment), so in the REAL
 *  host `stage.value` is still null at this component's OWN setup time and only
 *  becomes available once CityViewport's `onMounted` runs. A no-op whenever the
 *  synchronous read already had an answer (`props.stepsCollapsed` set, or a real
 *  measurement already came back non-zero). */
function applyStepsDefault(el: HTMLElement | null): void {
  const nextStepsOpen = computeStepsOpen(el);
  if (nextStepsOpen !== null) stepsOpen.value = nextStepsOpen;
}

function toggleSteps(): void { stepsOpen.value = !stepsOpen.value; }

function nudge(delta: { orbit?: [number, number]; pan?: [number, number]; zoomFactor?: number }): void {
  renderer.value?.nudgeCamera(delta);
}

function fit(): void { renderer.value?.fit(); }

// Phase 2 fix wave, C1 (Critical): Top is a TOGGLE, not a one-way door. Before this
// it hardcoded 'top' at both ends, so `setCameraMode('3d')` and `setViewMode('3d')`'s
// previous3dCamera restore had NO production caller anywhere in src/ — pressing Top
// removed the oblique view from that leaf permanently, across restarts (viewMode is
// persisted into CityViewState, and `returnFromList()` comes back to `lastSpatialMode`,
// which is 'top' by then). Spec 5.2 requires the round trip ("Top→3D restores the saved
// CameraBookmark in full; top-view operations never mutate it") and the rank-4 handoff's
// host gate asks a human to perform it. The rig and the store both already implemented
// it exactly; this is the caller they were missing. The `T` key reaches the SAME
// function (applyCommand below), so there is one toggle, not two.
const isTopView = computed(() => store.viewMode === 'top');
function top(): void {
  const next = isTopView.value ? '3d' : 'top';
  renderer.value?.setCameraMode(next);
  store.setViewMode(next);
}
function focusSelection(): void {
  if (store.selectedEntityId) renderer.value?.focus(store.selectedEntityId);
}

function applyCommand(command: CameraKeyCommand): void {
  if (command.kind === 'nudge') nudge(command.delta);
  else if (command.kind === 'fit') fit();
  else if (command.kind === 'top') top();
  else focusSelection();
}

function onKeydown(event: KeyboardEvent): void {
  if (event.target !== stage.value) return;   // only while the canvas itself has focus
  const command = cameraKeyCommand({
    key: event.key, shiftKey: event.shiftKey, ctrlKey: event.ctrlKey,
    metaKey: event.metaKey, altKey: event.altKey, composing: event.isComposing,
  });
  if (!command) return;
  event.preventDefault();
  applyCommand(command);
}

// No bare-global fallback (task 9 fix round 1, item 5, spec 4.4's cross-window
// rule): if the stage never mounted, this never attaches a listener, rather
// than reaching for the wrong window's `document`.
//
// Task 10: CameraControls is now composed INSIDE CityViewport's own `.ci-viewport`
// (CityStage.vue slots it in — see that file's own comment) rather than as its
// sibling, which its overlay positioning (`--overlay`, styles.css) requires: a
// `position: absolute` box only ever anchors against an ANCESTOR, and
// `.ci-viewport` is the one already `position: relative`. That makes CameraControls
// a CHILD of CityViewport in the component tree, and Vue mounts children before
// their own parent's `onMounted` — the OPPOSITE of the sibling order this relied on
// before (CityViewport, mounted first, already wrote the shared stage ref by the
// time its next sibling's `onMounted` ran). A plain one-time read here would
// silently find `stage.value` still null in the new nesting and never attach a
// listener at all. `watch(() => stage.value, ..., { immediate: true })` on a
// GETTER — not `watch(stage, ...)` — fires synchronously the moment this runs
// regardless of nesting: immediately if the value is already there (today's
// existing tests' plain-object CITY_STAGE_KEY double, and the real sibling case
// this is no longer used in), or the instant it is later assigned. Also drives the
// disclosure default (`applyStepsDefault`) off the very same signal.
let listenerDoc: Document | null = null;
let stopStageWatch: (() => void) | null = null;
onMounted(() => {
  stopStageWatch = watch(() => stage.value, (el) => {
    listenerDoc?.removeEventListener('keydown', onKeydown);
    listenerDoc = el?.doc ?? null;
    listenerDoc?.addEventListener('keydown', onKeydown);
    applyStepsDefault(el);
  }, { immediate: true });
});
onBeforeUnmount(() => {
  listenerDoc?.removeEventListener('keydown', onKeydown);
  stopStageWatch?.();
});
</script>

<template>
  <div
    class="ci-camera-controls ci-camera-controls--overlay"
    role="group"
    aria-label="Camera controls"
  >
    <!-- Task 10 (F5): the six STEP controls, behind a disclosure — collapsed by
         default under 820px (applyStepsDefault), always reachable by pointer in one
         click on `.ci-camera-controls__more` below. `v-if`, never `hidden`/`v-show`
         — see this file's own `stepsOpen` comment for why. -->
    <div
      v-if="stepsOpen"
      class="ci-camera-controls__steps"
    >
      <button
        type="button"
        aria-label="Rotate left"
        @click="nudge({ orbit: [-BUTTON_ROTATE_STEP, 0] })"
      >
        ↺
      </button>
      <button
        type="button"
        aria-label="Rotate right"
        @click="nudge({ orbit: [BUTTON_ROTATE_STEP, 0] })"
      >
        ↻
      </button>
      <button
        type="button"
        aria-label="Pan up"
        @click="nudge({ pan: [0, -BUTTON_PAN_STEP] })"
      >
        ↑
      </button>
      <button
        type="button"
        aria-label="Pan down"
        @click="nudge({ pan: [0, BUTTON_PAN_STEP] })"
      >
        ↓
      </button>
      <button
        type="button"
        aria-label="Pan left"
        @click="nudge({ pan: [-BUTTON_PAN_STEP, 0] })"
      >
        ←
      </button>
      <button
        type="button"
        aria-label="Pan right"
        @click="nudge({ pan: [BUTTON_PAN_STEP, 0] })"
      >
        →
      </button>
    </div>
    <div class="ci-camera-controls__primary">
      <button
        type="button"
        aria-label="Zoom in"
        @click="nudge({ zoomFactor: BUTTON_ZOOM_FACTOR })"
      >
        +
      </button>
      <button
        type="button"
        aria-label="Zoom out"
        @click="nudge({ zoomFactor: 1 / BUTTON_ZOOM_FACTOR })"
      >
        -
      </button>
      <!-- The disclosure toggle. No dedicated CSS selector: it is a plain <button>
           inside `.ci-camera-controls`, so the existing `.ci-camera-controls button`
           rule (M113: type-selector recipe, box-shadow: none, its own :hover) already
           covers it — tests/unit/host-cascade.test.ts's PLUGIN_SKINNED_BUTTONS entry
           for `.ci-camera-controls button` needs no addition for that reason. -->
      <button
        type="button"
        class="ci-camera-controls__more"
        :aria-expanded="stepsOpen ? 'true' : 'false'"
        aria-label="Rotate and pan controls"
        @click="toggleSteps"
      >
        ⋯
      </button>
      <button
        type="button"
        aria-label="Fit"
        @click="fit"
      >
        Fit
      </button>
      <!-- C1: one button, both directions. `aria-pressed` carries the state for
           assistive technology; the accessible name and the visible label say which
           way the NEXT press goes, because "Top" while already in top view reads as a
           control that does nothing (and, before this fix, was one). -->
      <button
        type="button"
        :aria-label="isTopView ? 'Return to 3D view' : 'Top'"
        :aria-pressed="isTopView ? 'true' : 'false'"
        @click="top"
      >
        {{ isTopView ? '3D' : 'Top' }}
      </button>
      <button
        type="button"
        aria-label="Focus"
        @click="focusSelection"
      >
        Focus
      </button>
    </div>
  </div>
</template>
