<script setup lang="ts">
import { formatMetric } from '../../evidence';
import type { StewardshipRow } from '../../read-models/ownership';
import { ROOT_MODULE } from '../../read-models/file-summaries';
import {
  OWNERSHIP_COL_ACTIONS, OWNERSHIP_COL_CANDIDATES, OWNERSHIP_COL_CONCENTRATION, OWNERSHIP_COL_FILES,
  OWNERSHIP_COL_MODULE, OWNERSHIP_COL_TEAM, OWNERSHIP_SHOW_IN_CITY, OWNERSHIP_SHOW_IN_CITY_LABEL,
  OWNERSHIP_TABLE_CAPTION,
} from '../../inspector-copy';
import type { TableColumn } from '../../kit/table-types';
import EvidenceTable from '../../kit/EvidenceTable.vue';
import ProvenanceBadge from '../../kit/ProvenanceBadge.vue';

defineProps<{ rows: readonly StewardshipRow[] }>();
const emit = defineEmits<{ city: [module: string] }>();

const columns: readonly TableColumn<StewardshipRow>[] = [
  { key: 'module', label: OWNERSHIP_COL_MODULE, sortValue: (r) => r.label },
  { key: 'team', label: OWNERSHIP_COL_TEAM },
  { key: 'files', label: OWNERSHIP_COL_FILES, numeric: true, sortValue: (r) => r.files.value ?? null },
  { key: 'concentration', label: OWNERSHIP_COL_CONCENTRATION, numeric: true, sortValue: (r) => r.concentration.value ?? null },
  { key: 'candidates', label: OWNERSHIP_COL_CANDIDATES, numeric: true, sortValue: (r) => r.reviewCandidates.value ?? null },
  { key: 'actions', label: OWNERSHIP_COL_ACTIONS },
];
</script>

<template>
  <div class="ci-stewardship">
    <EvidenceTable
      :columns="columns"
      :rows="rows"
      :row-key="(r) => r.module"
      :caption="OWNERSHIP_TABLE_CAPTION"
      :interactive="false"
    >
      <template #cell-module="{ row }">
        {{ row.label }}
      </template>
      <template #cell-team="{ row }">
        <span class="ci-chip">{{ row.team.value }}</span>
        <ProvenanceBadge state="sample" />
      </template>
      <template #cell-files="{ row }">
        {{ formatMetric(row.files) }}
      </template>
      <template #cell-concentration="{ row }">
        {{ formatMetric(row.concentration, '%') }}
        <ProvenanceBadge state="sample" />
      </template>
      <template #cell-candidates="{ row }">
        {{ formatMetric(row.reviewCandidates) }}
        <ProvenanceBadge :state="row.reviewCandidates.state" />
      </template>
      <template #cell-actions="{ row }">
        <button
          v-if="row.module !== ROOT_MODULE"
          type="button"
          class="ci-stewardship__city"
          :aria-label="OWNERSHIP_SHOW_IN_CITY_LABEL(row.label)"
          @click="emit('city', row.module)"
        >
          {{ OWNERSHIP_SHOW_IN_CITY }}
        </button>
      </template>
    </EvidenceTable>
  </div>
</template>
