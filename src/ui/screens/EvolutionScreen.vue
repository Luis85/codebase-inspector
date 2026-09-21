<script setup lang="ts">
// Part 3 Q8-Q10: the Evolution screen. Size, the snapshot count and the comparison are
// collected from this session's journal; activity, the coverage trend and change coupling
// are sample and labelled as such.
import { computed, ref } from 'vue';
import type { EntityId } from '../../domain/entity-id';
import type { ChangeWindow } from '../fixtures/sample-evolution';
import { evolutionModelFor, useReadModels } from '../read-models/use-read-models';
import { useCityStore } from '../stores/city-store';
import { useSnapshotJournal } from '../stores/snapshot-journal';
import {
  EVOLUTION_ACTIVITY_LABEL, EVOLUTION_ACTIVITY_SUBTITLE, EVOLUTION_ACTIVITY_TITLE, EVOLUTION_ACTIVITY_VALUE,
  EVOLUTION_COMPARE, EVOLUTION_COUPLING_SUBTITLE, EVOLUTION_COUPLING_TITLE, EVOLUTION_COVERAGE_LABEL,
  EVOLUTION_COVERAGE_NONE, EVOLUTION_COVERAGE_SUBTITLE, EVOLUTION_COVERAGE_TITLE, EVOLUTION_EYEBROW,
  EVOLUTION_JOURNAL_SUBTITLE, EVOLUTION_JOURNAL_TITLE, EVOLUTION_SUBTITLE, EVOLUTION_TITLE, EVOLUTION_WINDOW,
  EVOLUTION_WINDOW_LABEL,
} from '../inspector-copy';
import PageHeader from '../kit/PageHeader.vue';
import MetricCard from '../kit/MetricCard.vue';
import Panel from '../kit/Panel.vue';
import BarChart from '../kit/BarChart.vue';
import LineChart from '../kit/LineChart.vue';
import Icon from '../kit/Icon.vue';
import NoSnapshot from './NoSnapshot.vue';
import ChangeCouplingTable from './evolution/ChangeCouplingTable.vue';
import SnapshotJournal from './evolution/SnapshotJournal.vue';
import SnapshotComparisonDialog from './evolution/SnapshotComparisonDialog.vue';
import { useCanCompare } from './evolution/use-can-compare';

const WINDOWS: readonly ChangeWindow[] = [30, 90];

const store = useCityStore();
const journal = useSnapshotJournal();
const canCompare = useCanCompare();
const { files } = useReadModels();
// E24: never `window` in src/ui.
const changeWindow = ref<ChangeWindow>(90);
const comparing = ref<{ baseId?: string } | null>(null);

const model = computed(() => (store.snapshot
  ? evolutionModelFor(store.snapshot, files.value, journal.entries, changeWindow.value)
  : null));

/** Selecting goes through the one selection owner and never moves the camera. */
function openFile(id: EntityId): void {
  store.select(id);
  store.navigate('file');
}
</script>

<template>
  <div class="ci-screen ci-screen--evolution">
    <PageHeader
      :eyebrow="EVOLUTION_EYEBROW"
      :title="EVOLUTION_TITLE"
      :subtitle="EVOLUTION_SUBTITLE"
    >
      <template #actions>
        <div
          class="ci-evolution__window"
          role="group"
          :aria-label="EVOLUTION_WINDOW_LABEL"
        >
          <button
            v-for="days in WINDOWS"
            :key="days"
            type="button"
            :data-window="days"
            :aria-pressed="changeWindow === days"
            @click="changeWindow = days"
          >
            {{ EVOLUTION_WINDOW(days) }}
          </button>
        </div>
        <button
          v-if="canCompare"
          type="button"
          class="ci-evolution__compare"
          @click="comparing = {}"
        >
          <Icon name="arrow-up-down" />
          {{ EVOLUTION_COMPARE }}
        </button>
      </template>
    </PageHeader>
    <NoSnapshot v-if="!model" />
    <template v-else>
      <div class="ci-overview__cards">
        <MetricCard
          v-for="card in model.cards"
          :key="card.id"
          :label="card.label"
          :icon="card.icon"
          :value="card.value"
          :unit="card.unit"
          :caption="card.caption"
          :tone="card.tone"
        />
      </div>
      <div class="ci-overview__grid">
        <Panel
          :title="EVOLUTION_ACTIVITY_TITLE"
          :subtitle="EVOLUTION_ACTIVITY_SUBTITLE"
        >
          <BarChart
            :bars="model.activity"
            :label="EVOLUTION_ACTIVITY_LABEL"
            :value-label="EVOLUTION_ACTIVITY_VALUE"
          />
        </Panel>
        <Panel
          :title="EVOLUTION_COVERAGE_TITLE"
          :subtitle="EVOLUTION_COVERAGE_SUBTITLE"
        >
          <LineChart
            v-if="model.coverage.length > 0"
            :series="model.coverage"
            :label="EVOLUTION_COVERAGE_LABEL"
          />
          <p
            v-else
            class="ci-hotspots__note"
          >
            {{ EVOLUTION_COVERAGE_NONE }}
          </p>
        </Panel>
      </div>
      <div class="ci-overview__grid">
        <Panel
          :title="EVOLUTION_COUPLING_TITLE"
          :subtitle="EVOLUTION_COUPLING_SUBTITLE"
        >
          <ChangeCouplingTable
            :rows="model.coupling"
            @open="openFile"
          />
        </Panel>
        <Panel
          :title="EVOLUTION_JOURNAL_TITLE"
          :subtitle="EVOLUTION_JOURNAL_SUBTITLE"
        >
          <SnapshotJournal
            :entries="model.journal"
            :current-id="store.snapshot?.snapshotId ?? ''"
            @compare="comparing = { baseId: $event }"
          />
        </Panel>
      </div>
    </template>
    <SnapshotComparisonDialog
      v-if="comparing"
      v-bind="comparing.baseId ? { initialBaseId: comparing.baseId } : {}"
      @close="comparing = null"
    />
  </div>
</template>
