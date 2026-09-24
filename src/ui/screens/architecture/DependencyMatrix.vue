<script setup lang="ts">
import { computed } from 'vue';
import { formatMetric, hasValue } from '../../evidence';
import { edgeKey, type MatrixCell, type ModuleSummary } from '../../read-models/architecture';
import {
  ARCH_MATRIX_CAPTION, ARCH_MATRIX_CELL_LABEL, ARCH_MATRIX_CORNER, ARCH_MATRIX_NO_EDGE, ARCH_MATRIX_SELF, ARCH_NOT_ANALYSED_NOTE,
  FALLOW_NOT_ANALYSED,
} from '../../inspector-copy';

/** `notAnalysed` (N20): every cell is empty because nothing was analysed — the note and
 *  each empty cell's screen-reader text say so, never "no imports" (N5). */
const props = defineProps<{
  modules: readonly ModuleSummary[]; matrix: readonly (readonly MatrixCell[])[];
  violating: ReadonlySet<string>; violationsOnly: boolean; selectedEdge: { from: string; to: string } | null;
  notAnalysed: boolean;
}>();
const emit = defineEmits<{ 'select-edge': [edge: { from: string; to: string }] }>();

const labels = computed(() => new Map(props.modules.map((m) => [m.name, m.label])));
const labelOf = (name: string): string => labels.value.get(name) ?? name;
const maxImports = computed(() => Math.max(1, ...props.matrix.flat().flatMap((c) => (c.edge && hasValue(c.edge.imports) ? [c.edge.imports.value] : []))));
/** Intensity 1–4 from the edge's share of the largest edge; the number is always shown too. */
function level(cell: MatrixCell): number {
  const v = cell.edge?.imports.value;
  return v === undefined ? 1 : Math.max(1, Math.ceil((v / maxImports.value) * 4));
}
const isViolation = (c: MatrixCell): boolean => props.violating.has(edgeKey(c.from, c.to));
const isSelected = (c: MatrixCell): boolean => props.selectedEdge?.from === c.from && props.selectedEdge.to === c.to;
</script>

<template>
  <div class="ci-matrix__scroll">
    <table class="ci-matrix">
      <caption class="visually-hidden">
        {{ ARCH_MATRIX_CAPTION }}
      </caption>
      <thead>
        <tr>
          <th
            scope="col"
            class="ci-matrix__corner"
          >
            {{ ARCH_MATRIX_CORNER }}
          </th>
          <th
            v-for="m in modules"
            :key="m.name"
            scope="col"
          >
            {{ m.label }}
          </th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="(row, i) in matrix"
          :key="modules[i]?.name ?? i"
        >
          <th scope="row">
            {{ modules[i]?.label }}
          </th>
          <td
            v-for="cell in row"
            :key="cell.to"
            class="ci-matrix__td"
          >
            <template v-if="cell.from === cell.to">
              <span aria-hidden="true">—</span><span class="visually-hidden">{{ ARCH_MATRIX_SELF }}</span>
            </template>
            <button
              v-else-if="cell.edge"
              type="button"
              class="ci-matrix__cell"
              :class="[`ci-matrix__cell--l${level(cell)}`, {
                'ci-matrix__cell--violation': isViolation(cell),
                'ci-matrix__cell--dimmed': violationsOnly && !isViolation(cell),
                'ci-matrix__cell--selected': isSelected(cell),
              }]"
              :aria-pressed="isSelected(cell)"
              :aria-label="ARCH_MATRIX_CELL_LABEL(labelOf(cell.from), labelOf(cell.to), formatMetric(cell.edge.imports))"
              @click="emit('select-edge', { from: cell.from, to: cell.to })"
            >
              {{ formatMetric(cell.edge.imports) }}
            </button>
            <template v-else>
              <span aria-hidden="true">·</span><span class="visually-hidden">{{ notAnalysed ? FALLOW_NOT_ANALYSED : ARCH_MATRIX_NO_EDGE }}</span>
            </template>
          </td>
        </tr>
      </tbody>
    </table>
    <p
      v-if="notAnalysed"
      class="ci-architecture__note"
    >
      {{ ARCH_NOT_ANALYSED_NOTE }}
    </p>
  </div>
</template>
