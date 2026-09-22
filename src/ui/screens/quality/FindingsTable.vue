<script setup lang="ts">
import { FINDINGS_PAGE, SEVERITY_RANK, type QualityFinding } from '../../read-models/findings';
import {
  FINDING_KIND_LABEL, FINDING_STATUS_LABEL, QUALITY_COL_EVIDENCE, QUALITY_COL_FINDING, QUALITY_COL_LOCATION,
  QUALITY_COL_REVIEW, QUALITY_COL_SEVERITY, QUALITY_COL_STATUS, QUALITY_LOCATION, QUALITY_NO_MATCH, QUALITY_NO_MATCH_TITLE,
  QUALITY_REVIEW, QUALITY_REVIEW_LABEL, QUALITY_SHOWING, QUALITY_TABLE_CAPTION, RESET_FILTERS, SEVERITY_LABEL, SHOW_MORE,
} from '../../inspector-copy';
import type { TableColumn } from '../../kit/table-types';
import EvidenceTable from '../../kit/EvidenceTable.vue';
import ProvenanceBadge from '../../kit/ProvenanceBadge.vue';

defineProps<{ rows: readonly QualityFinding[]; limit: number }>();
const emit = defineEmits<{ open: [finding: QualityFinding]; more: []; reset: [] }>();

const columns: readonly TableColumn<QualityFinding>[] = [
  { key: 'severity', label: QUALITY_COL_SEVERITY, sortValue: (r) => SEVERITY_RANK[r.severity] },
  { key: 'finding', label: QUALITY_COL_FINDING },
  { key: 'location', label: QUALITY_COL_LOCATION, sortValue: (r) => r.file.path },
  { key: 'evidence', label: QUALITY_COL_EVIDENCE },
  { key: 'status', label: QUALITY_COL_STATUS },
  // V19 (E28/E45): the row is static; this real button is the one control per row.
  { key: 'open', label: QUALITY_COL_REVIEW },
];
</script>

<template>
  <div class="ci-findings-table">
    <div
      v-if="rows.length === 0"
      class="ci-findings-table__none ci-empty"
    >
      <p class="ci-empty__title">
        {{ QUALITY_NO_MATCH_TITLE }}
      </p>
      <p class="ci-note">
        {{ QUALITY_NO_MATCH }}
      </p>
      <button
        type="button"
        class="ci-findings-table__reset"
        @click="emit('reset')"
      >
        {{ RESET_FILTERS }}
      </button>
    </div>
    <template v-else>
      <EvidenceTable
        :columns="columns"
        :rows="rows"
        :row-key="(r) => r.fingerprint"
        :caption="QUALITY_TABLE_CAPTION"
        :initial-sort="{ key: 'severity', dir: 'asc' }"
        :limit="limit"
        :interactive="false"
      >
        <template #cell-severity="{ row }">
          <span
            class="ci-finding__severity"
            :class="`ci-finding__severity--${row.severity}`"
          >{{ SEVERITY_LABEL[row.severity] }}</span>
        </template>
        <template #cell-finding="{ row }">
          <span class="ci-file-cell">
            <span class="ci-file-cell__name">{{ row.title }}</span>
            <code class="ci-finding__id">{{ row.id }}</code>
          </span>
        </template>
        <template #cell-location="{ row }">
          <span class="ci-file-cell">
            <span class="ci-file-cell__name">{{ row.file.name }}</span>
            <span class="ci-file-cell__path">{{ QUALITY_LOCATION(row.line, row.moduleLabel) }}</span>
          </span>
        </template>
        <template #cell-evidence="{ row }">
          <span class="ci-findings-table__evidence">
            <span class="ci-chip">{{ FINDING_KIND_LABEL[row.kind] }}</span>
            <ProvenanceBadge state="sample" />
          </span>
        </template>
        <template #cell-status="{ row }">
          <span class="ci-findings-table__status">
            <span
              class="ci-chip"
              :class="`ci-chip--status-${row.status}`"
            >{{ FINDING_STATUS_LABEL[row.status] }}</span>
            <span
              v-if="row.status === 'dismissed' && row.reason"
              class="ci-findings-table__reason"
              :title="row.reason"
            >{{ row.reason }}</span>
          </span>
        </template>
        <template #cell-open="{ row }">
          <button
            type="button"
            class="ci-findings-table__open"
            :aria-label="QUALITY_REVIEW_LABEL(row.title, row.file.name)"
            @click="emit('open', row)"
          >
            {{ QUALITY_REVIEW }}
          </button>
        </template>
      </EvidenceTable>
      <div class="ci-findings-table__footer">
        <span class="ci-note">{{ QUALITY_SHOWING(Math.min(limit, rows.length), rows.length) }}</span>
        <button
          v-if="rows.length > limit"
          type="button"
          class="ci-findings-table__more"
          @click="emit('more')"
        >
          {{ SHOW_MORE(Math.min(FINDINGS_PAGE, rows.length - limit)) }}
        </button>
      </div>
    </template>
  </div>
</template>
