<script setup lang="ts">
import { computed } from 'vue';
import { CHART_BARS_DESC, CHART_DATE_HEADER } from '../inspector-copy';
import { useUniqueId } from '../unique-id';
import { niceMax } from './chart-scale';

interface Bar { label: string; value: number }
const props = defineProps<{ bars: readonly Bar[]; label: string; valueLabel: string }>();

const W = 600; const H = 200; const PAD_L = 32; const PAD_B = 22; const PAD_T = 8; const GAP = 0.35;
// E13: the SVG is named by its own <title> and <desc>; the table below carries the values.
const titleId = useUniqueId('ci-bar-chart-title');
const descId = useUniqueId('ci-bar-chart-desc');

const yMax = computed(() => niceMax(Math.max(0, ...props.bars.map((b) => b.value))));
const ticks = computed(() => [0, 0.25, 0.5, 0.75, 1].map((t) => Math.round(t * yMax.value)));
const y = (v: number): number => PAD_T + (H - PAD_T - PAD_B) * (1 - v / yMax.value);
const slot = computed(() => (W - PAD_L - 8) / Math.max(1, props.bars.length));
const rects = computed(() => props.bars.map((b, i) => ({
  key: `${b.label}-${i}`, x: PAD_L + i * slot.value + (slot.value * GAP) / 2, width: slot.value * (1 - GAP),
  y: y(b.value), height: (H - PAD_B) - y(b.value), cx: PAD_L + (i + 0.5) * slot.value, label: b.label,
})));
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
