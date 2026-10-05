<script setup lang="ts">
import { ref } from 'vue';
import type { EntityId } from '../../../domain/entity-id';
import { formatMetric } from '../../evidence';
import type { CoverageTile } from '../../read-models/test-confidence';
import { COVERAGE_BAND_LABEL, TESTS_MAP_LABEL, TESTS_TILE_LABEL } from '../../inspector-copy';
import { useRovingIndex } from '../../kit/use-roving-index';

const props = defineProps<{ tiles: readonly CoverageTile[]; selectedId: EntityId | null }>();
const emit = defineEmits<{ select: [id: EntityId] }>();

const BANDS = ['low', 'mid', 'high', 'unknown'] as const;
const tileLabel = (t: CoverageTile): string => TESTS_TILE_LABEL(t.file.name, formatMetric(t.file.branchCoverage, '%'));

/** E10: the same roving tabindex as the Hotspots scatter. Selecting never navigates. */
const map = ref<HTMLElement | null>(null);
const { active, onKeydown, setActive } = useRovingIndex({
  count: () => props.tiles.length,
  selectedIndex: () => props.tiles.findIndex((t) => t.file.id === props.selectedId),
  focusAt: (i) => map.value?.querySelectorAll<HTMLElement>('.ci-coverage-map__tile')[i]?.focus(),
  activate: (i) => {
    const t = props.tiles[i];
    if (t) emit('select', t.file.id);
  },
});
function onTile(i: number, id: EntityId): void {
  setActive(i);
  emit('select', id);
}
</script>

<template>
  <figure class="ci-coverage">
    <div
      ref="map"
      class="ci-coverage-map"
      role="group"
      :aria-label="TESTS_MAP_LABEL"
      @keydown="onKeydown"
    >
      <button
        v-for="(t, i) in tiles"
        :key="t.file.id"
        type="button"
        class="ci-coverage-map__tile"
        :class="`ci-coverage-map__tile--${t.band}`"
        :data-entity-id="t.file.id"
        :aria-label="tileLabel(t)"
        :aria-pressed="t.file.id === selectedId"
        :tabindex="i === active ? 0 : -1"
        @click="onTile(i, t.file.id)"
      />
    </div>
    <figcaption class="ci-band-legend">
      <span
        v-for="band in BANDS"
        :key="band"
        class="ci-band-legend__key"
        :class="`ci-band-legend__key--${band}`"
      >{{ COVERAGE_BAND_LABEL[band] }}</span>
    </figcaption>
  </figure>
</template>
