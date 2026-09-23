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
import { LENS_LEGEND_NONE, LENS_LEGEND_REPORTED } from '../inspector-copy';
import { useLensView } from '../read-models/use-lens-view';

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

/** Part 6 Y40: in the findings lens the city carries two meanings, so the legend states
 *  exactly those two. Reported lots keep their category colours (the swatches are the
 *  categories the reported, measured lots actually have); every other measured lot is the
 *  unavailable neutral, --ci-text-muted, the token theme-bridge.ts reads into it. */
const { active: lensActive, reported } = useLensView();
const reportedCategories = computed(() => {
  const ids = reported.value;
  if (!ids) return [];
  const present = new Set((store.layout?.lots ?? [])
    .filter((l) => l.metricState !== 'unavailable' && ids.has(l.entityId))
    .map((l) => l.colorKey));
  return CATEGORY_IDS.filter((id) => present.has(id));
});
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
    <ul
      v-if="lensActive"
      class="ci-legend__swatches"
    >
      <li class="ci-legend__entry">
        <span
          class="ci-legend__swatch-group"
          aria-hidden="true"
        >
          <span
            v-for="categoryId in reportedCategories"
            :key="categoryId"
            class="ci-legend__swatch"
            :style="{ background: `var(--ci-cat-${categoryId})` }"
          />
        </span>
        <span class="ci-legend__label">{{ LENS_LEGEND_REPORTED }}</span>
      </li>
      <li class="ci-legend__entry">
        <span
          class="ci-legend__swatch ci-legend__swatch--none"
          aria-hidden="true"
        />
        <span class="ci-legend__label">{{ LENS_LEGEND_NONE }}</span>
      </li>
    </ul>
    <ul
      v-else
      class="ci-legend__swatches"
    >
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
