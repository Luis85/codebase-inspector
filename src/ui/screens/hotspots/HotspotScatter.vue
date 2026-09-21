<script setup lang="ts">
import { computed, ref } from 'vue';
import type { EntityId } from '../../../domain/entity-id';
import { formatMetric } from '../../evidence';
import { useRovingIndex } from '../../kit/use-roving-index';
import { CHURN_THRESHOLD, type HotspotPoint, type HotspotsModel } from '../../read-models/hotspots';
import { HIGH_COMPLEXITY } from '../../read-models/overview';
import {
  HOTSPOTS_BAND_LABEL, HOTSPOTS_DOT_LABEL, HOTSPOTS_QUADRANT_LABEL, HOTSPOTS_SCATTER_LABEL, HOTSPOTS_X_AXIS, HOTSPOTS_Y_AXIS,
} from '../../inspector-copy';

const props = defineProps<{ model: HotspotsModel; selectedId: EntityId | null }>();
const emit = defineEmits<{ select: [id: EntityId] }>();

const W = 640; const H = 340; const L = 48; const R = 12; const T = 12; const B = 40;
const R_MIN = 3; const R_MAX = 10; const TICKS = 5;
const BANDS = ['low', 'mid', 'high', 'unknown'] as const;

const sx = (v: number): number => L + (v / props.model.xMax) * (W - L - R);
const sy = (v: number): number => T + (1 - v / props.model.yMax) * (H - T - B);
const radius = (p: HotspotPoint): number => (p.lines === null ? R_MIN : R_MIN + (R_MAX - R_MIN) * Math.sqrt(p.lines / props.model.linesMax));
const ticks = (max: number): number[] => Array.from({ length: TICKS + 1 }, (_, i) => (max / TICKS) * i);
const quadrant = computed(() => {
  const { xMax, yMax } = props.model;
  if (xMax <= CHURN_THRESHOLD || yMax <= HIGH_COMPLEXITY) return null;
  return { x: sx(CHURN_THRESHOLD), y: sy(yMax), width: sx(xMax) - sx(CHURN_THRESHOLD), height: sy(HIGH_COMPLEXITY) - sy(yMax) };
});
const dotLabel = (p: HotspotPoint): string => HOTSPOTS_DOT_LABEL(
  p.file.name, formatMetric(p.file.complexity), formatMetric(p.file.commits90d), formatMetric(p.file.branchCoverage, '%'),
);

/** Roving tabindex: exactly one dot is a tab stop. Arrows walk the dots in priority
 *  order, Home and End jump, and Enter or Space selects. Selecting never navigates. */
const svg = ref<SVGSVGElement | null>(null);
const { active, onKeydown, setActive } = useRovingIndex({
  count: () => props.model.points.length,
  selectedIndex: () => props.model.points.findIndex((p) => p.file.id === props.selectedId),
  focusAt: (i) => svg.value?.querySelectorAll<SVGElement>('.ci-scatter__dot')[i]?.focus(),
  activate: (i) => {
    const p = props.model.points[i];
    if (p) emit('select', p.file.id);
  },
});
function onDot(i: number, id: EntityId): void {
  setActive(i);
  emit('select', id);
}
</script>

<template>
  <figure class="ci-scatter">
    <svg
      ref="svg"
      :viewBox="`0 0 ${W} ${H}`"
      role="group"
      :aria-label="HOTSPOTS_SCATTER_LABEL"
      @keydown="onKeydown"
    >
      <g aria-hidden="true">
        <rect
          v-if="quadrant"
          class="ci-scatter__quadrant"
          :x="quadrant.x"
          :y="quadrant.y"
          :width="quadrant.width"
          :height="quadrant.height"
        />
        <text
          v-if="quadrant"
          class="ci-scatter__quadrant-label"
          :x="W - R - 6"
          :y="T + 14"
          text-anchor="end"
        >{{ HOTSPOTS_QUADRANT_LABEL }}</text>
        <g class="ci-scatter__grid">
          <g
            v-for="t in ticks(model.yMax)"
            :key="`y${t}`"
          >
            <line
              :x1="L"
              :x2="W - R"
              :y1="sy(t)"
              :y2="sy(t)"
            />
            <text
              :x="L - 6"
              :y="sy(t) + 4"
              text-anchor="end"
            >{{ Math.round(t) }}</text>
          </g>
          <text
            v-for="t in ticks(model.xMax)"
            :key="`x${t}`"
            :x="sx(t)"
            :y="H - B + 16"
            text-anchor="middle"
          >{{ Math.round(t) }}</text>
          <text
            :x="(L + W - R) / 2"
            :y="H - 4"
            text-anchor="middle"
          >{{ HOTSPOTS_X_AXIS }}</text>
          <text
            :transform="`translate(12 ${(T + H - B) / 2}) rotate(-90)`"
            text-anchor="middle"
          >{{ HOTSPOTS_Y_AXIS }}</text>
        </g>
      </g>
      <circle
        v-for="(p, i) in model.points"
        :key="p.file.id"
        class="ci-scatter__dot"
        :class="[`ci-scatter__dot--${p.band}`, { 'ci-scatter__dot--ring': p.lines === null, 'ci-scatter__dot--selected': p.file.id === selectedId }]"
        :cx="sx(p.x)"
        :cy="sy(p.y)"
        :r="radius(p)"
        role="button"
        :data-entity-id="p.file.id"
        :tabindex="i === active ? 0 : -1"
        :aria-label="dotLabel(p)"
        :aria-pressed="p.file.id === selectedId"
        @click="onDot(i, p.file.id)"
      />
    </svg>
    <figcaption class="ci-scatter__legend">
      <span
        v-for="band in BANDS"
        :key="band"
        class="ci-scatter__key"
        :class="`ci-scatter__key--${band}`"
      >{{ HOTSPOTS_BAND_LABEL[band] }}</span>
    </figcaption>
  </figure>
</template>
