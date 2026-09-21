<script setup lang="ts">
import { computed } from 'vue';
import { SNAPSHOT_LABEL } from '../inspector-copy';
import { useCityStore } from '../stores/city-store';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;
const store = useCityStore();

/** Part 1 lists only the snapshot on screen: snapshot history arrives with the backend
 *  phase (spec §9 A4). The control already exists so the layout and focus order are final. */
const label = computed(() => {
  const s = store.snapshot;
  if (!s) return 'No snapshot';
  const d = new Date(s.providerRun.capturedAt);
  return `Latest · ${MONTHS[d.getUTCMonth()] ?? ''} ${d.getUTCDate()}`;
});
</script>

<template>
  <label class="ci-snapshot-selector">
    <span class="visually-hidden">{{ SNAPSHOT_LABEL }}</span>
    <select
      :disabled="!store.snapshot"
      :value="store.snapshot?.snapshotId ?? ''"
    >
      <option :value="store.snapshot?.snapshotId ?? ''">{{ label }}</option>
    </select>
  </label>
</template>
