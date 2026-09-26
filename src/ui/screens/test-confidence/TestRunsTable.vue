<script setup lang="ts">
import type { EntityId } from '../../../domain/entity-id';
import { formatMetric, hasValue } from '../../evidence';
import { moduleLabel } from '../../read-models/file-summaries';
import type { TestRunRow } from '../../read-models/test-confidence';
import {
  TESTS_COL_DURATION, TESTS_COL_FILE, TESTS_COL_MODULE, TESTS_COL_RESULT, TESTS_COL_TESTS, TESTS_DURATION,
  TESTS_RESULT_FAILING, TESTS_RESULT_PASSING, TESTS_RUNS_CAPTION, TESTS_RUNS_NONE,
} from '../../inspector-copy';
import type { TableColumn } from '../../kit/table-types';
import EvidenceTable from '../../kit/EvidenceTable.vue';
import ProvenanceBadge from '../../kit/ProvenanceBadge.vue';
import UnknownEvidenceState from '../shared/UnknownEvidenceState.vue';

defineProps<{ runs: readonly TestRunRow[] }>();
const emit = defineEmits<{ open: [id: EntityId] }>();

const columns: readonly TableColumn<TestRunRow>[] = [
  { key: 'file', label: TESTS_COL_FILE, sortValue: (r) => r.file.path },
  { key: 'tests', label: TESTS_COL_TESTS, numeric: true, sortValue: (r) => r.tests.value ?? null },
  { key: 'result', label: TESTS_COL_RESULT, sortValue: (r) => r.failing.value ?? null },
  { key: 'module', label: TESTS_COL_MODULE, sortValue: (r) => moduleLabel(r.file.module) },
  { key: 'duration', label: TESTS_COL_DURATION, numeric: true, sortValue: (r) => r.durationMs.value ?? null },
];

/** An unknown failing count stays "—", never "Passing". */
function result(row: TestRunRow): { text: string; tone: 'unknown' | 'danger' | 'success' } {
  if (!hasValue(row.failing)) return { text: formatMetric(row.failing), tone: 'unknown' };
  return row.failing.value > 0
    ? { text: TESTS_RESULT_FAILING(row.failing.value), tone: 'danger' }
    : { text: TESTS_RESULT_PASSING, tone: 'success' };
}
</script>

<template>
  <UnknownEvidenceState
    v-if="runs.length === 0"
    :title="TESTS_RUNS_NONE"
    body=""
  />
  <EvidenceTable
    v-else
    :columns="columns"
    :rows="runs"
    :row-key="(r) => r.file.id"
    :caption="TESTS_RUNS_CAPTION"
    @activate="emit('open', $event.file.id)"
  >
    <template #cell-file="{ row }">
      <span class="ci-file-cell">
        <span class="ci-file-cell__name">{{ row.file.name }}</span>
        <span class="ci-file-cell__path">{{ row.file.path }}</span>
      </span>
    </template>
    <template #cell-tests="{ row }">
      {{ formatMetric(row.tests) }}
    </template>
    <template #cell-result="{ row }">
      <span
        class="ci-chip"
        :class="`ci-chip--${result(row).tone}`"
      >{{ result(row).text }}</span>
    </template>
    <template #cell-module="{ row }">
      {{ moduleLabel(row.file.module) }}
    </template>
    <template #cell-duration="{ row }">
      <span class="ci-tests__duration">
        {{ hasValue(row.durationMs) ? TESTS_DURATION(row.durationMs.value) : formatMetric(row.durationMs) }}
        <ProvenanceBadge :state="row.durationMs.state" />
      </span>
    </template>
  </EvidenceTable>
</template>
