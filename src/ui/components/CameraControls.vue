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
import { onBeforeUnmount, onMounted } from 'vue';
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
function top(): void {
  renderer.value?.setCameraMode('top');
  store.setViewMode('top');
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

let listenerDoc: Document | null = null;
onMounted(() => {
  listenerDoc = stage.value?.ownerDocument ?? document;
  listenerDoc.addEventListener('keydown', onKeydown);
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
    <button
      type="button"
      aria-label="Top"
      @click="top"
    >
      Top
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
