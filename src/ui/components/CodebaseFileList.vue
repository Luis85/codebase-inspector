<!--
  C07 — the HTML inventory list, and the one place this task's acceptance criterion 1
  ("HTML selection drives the canvas through setSelection") is actually satisfied:
  activating a row calls BOTH `cityStore.select()` (the store of record) and the live
  renderer's `setSelection()` directly, through the shared handle in
  renderer-handle.ts. The canvas-to-HTML direction (a pick in the 3D view driving this
  list) is task 10's — nothing here reads a renderer EVENT, only issues commands.

  Rows are native <button>s (never role="tree" — that is future, richer-than-WP-01
  tree semantics this component does not implement) with a roving tabindex: moving
  focus with the keyboard never selects, only Enter/click activation does.
-->
<script setup lang="ts">
import { computed } from 'vue';
import { useCityStore } from '../stores/city-store';
import { useCityRendererHandle } from '../renderer-handle';
import { useInspectorOpener } from '../drawer-focus';
import { formatCopy11 } from '../copy';
import type { EntityId } from '../../domain/entity-id';

const store = useCityStore();
const renderer = useCityRendererHandle();
const inspectorOpener = useInspectorOpener();

const fileEntities = computed(() => (store.snapshot?.entities.filter((e) => e.kind === 'file') ?? []));
const totalFileCount = computed(() => fileEntities.value.length);
const noMatches = computed(() => store.matchingIds !== null && store.matchingIds.size === 0);
const emptyCopy = computed(() => formatCopy11(totalFileCount.value, store.query));

function isDimmed(entityId: EntityId): boolean {
  return store.matchingIds !== null && !store.matchingIds.has(entityId);
}

function rovingTabIndex(entityId: EntityId): number {
  const focusTarget = store.focusedEntityId ?? fileEntities.value[0]?.id ?? null;
  return entityId === focusTarget ? 0 : -1;
}

/** Activating a row both selects it AND opens the inspector (task 9 fix round
 *  1, item 7 — this is the "opener" the narrow-drawer close returns focus to;
 *  `openInspector()` had no production caller at all before this). Captures
 *  `event.currentTarget` — the row button itself — through the shared handle
 *  so FileInspector's own close button knows where to return focus. */
function activate(entityId: EntityId, event: Event): void {
  store.select(entityId);
  renderer.value?.setSelection(entityId);
  inspectorOpener.value = event.currentTarget as HTMLElement;
  store.openInspector();
}
</script>

<template>
  <div class="ci-file-list">
    <ul class="ci-file-list__rows">
      <li
        v-for="entity in fileEntities"
        :key="entity.id"
      >
        <button
          type="button"
          class="ci-file-list__row"
          :class="{
            'ci-file-list__row--dimmed': isDimmed(entity.id),
            'ci-file-list__row--selected': entity.id === store.selectedEntityId,
          }"
          :tabindex="rovingTabIndex(entity.id)"
          :aria-pressed="entity.id === store.selectedEntityId"
          @click="activate(entity.id, $event)"
          @focus="store.focusRow(entity.id)"
        >
          {{ entity.path }}
        </button>
      </li>
    </ul>
    <p
      v-if="noMatches"
      class="ci-file-list__empty"
    >
      {{ emptyCopy }}
    </p>
  </div>
</template>
