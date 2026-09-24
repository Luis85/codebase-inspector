<script setup lang="ts">
// WP-03 N24: "Configured in fallow", under your rules on the Rules tab — one row per
// MATCHED boundary violation fallow reported (From, To, from_zone → to_zone, Line, Review
// finding). Read-only: nothing here writes a fallow config. Not configured shows
// FALLOW_BOUNDARIES_NOT_CONFIGURED and no table; no report (or no boundary section),
// FALLOW_NOT_ANALYSED. Report values are text only.
import { computed } from 'vue';
import type { BoundaryView, RelationModel } from '../../read-models/relations';
import {
  ARCH_FALLOW_ZONES_COL, ARCH_FALLOW_ZONES_NONE, ARCH_FALLOW_ZONES_TITLE, CYCLE_REVIEW, CYCLE_REVIEW_LABEL, EDGE_COL_FROM,
  EDGE_COL_LINE, EDGE_COL_TO, FALLOW_BOUNDARIES_NOT_CONFIGURED, FALLOW_NOT_ANALYSED, RULE_COL_ACTIONS,
} from '../../inspector-copy';
import type { TableColumn } from '../../kit/table-types';
import EvidenceTable from '../../kit/EvidenceTable.vue';
import Panel from '../../kit/Panel.vue';

const props = defineProps<{ relations: RelationModel }>();
const emit = defineEmits<{ review: [fingerprint: string] }>();

const rows = computed(() => props.relations.boundaryViolations.filter((v) => v.from.id !== null && v.to.id !== null));
const columns: readonly TableColumn<BoundaryView>[] = [
  { key: 'from', label: EDGE_COL_FROM, sortValue: (v) => v.from.path },
  { key: 'to', label: EDGE_COL_TO, sortValue: (v) => v.to.path },
  { key: 'zones', label: ARCH_FALLOW_ZONES_COL, sortValue: (v) => `${v.fromZone}->${v.toZone}` },
  { key: 'line', label: EDGE_COL_LINE, numeric: true, sortValue: (v) => v.line },
  { key: 'actions', label: RULE_COL_ACTIONS },
];
</script>

<template>
  <div class="ci-architecture__fallow">
    <Panel :title="ARCH_FALLOW_ZONES_TITLE">
      <p
        v-if="relations.boundaries === 'not-configured'"
        class="ci-note"
      >
        {{ FALLOW_BOUNDARIES_NOT_CONFIGURED }}
      </p>
      <p
        v-else-if="relations.boundaries !== 'configured'"
        class="ci-note"
      >
        {{ FALLOW_NOT_ANALYSED }}
      </p>
      <p
        v-else-if="rows.length === 0"
        class="ci-note"
      >
        {{ ARCH_FALLOW_ZONES_NONE }}
      </p>
      <EvidenceTable
        v-else
        :columns="columns"
        :rows="rows"
        :row-key="(v) => v.findingId"
        :caption="ARCH_FALLOW_ZONES_TITLE"
        :interactive="false"
      >
        <template #cell-from="{ row }">
          <code>{{ row.from.path }}</code>
        </template>
        <template #cell-to="{ row }">
          <code>{{ row.to.path }}</code>
        </template>
        <template #cell-zones="{ row }">
          {{ row.fromZone }} → {{ row.toZone }}
        </template>
        <template #cell-line="{ row }">
          {{ row.line }}
        </template>
        <template #cell-actions="{ row }">
          <button
            v-if="row.fingerprint !== null"
            type="button"
            class="ci-architecture__review"
            :aria-label="CYCLE_REVIEW_LABEL(row.findingId)"
            @click="emit('review', row.fingerprint)"
          >
            {{ CYCLE_REVIEW }}
          </button>
        </template>
      </EvidenceTable>
    </Panel>
  </div>
</template>
