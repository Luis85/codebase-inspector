<script setup lang="ts">
import type { EntityId } from '../../../domain/entity-id';
import { formatMetric } from '../../evidence';
import type { FileSummary } from '../../read-models/file-summaries';
import { TABLE_PAGE } from '../../read-models/hotspots';
import { useReviewStore } from '../../stores/review-store';
import type { WorkTarget } from '../../stores/ports/review-repository';
import {
  SHOW_MORE, TESTS_COL_ACTIONS, TESTS_COL_BRANCHES, TESTS_COL_COMMITS, TESTS_COL_COVERAGE, TESTS_COL_FILE, TESTS_GAPS_CAPTION,
  TESTS_GAPS_NONE, TESTS_OPEN, TESTS_OPEN_LABEL, TESTS_PLAN, TESTS_PLAN_LABEL, TESTS_PLANNED, TESTS_PLANNED_LABEL,
} from '../../inspector-copy';
import type { TableColumn } from '../../kit/table-types';
import EvidenceTable from '../../kit/EvidenceTable.vue';

defineProps<{ rows: readonly FileSummary[]; limit: number }>();
const emit = defineEmits<{ plan: [file: FileSummary]; open: [id: EntityId]; more: [] }>();
const review = useReviewStore();

const columns: readonly TableColumn<FileSummary>[] = [
  { key: 'file', label: TESTS_COL_FILE, sortValue: (r) => r.path },
  { key: 'branches', label: TESTS_COL_BRANCHES, numeric: true, sortValue: (r) => r.branchesTotal.value ?? null },
  { key: 'coverage', label: TESTS_COL_COVERAGE, numeric: true, sortValue: (r) => r.branchCoverage.value ?? null },
  { key: 'commits', label: TESTS_COL_COMMITS, numeric: true, sortValue: (r) => r.commits90d.value ?? null },
  { key: 'actions', label: TESTS_COL_ACTIONS },
];

const target = (f: FileSummary): WorkTarget => ({ kind: 'file', entityId: f.id });
const planned = (f: FileSummary): boolean => review.hasWorkItem(target(f), 'tests');
/** Task 8 lesson: `disabled` on the focused button would drop focus to <body>, so a
 *  planned or pending row is `aria-disabled` and the press is ignored here instead. */
const blocked = (f: FileSummary): boolean => planned(f) || review.isPending(target(f), 'tests');
function plan(f: FileSummary): void {
  if (!blocked(f)) emit('plan', f);
}
</script>

<template>
  <div class="ci-coverage-gaps">
    <p
      v-if="rows.length === 0"
      class="ci-note"
    >
      {{ TESTS_GAPS_NONE }}
    </p>
    <template v-else>
      <EvidenceTable
        :columns="columns"
        :rows="rows"
        :row-key="(r) => r.id"
        :caption="TESTS_GAPS_CAPTION"
        :limit="limit"
        :interactive="false"
      >
        <template #cell-file="{ row }">
          <span class="ci-file-cell">
            <span class="ci-file-cell__name">{{ row.name }}</span>
            <span class="ci-file-cell__path">{{ row.path }}</span>
          </span>
        </template>
        <template #cell-branches="{ row }">
          {{ formatMetric(row.branchesCovered) }} / {{ formatMetric(row.branchesTotal) }}
        </template>
        <template #cell-coverage="{ row }">
          {{ formatMetric(row.branchCoverage, '%') }}
        </template>
        <template #cell-commits="{ row }">
          {{ formatMetric(row.commits90d) }}
        </template>
        <template #cell-actions="{ row }">
          <button
            type="button"
            class="ci-coverage-gaps__open"
            :aria-label="TESTS_OPEN_LABEL(row.name)"
            @click="emit('open', row.id)"
          >
            {{ TESTS_OPEN }}
          </button>
          <button
            type="button"
            class="ci-coverage-gaps__plan"
            :aria-label="planned(row) ? TESTS_PLANNED_LABEL(row.name) : TESTS_PLAN_LABEL(row.name)"
            :aria-disabled="blocked(row)"
            @click="plan(row)"
          >
            {{ planned(row) ? TESTS_PLANNED : TESTS_PLAN }}
          </button>
        </template>
      </EvidenceTable>
      <button
        v-if="rows.length > limit"
        type="button"
        class="ci-coverage-gaps__more"
        @click="emit('more')"
      >
        {{ SHOW_MORE(Math.min(TABLE_PAGE, rows.length - limit)) }}
      </button>
    </template>
  </div>
</template>
