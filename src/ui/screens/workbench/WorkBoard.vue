<script setup lang="ts">
import type { WorkColumn } from '../../read-models/work-items';
import {
  WORK_INTENT_LABEL, WORK_ITEM_STATUS_LABEL, WORK_PRIORITY_LABEL, WORK_TARGET_MISSING, WORKBENCH_CHECKS, WORKBENCH_COLUMN_COUNT,
} from '../../inspector-copy';

defineProps<{ columns: readonly WorkColumn[] }>();
const emit = defineEmits<{ open: [id: string] }>();
</script>

<template>
  <div class="ci-work-board">
    <section
      v-for="col in columns"
      :key="col.status"
      class="ci-work-board__column"
      :class="`ci-work-board__column--${col.status}`"
      :aria-label="WORK_ITEM_STATUS_LABEL[col.status]"
    >
      <h3 class="ci-work-board__heading">
        <span
          class="ci-work-board__dot"
          aria-hidden="true"
        />
        {{ WORK_ITEM_STATUS_LABEL[col.status] }}
        <span class="ci-work-board__count">{{ WORKBENCH_COLUMN_COUNT(col.rows.length) }}</span>
      </h3>
      <!-- W10: each card is a real button; no drag and drop. Spans, never <p>, inside a button (E20). -->
      <button
        v-for="row in col.rows"
        :key="row.item.id"
        type="button"
        class="ci-work-card"
        @click="emit('open', row.item.id)"
      >
        <span class="ci-work-card__head">
          <code class="ci-work-card__id">{{ row.item.id }}</code>
          <span
            class="ci-chip"
            :class="`ci-chip--priority-${row.item.priority}`"
          >{{ WORK_PRIORITY_LABEL[row.item.priority] }}</span>
        </span>
        <span class="ci-work-card__title">{{ row.item.title }}</span>
        <span class="ci-work-card__target">
          {{ row.target.name }}
          <span
            v-if="!row.target.present"
            class="ci-note"
          >{{ WORK_TARGET_MISSING }}</span>
        </span>
        <span class="ci-work-card__meta">
          <span>{{ WORK_INTENT_LABEL[row.item.intent] }}</span>
          <span>{{ WORKBENCH_CHECKS(row.checksDone) }}</span>
        </span>
      </button>
    </section>
  </div>
</template>
