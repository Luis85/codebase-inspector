<script setup lang="ts">
import type { EntityId } from '../../../domain/entity-id';
import { formatMetric } from '../../evidence';
import type { FileSummary } from '../../read-models/file-summaries';
import { TABLE_PAGE } from '../../read-models/hotspots';
import {
  HOTSPOTS_COL_COMMITS, HOTSPOTS_COL_COMPLEXITY, HOTSPOTS_COL_COVERAGE, HOTSPOTS_COL_FILE, HOTSPOTS_COL_PRIORITY,
  HOTSPOTS_FILTER_PLACEHOLDER, HOTSPOTS_NO_RESULTS, HOTSPOTS_SHOW_MORE, HOTSPOTS_SORT_NOTE, HOTSPOTS_TABLE_TITLE,
} from '../../inspector-copy';
import type { TableColumn } from '../../kit/table-types';
import EvidenceTable from '../../kit/EvidenceTable.vue';

defineProps<{ rows: readonly FileSummary[]; limit: number }>();
const query = defineModel<string>('query', { required: true });
const emit = defineEmits<{ open: [id: EntityId]; more: [] }>();

const columns: readonly TableColumn<FileSummary>[] = [
  { key: 'file', label: HOTSPOTS_COL_FILE, sortValue: (r) => r.path },
  { key: 'priority', label: HOTSPOTS_COL_PRIORITY, numeric: true, sortValue: (r) => r.priority.value ?? null },
  { key: 'complexity', label: HOTSPOTS_COL_COMPLEXITY, numeric: true, sortValue: (r) => r.complexity.value ?? null },
  { key: 'commits', label: HOTSPOTS_COL_COMMITS, numeric: true, sortValue: (r) => r.commits90d.value ?? null },
  { key: 'coverage', label: HOTSPOTS_COL_COVERAGE, numeric: true, sortValue: (r) => r.branchCoverage.value ?? null },
];
</script>

<template>
  <div class="ci-hotspot-table">
    <div class="ci-hotspot-table__toolbar">
      <input
        v-model="query"
        type="search"
        :placeholder="HOTSPOTS_FILTER_PLACEHOLDER"
        :aria-label="HOTSPOTS_FILTER_PLACEHOLDER"
      >
      <span class="ci-hotspot-table__note">{{ HOTSPOTS_SORT_NOTE }}</span>
    </div>
    <p
      v-if="rows.length === 0"
      class="ci-hotspots__note"
    >
      {{ HOTSPOTS_NO_RESULTS }}
    </p>
    <EvidenceTable
      v-else
      :columns="columns"
      :rows="rows"
      :row-key="(r) => r.id"
      :caption="HOTSPOTS_TABLE_TITLE"
      :initial-sort="{ key: 'priority', dir: 'desc' }"
      :limit="limit"
      @activate="emit('open', $event.id)"
    >
      <template #cell-file="{ row }">
        <span class="ci-file-cell">
          <span class="ci-file-cell__name">{{ row.name }}</span>
          <span class="ci-file-cell__path">{{ row.path }}</span>
        </span>
      </template>
      <template #cell-priority="{ row }">
        <span class="ci-priority">{{ formatMetric(row.priority) }} / 100</span>
      </template>
      <template #cell-complexity="{ row }">
        {{ formatMetric(row.complexity) }}
      </template>
      <template #cell-commits="{ row }">
        {{ formatMetric(row.commits90d) }}
      </template>
      <template #cell-coverage="{ row }">
        {{ formatMetric(row.branchCoverage, '%') }}
      </template>
    </EvidenceTable>
    <button
      v-if="rows.length > limit"
      type="button"
      class="ci-hotspot-table__more"
      @click="emit('more')"
    >
      {{ HOTSPOTS_SHOW_MORE(Math.min(TABLE_PAGE, rows.length - limit)) }}
    </button>
  </div>
</template>
