<script setup lang="ts">
import type { LicenseRow } from '../../read-models/dependencies';
import {
  DEPS_COL_LICENSE, DEPS_COL_PACKAGES, DEPS_COL_RECORDED, DEPS_LICENSES_CAPTION, DEPS_RECORDED_OK, DEPS_RECORDED_REVIEW,
} from '../../inspector-copy';
import type { TableColumn } from '../../kit/table-types';
import EvidenceTable from '../../kit/EvidenceTable.vue';

defineProps<{ rows: readonly LicenseRow[] }>();

const columns: readonly TableColumn<LicenseRow>[] = [
  { key: 'license', label: DEPS_COL_LICENSE },
  { key: 'packages', label: DEPS_COL_PACKAGES, numeric: true },
  { key: 'recorded', label: DEPS_COL_RECORDED },
];
</script>

<template>
  <EvidenceTable
    :columns="columns"
    :rows="rows"
    :row-key="(r) => r.key"
    :caption="DEPS_LICENSES_CAPTION"
    :interactive="false"
  >
    <template #cell-license="{ row }">
      {{ row.label }}
    </template>
    <template #cell-packages="{ row }">
      {{ row.packages }}
    </template>
    <template #cell-recorded="{ row }">
      <span
        class="ci-chip"
        :class="row.needsReview ? 'ci-chip--warning' : 'ci-chip--success'"
      >{{ row.needsReview ? DEPS_RECORDED_REVIEW : DEPS_RECORDED_OK }}</span>
    </template>
  </EvidenceTable>
</template>
