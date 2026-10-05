<script setup lang="ts">
import type { EntityId } from '../../../domain/entity-id';
import { formatMetric } from '../../evidence';
import type { FileSummary } from '../../read-models/file-summaries';
import { HOTSPOTS_NO_RESULTS, HOTSPOTS_SHORTLIST_DETAIL } from '../../inspector-copy';

defineProps<{ files: readonly FileSummary[] }>();
const emit = defineEmits<{ open: [id: EntityId] }>();
</script>

<template>
  <ol
    v-if="files.length"
    class="ci-shortlist"
  >
    <li
      v-for="(f, i) in files"
      :key="f.id"
    >
      <button
        type="button"
        class="ci-shortlist__item"
        @click="emit('open', f.id)"
      >
        <span class="ci-shortlist__rank">{{ String(i + 1).padStart(2, '0') }}</span>
        <span class="ci-shortlist__text">
          <span class="ci-shortlist__name">{{ f.name }}</span>
          <span class="ci-shortlist__detail">{{ HOTSPOTS_SHORTLIST_DETAIL(formatMetric(f.complexity), formatMetric(f.commits90d), formatMetric(f.branchCoverage, '%')) }}</span>
        </span>
        <span class="ci-priority">{{ formatMetric(f.priority) }}</span>
      </button>
    </li>
  </ol>
  <p
    v-else
    class="ci-note"
  >
    {{ HOTSPOTS_NO_RESULTS }}
  </p>
</template>
