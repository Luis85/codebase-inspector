<script setup lang="ts">
import { formatMetric } from '../../evidence';
import type { RuleEvaluation } from '../../read-models/architecture';
import { moduleLabel } from '../../read-models/file-summaries';
import {
  ARCH_ADD_RULE, RULE_COL_ACTIONS, RULE_COL_ID, RULE_COL_IMPORTS, RULE_COL_RULE, RULE_COL_STATUS, RULE_REMOVE,
  RULE_REMOVE_LABEL, RULE_SENTENCE, RULE_SHOW, RULE_SHOW_LABEL, RULE_STATUS_LABEL, RULES_EMPTY, RULES_TABLE_CAPTION,
} from '../../inspector-copy';
import type { TableColumn } from '../../kit/table-types';
import EvidenceTable from '../../kit/EvidenceTable.vue';
import ProvenanceBadge from '../../kit/ProvenanceBadge.vue';

defineProps<{ rules: readonly RuleEvaluation[] }>();
const emit = defineEmits<{ select: [id: string]; remove: [id: string]; add: [] }>();

const columns: readonly TableColumn<RuleEvaluation>[] = [
  { key: 'id', label: RULE_COL_ID, sortValue: (r) => r.rule.id },
  { key: 'rule', label: RULE_COL_RULE, sortValue: (r) => `${r.rule.from}->${r.rule.to}` },
  { key: 'status', label: RULE_COL_STATUS, sortValue: (r) => r.status },
  { key: 'imports', label: RULE_COL_IMPORTS, numeric: true, sortValue: (r) => r.violatingImports.value ?? null },
  { key: 'actions', label: RULE_COL_ACTIONS },
];
</script>

<template>
  <div
    v-if="rules.length === 0"
    class="ci-rule-table__empty"
  >
    <p>{{ RULES_EMPTY }}</p>
    <button
      type="button"
      class="mod-cta"
      @click="emit('add')"
    >
      {{ ARCH_ADD_RULE }}
    </button>
  </div>
  <EvidenceTable
    v-else
    :columns="columns"
    :rows="rules"
    :row-key="(r) => r.rule.id"
    :caption="RULES_TABLE_CAPTION"
    :interactive="false"
  >
    <template #cell-id="{ row }">
      <code>{{ row.rule.id }}</code>
    </template>
    <template #cell-rule="{ row }">
      {{ RULE_SENTENCE(moduleLabel(row.rule.from), moduleLabel(row.rule.to)) }}
    </template>
    <template #cell-status="{ row }">
      <span
        class="ci-rule-status"
        :class="`ci-rule-status--${row.status}`"
      >{{ RULE_STATUS_LABEL[row.status] }}</span>
      <ProvenanceBadge
        v-if="row.status !== 'not-evaluated'"
        state="sample"
      />
    </template>
    <template #cell-imports="{ row }">
      {{ formatMetric(row.violatingImports) }}
    </template>
    <template #cell-actions="{ row }">
      <button
        type="button"
        class="ci-rule-table__show"
        :aria-label="RULE_SHOW_LABEL(row.rule.id)"
        @click="emit('select', row.rule.id)"
      >
        {{ RULE_SHOW }}
      </button>
      <button
        type="button"
        class="ci-rule-table__remove"
        :aria-label="RULE_REMOVE_LABEL(row.rule.id)"
        @click="emit('remove', row.rule.id)"
      >
        {{ RULE_REMOVE }}
      </button>
    </template>
  </EvidenceTable>
</template>
