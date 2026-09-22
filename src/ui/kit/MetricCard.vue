<script setup lang="ts">
import { computed } from 'vue';
import { formatMetric, hasValue, isSampleBacked, type MetricValue } from '../evidence';
import { SAMPLE_BADGE_DETAIL } from '../inspector-copy';
import Icon from './Icon.vue';
import ProvenanceBadge from './ProvenanceBadge.vue';
import Sparkline from './Sparkline.vue';

const props = withDefaults(defineProps<{
  label: string; icon: string; value: MetricValue; unit?: string; caption?: string;
  trend?: readonly number[] | null; tone?: 'warning' | 'success' | 'danger' | 'accent';
}>(), { unit: '', caption: undefined, trend: null, tone: 'accent' });

const shown = computed(() => formatMetric(props.value));
const known = computed(() => hasValue(props.value));
/** Part 4 E55: a partial/stale aggregate can still rest on sample inputs; that fact is
 *  marked in addition to its own state, never in place of it. */
const alsoSample = computed(() => props.value.state !== 'sample' && isSampleBacked(props.value));
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
      <ProvenanceBadge
        v-if="alsoSample"
        class="ci-metric-card__sample"
        state="sample"
        :detail="SAMPLE_BADGE_DETAIL"
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
