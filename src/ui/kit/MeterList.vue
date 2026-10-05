<script setup lang="ts">
import { formatMetric, hasValue } from '../evidence';
import type { MeterItem } from './meter-types';
import ProvenanceBadge from './ProvenanceBadge.vue';

defineProps<{ items: readonly MeterItem[]; label: string }>();

/** A runtime width clamped to 0–100. Only called for a known value, so unknown never
 *  draws an empty bar that reads as 0. */
function width(item: MeterItem): string {
  return `${Math.max(0, Math.min(100, item.value.value ?? 0))}%`;
}
</script>

<template>
  <ul
    class="ci-meters"
    :aria-label="label"
  >
    <li
      v-for="item in items"
      :key="item.id"
      class="ci-meter"
      :aria-label="item.ariaLabel"
    >
      <span class="ci-meter__label">{{ item.label }}</span>
      <div
        class="ci-meter__track"
        aria-hidden="true"
      >
        <div
          v-if="hasValue(item.value)"
          class="ci-meter__fill"
          :class="`ci-meter__fill--${item.tone ?? 'accent'}`"
          :style="{ inlineSize: width(item) }"
        />
      </div>
      <span class="ci-meter__value">
        {{ formatMetric(item.value, '%') }}
        <ProvenanceBadge
          v-if="item.value.state !== 'collected'"
          :state="item.value.state"
        />
      </span>
    </li>
  </ul>
</template>
