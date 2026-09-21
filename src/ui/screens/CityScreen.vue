<script setup lang="ts">
import { computed, ref } from 'vue';
import { CITY_EYEBROW, CITY_SUBTITLE, CITY_TITLE, CITY_VIEW_INVENTORY_LABEL, EVOLUTION_COMPARE } from '../inspector-copy';
import { useCityStore } from '../stores/city-store';
import { useSnapshotJournal } from '../stores/snapshot-journal';
import PageHeader from '../kit/PageHeader.vue';
import Icon from '../kit/Icon.vue';
import CityWorkspace from './CityWorkspace.vue';
import CitySummaryCards from './city/CitySummaryCards.vue';
import SnapshotComparisonDialog from './evolution/SnapshotComparisonDialog.vue';

const store = useCityStore();
const journal = useSnapshotJournal();
const comparing = ref(false);
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
          <!-- Shown once the session journal holds two snapshots (Part 3 Q9). There is
               still no "activate snapshot" (A4): this only compares. -->
          <button
            v-if="journal.entries.length >= 2"
            type="button"
            class="ci-city-screen__compare"
            @click="comparing = true"
          >
            <Icon name="arrow-up-down" />
            {{ EVOLUTION_COMPARE }}
          </button>
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
    <SnapshotComparisonDialog
      v-if="comparing"
      @close="comparing = false"
    />
  </div>
</template>
