<script setup lang="ts" generic="T">
import { computed, ref } from 'vue';
import type { RowKey, TableColumn } from './table-types';

const props = withDefaults(defineProps<{
  columns: readonly TableColumn<T>[];
  rows: readonly T[];
  rowKey: RowKey<T>;
  caption: string;
  initialSort?: { key: string; dir: 'asc' | 'desc' };
  limit?: number;
  /** E28/E45: a non-interactive table (e.g. LicenseTable) gets no row tabindex, click or
   *  keydown handler and no pointer/hover affordance — there is nothing to activate. Vue
   *  defaults an unpassed `boolean` prop to `false`, not `undefined`, so the default must
   *  be declared here rather than with a `?? true` fallback in a computed. */
  interactive?: boolean;
}>(), { initialSort: undefined, limit: undefined, interactive: true });
const withInteraction = computed(() => props.interactive);
const emit = defineEmits<{ activate: [row: T] }>();

const sortKey = ref<string | null>(props.initialSort?.key ?? null);
const sortDir = ref<'asc' | 'desc'>(props.initialSort?.dir ?? 'asc');

const sorted = computed(() => {
  const col = props.columns.find((c) => c.key === sortKey.value);
  if (!col?.sortValue) return props.rows;
  const get = col.sortValue;
  const sign = sortDir.value === 'asc' ? 1 : -1;
  return [...props.rows].sort((a, b) => {
    const va = get(a); const vb = get(b);
    if (va === null && vb === null) return 0;
    if (va === null) return 1;
    if (vb === null) return -1;
    if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * sign;
    return String(va).localeCompare(String(vb)) * sign;
  });
});

/** Part 2 P7: sort the WHOLE set, then show the first `limit` rows, so sorting a long
 *  table never re-orders only the rows that happen to be on screen. */
const visible = computed(() => (props.limit === undefined ? sorted.value : sorted.value.slice(0, props.limit)));

function toggleSort(key: string): void {
  if (sortKey.value === key) sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc';
  else { sortKey.value = key; sortDir.value = 'asc'; }
}

function ariaSort(key: string): 'ascending' | 'descending' | 'none' {
  if (sortKey.value !== key) return 'none';
  return sortDir.value === 'asc' ? 'ascending' : 'descending';
}

function onKey(event: KeyboardEvent, row: T): void {
  if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); emit('activate', row); }
}

/** E28/E45: no handler object at all for a non-interactive table, so `v-on` attaches
 *  no click/keydown listener to the row (not merely a handler that ignores the press). */
function rowListeners(row: T): Record<string, EventListener> {
  if (!withInteraction.value) return {};
  return { click: () => emit('activate', row), keydown: (evt) => onKey(evt as KeyboardEvent, row) };
}
</script>

<template>
  <table class="ci-table">
    <caption class="visually-hidden">
      {{ caption }}
    </caption>
    <thead>
      <tr>
        <th
          v-for="col in columns"
          :key="col.key"
          scope="col"
          :aria-sort="ariaSort(col.key)"
          :class="{ 'ci-table__num': col.numeric }"
        >
          <button
            v-if="col.sortValue"
            type="button"
            class="ci-table__sort"
            @click="toggleSort(col.key)"
          >
            {{ col.label }}
          </button>
          <span v-else>{{ col.label }}</span>
        </th>
      </tr>
    </thead>
    <tbody>
      <tr
        v-for="row in visible"
        :key="rowKey(row)"
        :tabindex="withInteraction ? 0 : undefined"
        class="ci-table__row"
        :class="{ 'ci-table__row--static': !withInteraction }"
        v-on="rowListeners(row)"
      >
        <td
          v-for="col in columns"
          :key="col.key"
          :class="{ 'ci-table__num': col.numeric }"
        >
          <slot
            :name="`cell-${col.key}`"
            :row="row"
          />
        </td>
      </tr>
    </tbody>
  </table>
</template>
