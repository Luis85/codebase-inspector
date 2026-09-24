<script setup lang="ts">
// WP-03 N21: the matched file edges (N5: only cycle hops and boundary violations) in the
// kit table, filtered by direction relative to the selected module and by source; the
// "Violations only" toggle keeps the edges whose module pair breaks one of your rules, as
// on the Map and the Matrix. At most EDGE_LIST_LIMIT rows (the table sorts the whole set
// first), then EDGE_LIST_HIDDEN(n). Every type is RELATION_TYPE_UNKNOWN (N6). Unresolved
// imports are listed below the table, never as edges. Report values are text only.
import { computed, ref } from 'vue';
import type { EntityId } from '../../../domain/entity-id';
import { edgeKey } from '../../read-models/architecture';
import { moduleLabel, moduleOf } from '../../read-models/file-summaries';
import type { RelationEdgeView, RelationModel, RelationSource } from '../../read-models/relations';
import {
  EDGE_COL_FROM, EDGE_COL_LINE, EDGE_COL_SOURCE, EDGE_COL_TO, EDGE_COL_TYPE, EDGE_DIRECTION_NO_MODULE,
  EDGE_DIRECTION_RELATIVE, EDGE_FILTER_ALL, EDGE_FILTER_DIRECTION,
  EDGE_FILTER_SOURCE, EDGE_LIST_HIDDEN, EDGE_TABLE_CAPTION, EDGES_NONE, FALLOW_NOT_ANALYSED, NO_VALUE, RELATION_MEMBER_UNMATCHED,
  RELATION_SOURCE_BOUNDARY, RELATION_SOURCE_CYCLE, RELATION_TYPE_UNKNOWN, RELATIONS_DIRECTION_IN, RELATIONS_DIRECTION_OUT,
  RELATIONS_STATIC_NOTE, UNRESOLVED_TITLE,
} from '../../inspector-copy';
import type { TableColumn } from '../../kit/table-types';
import EvidenceTable from '../../kit/EvidenceTable.vue';
import { EDGE_LIST_LIMIT } from './use-architecture-selection';

const props = defineProps<{
  relations: RelationModel; notAnalysed: boolean; selectedModule: string | null;
  violating: ReadonlySet<string>; violationsOnly: boolean;
}>();
const emit = defineEmits<{ 'open-file': [id: EntityId] }>();

type Direction = 'all' | 'out' | 'in';
const direction = ref<Direction>('all');
const source = ref<'all' | RelationSource>('all');
const DIRECTIONS: readonly { id: Direction; label: string }[] = [
  { id: 'all', label: EDGE_FILTER_ALL }, { id: 'out', label: RELATIONS_DIRECTION_OUT }, { id: 'in', label: RELATIONS_DIRECTION_IN },
];
const SOURCES: readonly { id: 'all' | RelationSource; label: string }[] = [
  { id: 'all', label: EDGE_FILTER_ALL }, { id: 'cycle', label: RELATION_SOURCE_CYCLE }, { id: 'boundary', label: RELATION_SOURCE_BOUNDARY },
];
const SOURCE_LABEL: Readonly<Record<RelationSource, string>> = { cycle: RELATION_SOURCE_CYCLE, boundary: RELATION_SOURCE_BOUNDARY };
const sourceText = (e: RelationEdgeView): string => e.sources.map((s) => SOURCE_LABEL[s]).join(', ');

const columns: readonly TableColumn<RelationEdgeView>[] = [
  { key: 'from', label: EDGE_COL_FROM, sortValue: (e) => e.fromPath },
  { key: 'to', label: EDGE_COL_TO, sortValue: (e) => e.toPath },
  { key: 'source', label: EDGE_COL_SOURCE, sortValue: sourceText },
  { key: 'line', label: EDGE_COL_LINE, numeric: true, sortValue: (e) => e.line },
  { key: 'type', label: EDGE_COL_TYPE },
];

const rows = computed(() => props.relations.edges.filter((e) => {
  const from = moduleOf(e.fromPath);
  const to = moduleOf(e.toPath);
  if (props.violationsOnly && !props.violating.has(edgeKey(from, to))) return false;
  if (source.value !== 'all' && !e.sources.includes(source.value)) return false;
  if (direction.value === 'all' || props.selectedModule === null) return true;
  return direction.value === 'out' ? from === props.selectedModule : to === props.selectedModule;
}));
const hidden = computed(() => Math.max(0, rows.value.length - EDGE_LIST_LIMIT));
</script>

<template>
  <div class="ci-edge-list">
    <p
      v-if="notAnalysed"
      class="ci-note"
    >
      {{ FALLOW_NOT_ANALYSED }}
    </p>
    <template v-else>
      <div class="ci-edge-list__filters">
        <label class="ci-edge-list__filter">
          {{ EDGE_FILTER_DIRECTION }}
          <select
            v-model="direction"
            class="dropdown"
          >
            <option
              v-for="d in DIRECTIONS"
              :key="d.id"
              :value="d.id"
            >{{ d.label }}</option>
          </select>
        </label>
        <label class="ci-edge-list__filter">
          {{ EDGE_FILTER_SOURCE }}
          <select
            v-model="source"
            class="dropdown"
          >
            <option
              v-for="s in SOURCES"
              :key="s.id"
              :value="s.id"
            >{{ s.label }}</option>
          </select>
        </label>
      </div>
      <p class="ci-edge-list__direction-note">
        {{ selectedModule === null ? EDGE_DIRECTION_NO_MODULE : EDGE_DIRECTION_RELATIVE(moduleLabel(selectedModule)) }}
      </p>
      <p
        v-if="rows.length === 0"
        class="ci-note"
      >
        {{ EDGES_NONE }}
      </p>
      <EvidenceTable
        v-else
        :columns="columns"
        :rows="rows"
        :row-key="(e) => `${e.from}->${e.to}`"
        :caption="EDGE_TABLE_CAPTION"
        :limit="EDGE_LIST_LIMIT"
        :interactive="false"
      >
        <template #cell-from="{ row }">
          <button
            type="button"
            class="ci-edge-list__from"
            @click="emit('open-file', row.from)"
          >
            {{ row.fromPath }}
          </button>
        </template>
        <template #cell-to="{ row }">
          <code>{{ row.toPath }}</code>
        </template>
        <template #cell-source="{ row }">
          {{ sourceText(row) }}
        </template>
        <template #cell-line="{ row }">
          {{ row.line ?? NO_VALUE }}
        </template>
        <template #cell-type>
          {{ RELATION_TYPE_UNKNOWN }}
        </template>
      </EvidenceTable>
      <p
        v-if="hidden > 0"
        class="ci-edge-list__hidden"
      >
        {{ EDGE_LIST_HIDDEN(hidden) }}
      </p>
      <p class="ci-note">
        {{ RELATIONS_STATIC_NOTE }}
      </p>
      <section
        v-if="relations.unresolved.length > 0"
        class="ci-edge-list__unresolved"
      >
        <h4 class="ci-edge-list__heading">
          {{ UNRESOLVED_TITLE }}
        </h4>
        <ul class="ci-edge-list__unresolved-list">
          <li
            v-for="(u, i) in relations.unresolved"
            :key="`${i}:${u.findingId}`"
          >
            <code>{{ u.file.path }}:{{ u.line }} → {{ u.specifier }}</code><span
              v-if="u.file.id === null"
              class="ci-edge-list__unmatched"
            > ({{ RELATION_MEMBER_UNMATCHED }})</span>
          </li>
        </ul>
      </section>
    </template>
  </div>
</template>
