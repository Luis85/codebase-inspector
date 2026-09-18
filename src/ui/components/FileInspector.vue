<!--
  C10 — the file inspector drawer. Shows the RAW measured values (source-unit lines
  and bytes), never the sqrt-scaled scene height layout.ts computed for the same
  file — that scaling exists only to keep the city's skyline readable, and this
  drawer's whole job is to say what is actually true about the file. Offers exactly
  two actions (spec §1, out-of-scope table: "any source-opening or open-in-editor
  action" is explicitly not WP-01): Focus and Copy relative path.

  Closing PRESERVES the selection — only `cityStore.clearSelection()` (never called
  from here) drops it.
-->
<script setup lang="ts">
import { computed, ref } from 'vue';
import { useCityStore } from '../stores/city-store';
import { useCityRendererHandle } from '../renderer-handle';
import { useClipboard } from '../clipboard';
import { COPY_27, formatUnavailableReason } from '../copy';
import type { Observation } from '../../domain/model';

const store = useCityStore();
const renderer = useCityRendererHandle();
const clipboard = useClipboard();

const liveMessage = ref('');
const copyFailed = ref(false);

const selectedEntity = computed(() => (
  store.snapshot?.entities.find((e) => e.id === store.selectedEntityId) ?? null
));

function observationFor(metricId: 'physical-lines' | 'byte-size'): Observation | null {
  const entityId = store.selectedEntityId;
  if (!entityId || !store.snapshot) return null;
  return store.snapshot.observations.find(
    (o) => o.entityId === entityId && o.measurement.metricId === metricId,
  ) ?? null;
}

const linesObs = computed(() => observationFor('physical-lines'));
const bytesObs = computed(() => observationFor('byte-size'));

function focusSelection(): void {
  if (store.selectedEntityId) renderer.value?.focus(store.selectedEntityId);
}

function close(): void {
  store.closeInspector();   // preserves selectedEntityId — never clearSelection()
}

async function copyRelativePath(): Promise<void> {
  const path = selectedEntity.value?.path;
  if (!path) return;
  try {
    await clipboard.writeText(path);
    copyFailed.value = false;
    liveMessage.value = COPY_27;
  } catch {
    copyFailed.value = true;
    liveMessage.value = '';
  }
}
</script>

<template>
  <aside
    v-if="store.inspectorOpen && selectedEntity"
    class="ci-inspector"
    aria-label="File inspector"
  >
    <div class="ci-inspector__header">
      <h3 class="ci-inspector__title">
        {{ selectedEntity.name }}
      </h3>
      <button
        type="button"
        aria-label="Close"
        class="ci-inspector__close"
        @click="close"
      >
        ×
      </button>
    </div>
    <dl class="ci-inspector__measurements">
      <dt>Physical lines</dt>
      <dd v-if="linesObs?.status === 'measured'">
        {{ linesObs.value }} lines
      </dd>
      <dd v-else>
        {{ formatUnavailableReason(linesObs?.reason ?? 'Not available.') }}
      </dd>
      <dt>Byte size</dt>
      <dd v-if="bytesObs?.status === 'measured'">
        {{ bytesObs.value }} bytes
      </dd>
      <dd v-else>
        {{ formatUnavailableReason(bytesObs?.reason ?? 'Not available.') }}
      </dd>
    </dl>
    <div class="ci-inspector__actions">
      <button
        type="button"
        aria-label="Focus"
        @click="focusSelection"
      >
        Focus
      </button>
      <button
        type="button"
        aria-label="Copy relative path"
        @click="copyRelativePath"
      >
        Copy relative path
      </button>
    </div>
    <label
      v-if="copyFailed"
      class="ci-inspector__fallback"
    >
      Select and copy manually:
      <input
        type="text"
        readonly
        :value="selectedEntity.path"
        aria-label="Relative path"
        @focus="($event.target as HTMLInputElement).select()"
      >
    </label>
    <p
      aria-live="polite"
      class="ci-inspector__live"
    >
      {{ liveMessage }}
    </p>
  </aside>
</template>
