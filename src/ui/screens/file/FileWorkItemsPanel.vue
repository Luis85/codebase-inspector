<script setup lang="ts">
import type { WorkItem } from '../../stores/ports/review-repository';
import { FILE_NO_WORK_ITEMS, FILE_WORK_ITEMS_SUBTITLE, FILE_WORK_ITEMS_TITLE, WORK_ITEM_STATUS_LABEL } from '../../inspector-copy';
import Panel from '../../kit/Panel.vue';

defineProps<{ items: readonly WorkItem[] }>();
</script>

<template>
  <Panel
    :title="FILE_WORK_ITEMS_TITLE"
    :subtitle="FILE_WORK_ITEMS_SUBTITLE"
  >
    <ul
      v-if="items.length"
      class="ci-work-items"
    >
      <li
        v-for="w in items"
        :key="w.id"
      >
        <span class="ci-work-items__title">{{ w.title }}</span>
        <span class="ci-chip">{{ WORK_ITEM_STATUS_LABEL[w.status] }}</span>
      </li>
    </ul>
    <p
      v-else
      class="ci-note"
    >
      {{ FILE_NO_WORK_ITEMS }}
    </p>
  </Panel>
</template>
