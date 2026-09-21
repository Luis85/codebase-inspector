<script setup lang="ts">
import { computed } from 'vue';

interface Point { label: string; value: number }
type Tone = 'success' | 'accent' | 'warning' | 'danger';
/** `tone` keys a series' colour to the series itself; without one, colour falls back to
 *  position (the first series success, the rest accent). */
interface Series { id: string; label: string; tone?: Tone; points: readonly Point[] }
const props = defineProps<{ series: readonly Series[]; label: string }>();

const W = 600; const H = 200; const PAD_L = 32; const PAD_B = 22; const PAD_T = 8;
const TICKS = [0, 25, 50, 75, 100];

const yMax = computed(() => Math.max(100, ...props.series.flatMap((s) => s.points.map((p) => p.value))));
const labels = computed(() => props.series[0]?.points.map((p) => p.label) ?? []);
const x = (i: number, n: number): number => PAD_L + (n > 1 ? (i * (W - PAD_L - 8)) / (n - 1) : 0);
const y = (v: number): number => PAD_T + (H - PAD_T - PAD_B) * (1 - v / yMax.value);

const toneOf = (s: Series, i: number): Tone => s.tone ?? (i === 0 ? 'success' : 'accent');
const paths = computed(() => props.series.map((s, si) => ({
  id: s.id, tone: toneOf(s, si),
  d: s.points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i, s.points.length).toFixed(1)},${y(p.value).toFixed(1)}`).join(' '),
})));
</script>

<template>
  <figure class="ci-line-chart">
    <svg
      :viewBox="`0 0 ${W} ${H}`"
      role="img"
      :aria-label="label"
    >
      <g class="ci-line-chart__grid">
        <g
          v-for="t in TICKS"
          :key="t"
        >
          <line
            :x1="PAD_L"
            :x2="W - 8"
            :y1="y(t * yMax / 100)"
            :y2="y(t * yMax / 100)"
          />
          <text
            :x="PAD_L - 6"
            :y="y(t * yMax / 100) + 4"
            text-anchor="end"
          >{{ Math.round(t * yMax / 100) }}</text>
        </g>
        <text
          v-for="(l, i) in labels"
          :key="l + i"
          :x="x(i, labels.length)"
          :y="H - 4"
          text-anchor="middle"
        >{{ l }}</text>
      </g>
      <path
        v-for="p in paths"
        :key="p.id"
        class="ci-line-chart__line"
        :class="`ci-line-chart__line--${p.tone}`"
        :d="p.d"
        fill="none"
      />
    </svg>
    <figcaption class="ci-line-chart__legend">
      <span
        v-for="(s, i) in series"
        :key="s.id"
        class="ci-line-chart__key"
        :class="`ci-line-chart__key--${toneOf(s, i)}`"
      >{{ s.label }}</span>
    </figcaption>
    <table class="visually-hidden">
      <caption>{{ label }}</caption>
      <thead>
        <tr>
          <th scope="col">
            Date
          </th>
          <th
            v-for="s in series"
            :key="s.id"
            scope="col"
          >
            {{ s.label }}
          </th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="(l, i) in labels"
          :key="l + i"
        >
          <th scope="row">
            {{ l }}
          </th>
          <td
            v-for="s in series"
            :key="s.id"
          >
            {{ s.points[i]?.value ?? '—' }}
          </td>
        </tr>
      </tbody>
    </table>
  </figure>
</template>
