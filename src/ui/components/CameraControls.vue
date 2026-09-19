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
import { computed, onBeforeUnmount, onMounted } from 'vue';
import { useCityRendererHandle, useCityStageEl } from '../renderer-handle';
import { useCityStore } from '../stores/city-store';
import { cameraKeyCommand } from '../interaction/keymap';
import type { CameraKeyCommand } from '../interaction/keymap';

const BUTTON_ZOOM_FACTOR = 1.2;
const BUTTON_ROTATE_STEP = Math.PI / 8;
const BUTTON_PAN_STEP = 30;

const renderer = useCityRendererHandle();
const stage = useCityStageEl();
const store = useCityStore();

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
let listenerDoc: Document | null = null;
onMounted(() => {
  listenerDoc = stage.value?.doc ?? null;
  listenerDoc?.addEventListener('keydown', onKeydown);
});
onBeforeUnmount(() => {
  listenerDoc?.removeEventListener('keydown', onKeydown);
});
</script>

<template>
  <div
    class="ci-camera-controls"
    role="group"
    aria-label="Camera controls"
  >
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
</template>
