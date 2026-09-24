<script setup lang="ts">
// WP-03 N30/N31: the city file inspector's Relations section. Direction and Hops are
// segmented controls (buttons with aria-pressed) and Show arcs a checkbox, all on this leaf's
// relations store. The rows are the view's neighbourhood, and they are exactly the arcs the
// renderer draws (use-relation-renderer.ts reads the same view), so every arc has a
// keyboard-reachable text row. A row button selects that file and never moves the camera.
// N5/N6: RELATIONS_SCOPE_NOTE and RELATIONS_STATIC_NOTE always show; absent evidence reads
// FALLOW_NOT_ANALYSED, never "no imports". Stale evidence still lists rows, marked stale.
import { computed } from 'vue';
import type { EntityId } from '../../../domain/entity-id';
import { useCityStore } from '../../stores/city-store';
import { useRelationsStore, type RelationControlDirection } from '../../stores/relations-store';
import { useReadModels } from '../../read-models/use-read-models';
import { useCityRelations } from '../../read-models/use-city-relations';
import { canHighlight, type CityRelationRow } from '../../read-models/city-relations';
import type { RelationSource } from '../../read-models/relations';
import {
  CYCLE_KIND_LABEL, EDGES_NONE, FALLOW_NOT_ANALYSED, RELATION_HIDDEN, RELATION_ROW_LOCATION, RELATION_SOURCE_BOUNDARY, RELATION_SOURCE_CYCLE,
  RELATIONS_CYCLES_TITLE, RELATIONS_DIRECTION_BOTH, RELATIONS_DIRECTION_IN, RELATIONS_DIRECTION_LABEL, RELATIONS_DIRECTION_OUT,
  RELATIONS_HIGHLIGHT_CYCLE, RELATIONS_HIGHLIGHT_CYCLE_LABEL, RELATIONS_HOPS_LABEL, RELATIONS_NONE_FOR_FILE, RELATIONS_SCOPE_NOTE, RELATIONS_SHOW_ARCS,
  RELATIONS_STATIC_NOTE, RELATIONS_TITLE,
} from '../../inspector-copy';
import ProvenanceBadge from '../../kit/ProvenanceBadge.vue';
import CycleMembers from '../architecture/CycleMembers.vue';

const city = useCityStore();
const controls = useRelationsStore();
const view = useCityRelations();
const { relations } = useReadModels();

const DIRECTIONS: readonly { id: RelationControlDirection; label: string }[] = [
  { id: 'both', label: RELATIONS_DIRECTION_BOTH }, { id: 'out', label: RELATIONS_DIRECTION_OUT }, { id: 'in', label: RELATIONS_DIRECTION_IN },
];
const HOPS: readonly (1 | 2)[] = [1, 2];
const SOURCE_LABEL: Readonly<Record<RelationSource, string>> = { cycle: RELATION_SOURCE_CYCLE, boundary: RELATION_SOURCE_BOUNDARY };
const DIRECTION_LABEL: Readonly<Record<CityRelationRow['direction'], string>> = { out: RELATIONS_DIRECTION_OUT, in: RELATIONS_DIRECTION_IN };
const GLYPH: Readonly<Record<CityRelationRow['direction'], string>> = { out: '→', in: '←' };

const notAnalysed = computed(() => view.value.state === 'none' || !relations.value.analysed);
/** Both directions and no row means no evidenced edge at all (hop 2 needs a hop 1). */
const emptyText = computed(() => (controls.direction === 'both' ? RELATIONS_NONE_FOR_FILE : EDGES_NONE));
const showArcs = computed({ get: () => controls.showArcs, set: (v: boolean) => { controls.setShowArcs(v); } });
const highlightedId = computed(() => view.value.highlighted?.findingId ?? null);
const sourcesText = (r: CityRelationRow): string => r.sources.map((s) => SOURCE_LABEL[s]).join(', ');

const selectRow = (id: EntityId): void => { city.select(id); };
const toggleHighlight = (id: string): void => { controls.highlightCycle(highlightedId.value === id ? null : id); };
</script>

<template>
  <section class="ci-city-relations">
    <h4 class="ci-city-relations__title">
      {{ RELATIONS_TITLE }}
      <ProvenanceBadge
        v-if="view.state === 'stale'"
        state="stale"
      />
    </h4>
    <p
      v-if="notAnalysed"
      class="ci-note"
    >
      {{ FALLOW_NOT_ANALYSED }}
    </p>
    <template v-else>
      <div class="ci-city-relations__controls">
        <div
          class="ci-city-relations__segmented"
          role="group"
          :aria-label="RELATIONS_DIRECTION_LABEL"
        >
          <button
            v-for="d in DIRECTIONS"
            :key="d.id"
            type="button"
            :aria-pressed="controls.direction === d.id"
            @click="controls.setDirection(d.id)"
          >
            {{ d.label }}
          </button>
        </div>
        <div
          class="ci-city-relations__segmented"
          role="group"
          :aria-label="RELATIONS_HOPS_LABEL"
        >
          <button
            v-for="h in HOPS"
            :key="h"
            type="button"
            :aria-pressed="controls.hops === h"
            @click="controls.setHops(h)"
          >
            {{ h }}
          </button>
        </div>
        <label class="ci-city-relations__arcs">
          <input
            v-model="showArcs"
            type="checkbox"
          >
          {{ RELATIONS_SHOW_ARCS }}
        </label>
      </div>
      <p
        v-if="view.rows.length === 0"
        class="ci-note"
      >
        {{ emptyText }}
      </p>
      <ul
        v-else
        class="ci-city-relations__list"
      >
        <li
          v-for="(r, i) in view.rows"
          :key="`${i}:${r.otherId}`"
          class="ci-city-relations__row"
        >
          <button
            type="button"
            class="ci-city-relations__select"
            @click="selectRow(r.otherId)"
          >
            <span
              class="ci-city-relations__glyph"
              :class="`ci-city-relations__glyph--${r.direction}`"
              aria-hidden="true"
            >{{ GLYPH[r.direction] }}</span>
            <span class="visually-hidden">{{ DIRECTION_LABEL[r.direction] }}</span>
            <code class="ci-city-relations__path">{{ RELATION_ROW_LOCATION(r.otherPath, r.importerPath, r.line) }}</code>
            <span class="ci-city-relations__source">{{ sourcesText(r) }}</span>
            <span
              v-if="r.hop === 2"
              class="ci-city-relations__hop"
            >{{ RELATIONS_HOPS_LABEL }} {{ r.hop }}</span>
          </button>
        </li>
      </ul>
      <p
        v-if="view.hidden > 0"
        class="ci-city-relations__hidden"
      >
        {{ RELATION_HIDDEN(view.hidden) }}
      </p>
      <template v-if="view.cycles.length > 0">
        <h5 class="ci-city-relations__heading">
          {{ RELATIONS_CYCLES_TITLE }}
        </h5>
        <ul class="ci-city-relations__cycles">
          <li
            v-for="(c, i) in view.cycles"
            :key="`${i}:${c.findingId}`"
            class="ci-city-relations__cycle"
          >
            <span class="ci-city-relations__kind">{{ CYCLE_KIND_LABEL[c.kind] }}</span>
            <code v-if="c.matched && c.pathText !== ''">{{ c.pathText }}</code>
            <CycleMembers
              v-else
              :cycle="c"
            />
            <button
              v-if="canHighlight(c)"
              type="button"
              class="ci-city-relations__highlight"
              :aria-label="RELATIONS_HIGHLIGHT_CYCLE_LABEL(c.findingId)"
              :aria-pressed="highlightedId === c.findingId"
              @click="toggleHighlight(c.findingId)"
            >
              <span
                class="ci-city-relations__swatch"
                aria-hidden="true"
              />
              {{ RELATIONS_HIGHLIGHT_CYCLE }}
            </button>
            <p
              v-if="highlightedId === c.findingId && view.arcs !== null && view.highlightHidden > 0"
              class="ci-city-relations__hidden"
            >
              {{ RELATION_HIDDEN(view.highlightHidden) }}
            </p>
          </li>
        </ul>
      </template>
    </template>
    <p class="ci-note">
      {{ RELATIONS_SCOPE_NOTE }}
    </p>
    <p class="ci-note">
      {{ RELATIONS_STATIC_NOTE }}
    </p>
  </section>
</template>
