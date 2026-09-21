<script setup lang="ts">
import { computed } from 'vue';
import { formatMetric, hasValue, type MetricValue } from '../evidence';
import Icon from './Icon.vue';
import ProvenanceBadge from './ProvenanceBadge.vue';
import Sparkline from './Sparkline.vue';

const props = withDefaults(defineProps<{
  label: string; icon: string; value: MetricValue; unit?: string; caption?: string;
  trend?: readonly number[] | null; tone?: 'warning' | 'success' | 'danger' | 'accent';
}>(), { unit: '', caption: undefined, trend: null, tone: 'accent' });

const shown = computed(() => formatMetric(props.value));
const known = computed(() => hasValue(props.value));
</script>

<template>
  <article
    class="ci-metric-card"
    :class="`ci-metric-card--${tone}`"
  >
    <header class="ci-metric-card__label">
      <Icon :name="icon" />
      <span>{{ label }}</span>
      <ProvenanceBadge
        v-if="value.state !== 'collected'"
        :state="value.state"
        :detail="value.provenance.detail"
      />
    </header>
    <div class="ci-metric-card__row">
      <p class="ci-metric-card__value">
        {{ shown }}<span
          v-if="known && unit"
          class="ci-metric-card__unit"
        >{{ unit }}</span>
      </p>
      <Sparkline
        v-if="trend && trend.length > 1"
        :values="trend"
        :label="`${label} trend`"
      />
    </div>
    <p
      v-if="!known && value.reason"
      class="ci-metric-card__reason"
    >
      {{ value.reason }}
    </p>
    <p
      v-else-if="caption"
      class="ci-metric-card__caption"
    >
      {{ caption }}
    </p>
  </article>
</template>
