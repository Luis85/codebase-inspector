<!--
  C11 — names the metric scale actually in effect, the aggregation it is computed
  per (task 8: "per file", never a district statistic), and enumerates ONLY the
  categories this city actually contains (task 8, F6: the baseline printed all ten
  --ci-cat-* swatches while a real city contained two, so eight stood for nothing a
  user could see). `layout.scale.cap`/`clampedCount` are read verbatim from
  computeLayout's own output (task 4) — never re-derived here (task-9-context.md
  finding 5: clampedCount counts LOTS, filtered to entity.kind === 'file', and cap is
  in source units, never scene units).

  `.ci-legend__encoding` (task 8, C11/interactions-03) states the city's visual
  language beyond color: the equal-lot meaning, the outline selection encoding, and —
  only while this city actually has one — what the unknown marker means. Unknown is a
  METRIC STATE (CityLot.metricState), never a category, so it is never iterated
  alongside CATEGORY_IDS and never gets a swatch of its own.
-->
<script setup lang="ts">
import { computed } from 'vue';
import { useCityStore } from '../stores/city-store';
import { CATEGORY_IDS } from '../../domain/classify';
import { LEGEND_EQUAL_LOT, LEGEND_SELECTION_OUTLINE, LEGEND_UNKNOWN_MARKER } from '../copy';

const store = useCityStore();
const scale = computed(() => store.layout?.scale ?? null);

// Filtered by presence, iterating CATEGORY_IDS itself (not `[...new Set(...)]`) so
// the surviving order is the closed vocabulary's own canonical order, not whichever
// file the scanner happened to discover first.
const presentCategories = computed(() => {
  const lots = store.layout?.lots ?? [];
  const present = new Set(lots.map((l) => l.colorKey));
  return CATEGORY_IDS.filter((id) => present.has(id));
});

const hasUnavailableLot = computed(() => (store.layout?.lots ?? []).some((l) => l.metricState === 'unavailable'));
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
      {{ scale.name }} — cap {{ scale.cap }} {{ scale.unit }} per file, {{ scale.clampedCount }} clamped
    </p>
    <ul class="ci-legend__swatches">
      <li
        v-for="categoryId in presentCategories"
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
    <div class="ci-legend__encoding">
      <p>{{ LEGEND_EQUAL_LOT }}</p>
      <p>{{ LEGEND_SELECTION_OUTLINE }}</p>
      <p v-if="hasUnavailableLot">
        {{ LEGEND_UNKNOWN_MARKER }}
      </p>
    </div>
  </div>
</template>
