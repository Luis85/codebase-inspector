<script setup lang="ts">
import { WORK_STATUSES, type WorkRow } from '../../read-models/work-items';
import type { WorkPriority } from '../../stores/ports/review-repository';
import {
  WORK_INTENT_LABEL, WORK_ITEM_STATUS_LABEL, WORK_PRIORITY_LABEL, WORK_TARGET_MISSING, WORKBENCH_CHECKS, WORKBENCH_COL_CHECKS,
  WORKBENCH_COL_INTENT, WORKBENCH_COL_ITEM, WORKBENCH_COL_PRIORITY, WORKBENCH_COL_STATUS, WORKBENCH_COL_TARGET, WORKBENCH_LIST_CAPTION,
} from '../../inspector-copy';
import type { TableColumn } from '../../kit/table-types';
import EvidenceTable from '../../kit/EvidenceTable.vue';

defineProps<{ rows: readonly WorkRow[] }>();
const emit = defineEmits<{ open: [id: string] }>();

const PRIORITY_RANK: Readonly<Record<WorkPriority, number>> = { high: 0, medium: 1, low: 2 };
const columns: readonly TableColumn<WorkRow>[] = [
  { key: 'item', label: WORKBENCH_COL_ITEM, sortValue: (r) => r.item.title },
  { key: 'target', label: WORKBENCH_COL_TARGET, sortValue: (r) => r.target.detail },
  { key: 'intent', label: WORKBENCH_COL_INTENT, sortValue: (r) => r.item.intent },
  { key: 'status', label: WORKBENCH_COL_STATUS, sortValue: (r) => WORK_STATUSES.indexOf(r.item.status) },
  { key: 'priority', label: WORKBENCH_COL_PRIORITY, sortValue: (r) => PRIORITY_RANK[r.item.priority] },
  { key: 'checks', label: WORKBENCH_COL_CHECKS, numeric: true, sortValue: (r) => r.checksDone },
];
</script>

<template>
  <EvidenceTable
    :columns="columns"
    :rows="rows"
    :row-key="(r) => r.item.id"
    :caption="WORKBENCH_LIST_CAPTION"
    @activate="emit('open', $event.item.id)"
  >
    <template #cell-item="{ row }">
      <span class="ci-file-cell">
        <span class="ci-file-cell__name">{{ row.item.title }}</span>
        <span class="ci-file-cell__path">{{ row.item.id }}</span>
      </span>
    </template>
    <template #cell-target="{ row }">
      <span class="ci-file-cell">
        <span class="ci-file-cell__name">{{ row.target.name }}</span>
        <span class="ci-file-cell__path">{{ row.target.present ? row.target.detail : `${row.target.detail} · ${WORK_TARGET_MISSING}` }}</span>
      </span>
    </template>
    <template #cell-intent="{ row }">
      {{ WORK_INTENT_LABEL[row.item.intent] }}
    </template>
    <template #cell-status="{ row }">
      <span class="ci-chip">{{ WORK_ITEM_STATUS_LABEL[row.item.status] }}</span>
    </template>
    <template #cell-priority="{ row }">
      <span
        class="ci-chip"
        :class="`ci-chip--priority-${row.item.priority}`"
      >{{ WORK_PRIORITY_LABEL[row.item.priority] }}</span>
    </template>
    <template #cell-checks="{ row }">
      {{ WORKBENCH_CHECKS(row.checksDone) }}
    </template>
  </EvidenceTable>
</template>
