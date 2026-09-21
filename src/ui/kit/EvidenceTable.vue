<script setup lang="ts" generic="T">
import { computed, ref } from 'vue';
import type { RowKey, TableColumn } from './table-types';

const props = defineProps<{
  columns: readonly TableColumn<T>[];
  rows: readonly T[];
  rowKey: RowKey<T>;
  caption: string;
  initialSort?: { key: string; dir: 'asc' | 'desc' };
}>();
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
        v-for="row in sorted"
        :key="rowKey(row)"
        tabindex="0"
        class="ci-table__row"
        @click="emit('activate', row)"
        @keydown="onKey($event, row)"
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
