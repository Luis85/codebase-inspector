<script setup lang="ts">
// Part 3 Q10: SAMPLE change coupling. Every row says it is correlation, never an import
// or a causal claim (E31/E38), and every rate carries a sample badge.
import { computed } from 'vue';
import type { EntityId } from '../../../domain/entity-id';
import { formatMetric, hasValue } from '../../evidence';
import type { CouplingRow } from '../../read-models/evolution';
import {
  EVOLUTION_COL_PAIR, EVOLUTION_COL_RATE, EVOLUTION_COL_SHARED, EVOLUTION_COUPLING_CAPTION, EVOLUTION_COUPLING_FOOTNOTE,
  EVOLUTION_COUPLING_NONE, EVOLUTION_COUPLING_ROW_NOTE,
} from '../../inspector-copy';
import type { TableColumn } from '../../kit/table-types';
import EvidenceTable from '../../kit/EvidenceTable.vue';
import ProvenanceBadge from '../../kit/ProvenanceBadge.vue';

const props = defineProps<{ rows: readonly CouplingRow[] }>();
const emit = defineEmits<{ open: [id: EntityId] }>();

const columns: readonly TableColumn<CouplingRow>[] = [
  { key: 'pair', label: EVOLUTION_COL_PAIR },
  { key: 'rate', label: EVOLUTION_COL_RATE, numeric: true },
  { key: 'shared', label: EVOLUTION_COL_SHARED, numeric: true },
];

/** The inline bar's length, once per row; an unknown rate draws no bar at all (never a
 *  0-length "value"). */
const rateWidths = computed(() => new Map(props.rows.map((row) => [
  row, hasValue(row.rate) ? `${Math.min(100, Math.max(0, row.rate.value))}%` : null,
])));
</script>

<template>
  <div class="ci-coupling">
    <template v-if="rows.length > 0">
      <EvidenceTable
        :columns="columns"
        :rows="rows"
        :row-key="(r) => `${r.a.id}|${r.b.id}`"
        :caption="EVOLUTION_COUPLING_CAPTION"
        @activate="(r) => emit('open', r.a.id)"
      >
        <template #cell-pair="{ row }">
          <span class="ci-file-cell">
            <span class="ci-file-cell__name">{{ row.a.name }}</span>
            <span class="ci-file-cell__path">↔ {{ row.b.path }}</span>
            <span class="ci-coupling__note">{{ EVOLUTION_COUPLING_ROW_NOTE }}</span>
          </span>
        </template>
        <template #cell-rate="{ row }">
          <span class="ci-coupling__rate-cell">
            <span
              v-if="rateWidths.get(row)"
              class="ci-coupling__rate"
              aria-hidden="true"
            ><span
              class="ci-coupling__rate-fill"
              :style="{ inlineSize: rateWidths.get(row) ?? undefined }"
            /></span>
            {{ formatMetric(row.rate, '%') }}
            <ProvenanceBadge state="sample" />
          </span>
        </template>
        <template #cell-shared="{ row }">
          {{ formatMetric(row.shared) }}
        </template>
      </EvidenceTable>
      <p class="ci-note">
        {{ EVOLUTION_COUPLING_FOOTNOTE }}
      </p>
    </template>
    <p
      v-else
      class="ci-note"
    >
      {{ EVOLUTION_COUPLING_NONE }}
    </p>
  </div>
</template>
