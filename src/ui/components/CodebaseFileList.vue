<!--
  C07 — the HTML inventory list. Activating a row writes `cityStore.select()`, the store
  of record, and nothing else: task 10 fix round 1, item 2 removed the direct
  `renderer.setSelection()` call that used to sit beside it, because a canvas pick had
  no equivalent and so the two surfaces disagreed. CityViewport now watches
  `store.selectedEntityId` and is the SINGLE path to the port, for both surfaces — this
  component neither imports the renderer handle nor issues a command to it. Its own test
  guards against the second path being reintroduced here.

  Rows are native <button>s (never role="tree" — that is future, richer-than-WP-01
  tree semantics this component does not implement) with a roving tabindex: moving
  focus with the keyboard never selects, only Enter/click activation does.
-->
<script setup lang="ts">
import { computed } from 'vue';
import { useCityStore } from '../stores/city-store';
import { useInspectorOpener } from '../drawer-focus';
import { formatCopy11 } from '../copy';
import type { EntityId } from '../../domain/entity-id';

const store = useCityStore();
const inspectorOpener = useInspectorOpener();

const fileEntities = computed(() => (store.snapshot?.entities.filter((e) => e.kind === 'file') ?? []));
const totalFileCount = computed(() => fileEntities.value.length);
const noMatches = computed(() => store.matchingIds !== null && store.matchingIds.size === 0);
const emptyCopy = computed(() => formatCopy11(totalFileCount.value, store.query));

// Phase 2c, ruling M102 (the IN-SCOPE half; windowing is deliberately not attempted --
// see the report). Both of these used to be called once PER ROW on every patch, and
// `rovingTabIndex` re-derived the single focus target inside each of those ~1,000 calls.
// Hoisted to two computeds, they are derived once per dependency change instead of once
// per row, and each row's own work becomes a Set lookup and an identity comparison.
const matchingIds = computed(() => store.matchingIds);
const focusTarget = computed(() => store.focusedEntityId ?? fileEntities.value[0]?.id ?? null);

function isDimmed(entityId: EntityId): boolean {
  return matchingIds.value !== null && !matchingIds.value.has(entityId);
}

function rovingTabIndex(entityId: EntityId): number {
  return entityId === focusTarget.value ? 0 : -1;
}

/** Activating a row both selects it AND opens the inspector (task 9 fix round
 *  1, item 7 — this is the "opener" the narrow-drawer close returns focus to;
 *  `openInspector()` had no production caller at all before this). Captures
 *  `event.currentTarget` — the row button itself — through the shared handle
 *  so FileInspector's own close button knows where to return focus. */
function activate(entityId: EntityId, event: Event): void {
  store.select(entityId);
  inspectorOpener.value = event.currentTarget as HTMLElement;
  store.openInspector();
}
</script>

<template>
  <div class="ci-file-list">
    <ul class="ci-file-list__rows">
      <!-- `v-memo` on the row: the ONLY things that can change a row's rendering are the
           three below, so a keystroke that changes `matchingIds` now re-patches only the
           rows whose dimming actually flipped, instead of all ~1,000. `entity.path` is
           included because the entity list itself can change under a new snapshot. -->
      <li
        v-for="entity in fileEntities"
        :key="entity.id"
        v-memo="[
          entity.path,
          entity.id === store.selectedEntityId,
          isDimmed(entity.id),
          rovingTabIndex(entity.id),
        ]"
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
