<script setup lang="ts">
import { formatMetric } from '../../evidence';
import type { FileDetailModel } from '../../read-models/file-detail';
import {
  FILE_ADD_WORK_ITEM, FILE_COMMITS_CHIP, FILE_EYEBROW, FILE_INSPECT_ARCHITECTURE, FILE_SAMPLE_CHIP, FILE_SHOW_IN_CITY,
  IN_PLAN_LABEL,
} from '../../inspector-copy';
import PageHeader from '../../kit/PageHeader.vue';
import Icon from '../../kit/Icon.vue';

defineProps<{ detail: FileDetailModel; inPlan: boolean; pending: boolean }>();
const emit = defineEmits<{ 'show-in-city': []; 'inspect-architecture': []; 'add-work-item': [] }>();
</script>

<template>
  <div class="ci-file-header">
    <PageHeader
      :eyebrow="FILE_EYEBROW"
      :title="detail.file.name"
      :subtitle="detail.file.path"
    >
      <template #actions>
        <button
          type="button"
          class="ci-file-detail__city"
          @click="emit('show-in-city')"
        >
          <Icon name="building-2" />
          {{ FILE_SHOW_IN_CITY }}
        </button>
        <button
          type="button"
          class="ci-file-detail__architecture"
          @click="emit('inspect-architecture')"
        >
          <Icon name="network" />
          {{ FILE_INSPECT_ARCHITECTURE }}
        </button>
        <button
          type="button"
          class="mod-cta ci-file-detail__add"
          :disabled="inPlan || pending"
          @click="emit('add-work-item')"
        >
          <Icon name="plus" />
          {{ inPlan ? IN_PLAN_LABEL : FILE_ADD_WORK_ITEM }}
        </button>
      </template>
    </PageHeader>
    <ul class="ci-file-header__chips">
      <li class="ci-chip">
        {{ detail.moduleLabel }}
      </li>
      <li class="ci-chip">
        {{ FILE_COMMITS_CHIP(formatMetric(detail.file.commits90d)) }}
      </li>
      <li
        v-if="detail.usesSample"
        class="ci-chip ci-chip--sample"
      >
        {{ FILE_SAMPLE_CHIP }}
      </li>
    </ul>
  </div>
</template>
