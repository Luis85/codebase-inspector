<script setup lang="ts">
// Part 3 Q8: the snapshots this leaf has shown in this session, newest first. Collected
// from the inventory; kept in memory only.
import { computed } from 'vue';
import { formatMetric } from '../../evidence';
import { snapshotEntryLabel, type JournalEntry } from '../../read-models/snapshot-comparison';
import { useUniqueId } from '../../unique-id';
import {
  EVOLUTION_JOURNAL_COMPARE, EVOLUTION_JOURNAL_CURRENT, EVOLUTION_JOURNAL_ENTRY, EVOLUTION_JOURNAL_ONE,
} from '../../inspector-copy';

const props = defineProps<{ entries: readonly JournalEntry[]; currentId: string }>();
const emit = defineEmits<{ compare: [baseId: string] }>();
const idPrefix = useUniqueId('ci-journal-entry');
/** Only an entry older than the one on screen can be a comparison base. */
const currentAt = computed(() => props.entries.findIndex((e) => e.snapshotId === props.currentId));
const canCompare = (i: number): boolean => currentAt.value >= 0 && i > currentAt.value;
</script>

<template>
  <div class="ci-journal-panel">
    <ol class="ci-journal">
      <li
        v-for="(e, i) in entries"
        :key="e.snapshotId"
        class="ci-journal__item"
        :class="{ 'ci-journal__item--current': e.snapshotId === currentId }"
      >
        <div
          :id="`${idPrefix}-${i}`"
          class="ci-journal__head"
        >
          <span class="ci-journal__date">{{ snapshotEntryLabel(e.capturedAt) }}</span>
        </div>
        <p class="ci-journal__summary">
          {{ EVOLUTION_JOURNAL_ENTRY(e.files, formatMetric(e.lines)) }}
        </p>
        <span
          v-if="e.snapshotId === currentId"
          class="ci-chip ci-journal__current"
        >{{ EVOLUTION_JOURNAL_CURRENT }}</span>
        <button
          v-else-if="canCompare(i)"
          type="button"
          class="ci-journal__compare"
          :aria-describedby="`${idPrefix}-${i}`"
          @click="emit('compare', e.snapshotId)"
        >
          {{ EVOLUTION_JOURNAL_COMPARE }}
        </button>
      </li>
    </ol>
    <p
      v-if="entries.length === 1"
      class="ci-note"
    >
      {{ EVOLUTION_JOURNAL_ONE }}
    </p>
  </div>
</template>
