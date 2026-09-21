<script setup lang="ts">
import { computed, ref } from 'vue';
import { CITY_EYEBROW, CITY_SUBTITLE, CITY_TITLE, CITY_VIEW_INVENTORY_LABEL } from '../inspector-copy';
import { useCityStore } from '../stores/city-store';
import PageHeader from '../kit/PageHeader.vue';
import Icon from '../kit/Icon.vue';
import CityWorkspace from './CityWorkspace.vue';
import CitySummaryCards from './city/CitySummaryCards.vue';

const store = useCityStore();
interface WorkspaceExposed { rendererHost: HTMLElement | null }
const workspace = ref<WorkspaceExposed | null>(null);
const rendererHost = computed(() => workspace.value?.rendererHost ?? null);
defineExpose({ rendererHost });
</script>

<template>
  <div class="ci-screen ci-screen--city">
    <div class="ci-city-screen__header">
      <PageHeader
        :eyebrow="CITY_EYEBROW"
        :title="CITY_TITLE"
        :subtitle="CITY_SUBTITLE"
      >
        <template #actions>
          <button
            type="button"
            class="ci-city-screen__inventory"
            @click="store.setViewMode('list')"
          >
            <Icon name="list" />
            {{ CITY_VIEW_INVENTORY_LABEL }}
          </button>
        </template>
      </PageHeader>
    </div>
    <CityWorkspace ref="workspace" />
    <CitySummaryCards v-if="store.snapshot" />
  </div>
</template>
