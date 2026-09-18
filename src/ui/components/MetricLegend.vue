<!--
  C11 — names the metric scale actually in effect and enumerates the closed,
  ten-member category vocabulary (spec §4.1) via the ten --ci-cat-* custom
  properties this task owns. `layout.scale.cap`/`clampedCount` are read verbatim
  from computeLayout's own output (task 4) — never re-derived here (task-9-context.md
  finding 5: clampedCount counts LOTS, filtered to entity.kind === 'file', and cap is
  in source units, never scene units).
-->
<script setup lang="ts">
import { computed } from 'vue';
import { useCityStore } from '../stores/city-store';
import { CATEGORY_IDS } from '../../domain/classify';

const store = useCityStore();
const scale = computed(() => store.layout?.scale ?? null);
</script>

<template>
  <div
    class="ci-legend"
    aria-label="Metric legend"
  >
    <p
      v-if="scale"
      class="ci-legend__scale-name"
    >
      {{ scale.name }} — cap {{ scale.cap }} {{ scale.unit }}, {{ scale.clampedCount }} clamped
    </p>
    <ul class="ci-legend__swatches">
      <li
        v-for="categoryId in CATEGORY_IDS"
        :key="categoryId"
        class="ci-legend__entry"
      >
        <span
          class="ci-legend__swatch"
          :style="{ background: `var(--ci-cat-${categoryId})` }"
        />
        <span class="ci-legend__label">{{ categoryId }}</span>
      </li>
    </ul>
  </div>
</template>
