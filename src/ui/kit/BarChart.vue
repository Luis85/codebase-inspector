<script setup lang="ts">
import { computed } from 'vue';
import { CHART_BARS_DESC, CHART_DATE_HEADER } from '../inspector-copy';
import { useUniqueId } from '../unique-id';
import { niceTicks } from './chart-scale';

interface Bar { label: string; value: number }
const props = defineProps<{ bars: readonly Bar[]; label: string; valueLabel: string }>();

const W = 600; const H = 200; const PAD_L = 32; const PAD_B = 22; const PAD_T = 8; const GAP = 0.35;
// E13: the SVG is named by its own <title> and <desc>; the table below carries the values.
const titleId = useUniqueId('ci-bar-chart-title');
const descId = useUniqueId('ci-bar-chart-desc');

/** Geometry only: a negative or non-finite value draws an empty bar. The table fallback
 *  still lists the raw value. */
const heightValue = (v: number): number => (Number.isFinite(v) ? Math.max(0, v) : 0);
const scale = computed(() => niceTicks(Math.max(0, ...props.bars.map((b) => heightValue(b.value)))));
const yMax = computed(() => scale.value.max);
const ticks = computed(() => scale.value.ticks);
const y = (v: number): number => PAD_T + (H - PAD_T - PAD_B) * (1 - v / yMax.value);
const slot = computed(() => (W - PAD_L - 8) / Math.max(1, props.bars.length));
const rects = computed(() => props.bars.map((b, i) => {
  const top = y(heightValue(b.value));
  return {
    key: `${b.label}-${i}`, x: PAD_L + i * slot.value + (slot.value * GAP) / 2, width: slot.value * (1 - GAP),
    y: top, height: (H - PAD_B) - top, cx: PAD_L + (i + 0.5) * slot.value, label: b.label,
  };
}));
</script>

<template>
  <figure class="ci-bar-chart">
    <svg
      :viewBox="`0 0 ${W} ${H}`"
      role="img"
      :aria-labelledby="`${titleId} ${descId}`"
    >
      <title :id="titleId">{{ label }}</title>
      <desc :id="descId">{{ CHART_BARS_DESC(bars.length) }}</desc>
      <g class="ci-bar-chart__grid">
        <g
          v-for="t in ticks"
          :key="t"
        >
          <line
            :x1="PAD_L"
            :x2="W - 8"
            :y1="y(t)"
            :y2="y(t)"
          />
          <text
            :x="PAD_L - 6"
            :y="y(t) + 4"
            text-anchor="end"
          >{{ t }}</text>
        </g>
      </g>
      <rect
        v-for="r in rects"
        :key="r.key"
        class="ci-bar-chart__bar"
        :x="r.x"
        :y="r.y"
        :width="r.width"
        :height="r.height"
        rx="3"
      />
      <text
        v-for="r in rects"
        :key="`l-${r.key}`"
        class="ci-bar-chart__label"
        :x="r.cx"
        :y="H - 4"
        text-anchor="middle"
      >{{ r.label }}</text>
    </svg>
    <table class="visually-hidden">
      <caption>{{ label }}</caption>
      <thead>
        <tr>
          <th scope="col">
            {{ CHART_DATE_HEADER }}
          </th>
          <th scope="col">
            {{ valueLabel }}
          </th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="(b, i) in bars"
          :key="`${b.label}-${i}`"
        >
          <th scope="row">
            {{ b.label }}
          </th>
          <td>{{ b.value }}</td>
        </tr>
      </tbody>
    </table>
  </figure>
</template>
