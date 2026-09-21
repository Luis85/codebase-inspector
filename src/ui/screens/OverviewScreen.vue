<script setup lang="ts">
import { computed, inject } from 'vue';
import type { FileSummary } from '../read-models/file-summaries';
import type { Investigation } from '../read-models/overview';
import { useReadModels } from '../read-models/use-read-models';
import { useCityStore } from '../stores/city-store';
import { formatMetric } from '../evidence';
import {
  OVERVIEW_ALL_HOTSPOTS_LABEL, OVERVIEW_AUDIT_REPORT_LABEL, OVERVIEW_COMPARE_LABEL,
  OVERVIEW_COVERAGE_PANEL_SUBTITLE, OVERVIEW_COVERAGE_PANEL_TITLE, OVERVIEW_DATA_SOURCES_LABEL,
  OVERVIEW_EYEBROW, OVERVIEW_HOTSPOTS_PANEL_SUBTITLE, OVERVIEW_HOTSPOTS_PANEL_TITLE,
  OVERVIEW_INVESTIGATIONS_PANEL_SUBTITLE, OVERVIEW_INVESTIGATIONS_PANEL_TITLE, OVERVIEW_NO_SNAPSHOT,
  OVERVIEW_SIGNALS_PANEL_FOOTNOTE, OVERVIEW_SIGNALS_PANEL_SUBTITLE, OVERVIEW_SIGNALS_PANEL_TITLE,
  OVERVIEW_HOTSPOTS_TABLE_CAPTION, OVERVIEW_SUBTITLE, OVERVIEW_TITLE, OVERVIEW_VERDICT_BODY,
  OVERVIEW_VERDICT_TITLE, OVERVIEW_VIEW_EVOLUTION_LABEL,
  SAMPLE_DATA_DETAIL, SAMPLE_DATA_NOTICE,
} from '../inspector-copy';
import { COPY_02 } from '../copy';
import PageHeader from '../kit/PageHeader.vue';
import Callout from '../kit/Callout.vue';
import MetricCard from '../kit/MetricCard.vue';
import Panel from '../kit/Panel.vue';
import LineChart from '../kit/LineChart.vue';
import EvidenceTable from '../kit/EvidenceTable.vue';
import type { TableColumn } from '../kit/table-types';
import InvestigationList from './overview/InvestigationList.vue';
import EvidenceCoveragePanel from './overview/EvidenceCoveragePanel.vue';

const store = useCityStore();
const { overview } = useReadModels();
const onSelectCodebase = inject<() => void>('onSelectCodebase', () => {});
// The WP-01 scan states live only on the city route, so show it before the scan starts.
function selectCodebase(): void {
  store.navigate('city');
  onSelectCodebase();
}

// Controller ruling 1: absent evidence is never shown as 0. `cards` is a fixed
// four-element array (findings/coverage/architecture/hotspots) from buildOverviewModel,
// but the guard is kept anyway rather than assuming index [3] always exists.
const hotspotCountLabel = computed(() => {
  const card = overview.value?.cards[3];
  return card ? formatMetric(card.value) : '—';
});

const columns: readonly TableColumn<FileSummary>[] = [
  { key: 'file', label: 'File', sortValue: (r) => r.path },
  { key: 'complexity', label: 'Complexity', numeric: true, sortValue: (r) => r.complexity.value ?? null },
  { key: 'commits', label: 'Commits / 90d', numeric: true, sortValue: (r) => r.commits90d.value ?? null },
  { key: 'priority', label: 'Priority', numeric: true, sortValue: (r) => r.priority.value ?? null },
];

/** Selecting from any screen goes through the ONE selection owner and never moves the
 *  camera (city-store invariant); the file detail is a separate, explicit navigation. */
function openFile(row: FileSummary): void {
  store.select(row.id);
  store.navigate('file');
}

/** Same rule as `openFile`: an investigation that lands on a FILE in the city opens
 *  the inspector on it, rather than leaving a selection with no visible detail. */
function openInvestigation(item: Investigation): void {
  if (item.entityId) store.select(item.entityId);
  store.navigate(item.route);
  if (item.entityId && item.route === 'city') store.openInspector();
}
</script>

<template>
  <div class="ci-screen ci-screen--overview">
    <PageHeader
      :eyebrow="OVERVIEW_EYEBROW"
      :title="OVERVIEW_TITLE"
      :subtitle="OVERVIEW_SUBTITLE"
    >
      <template #actions>
        <button
          type="button"
          @click="store.navigate('evolution')"
        >
          {{ OVERVIEW_COMPARE_LABEL }}
        </button>
        <button
          type="button"
          @click="store.navigate('report')"
        >
          {{ OVERVIEW_AUDIT_REPORT_LABEL }}
        </button>
      </template>
    </PageHeader>

    <div
      v-if="!overview"
      class="ci-overview__empty"
    >
      <p>{{ OVERVIEW_NO_SNAPSHOT }}</p>
      <button
        type="button"
        class="mod-cta ci-overview__select-source"
        @click="selectCodebase"
      >
        {{ COPY_02 }}
      </button>
    </div>

    <template v-else>
      <Callout
        :title="OVERVIEW_VERDICT_TITLE"
        :badge="overview.usesSample ? SAMPLE_DATA_NOTICE : undefined"
      >
        {{ OVERVIEW_VERDICT_BODY(hotspotCountLabel, overview.fileCount) }}
        {{ overview.usesSample ? SAMPLE_DATA_DETAIL : '' }}
      </Callout>

      <div class="ci-overview__cards">
        <MetricCard
          v-for="card in overview.cards"
          :key="card.id"
          :label="card.label"
          :icon="card.icon"
          :value="card.value"
          :unit="card.unit"
          :caption="card.caption"
          :trend="card.trend"
          :tone="card.tone"
        />
      </div>

      <div class="ci-overview__grid">
        <Panel
          :title="OVERVIEW_SIGNALS_PANEL_TITLE"
          :subtitle="OVERVIEW_SIGNALS_PANEL_SUBTITLE"
          :footnote="OVERVIEW_SIGNALS_PANEL_FOOTNOTE"
        >
          <template #actions>
            <button
              type="button"
              @click="store.navigate('evolution')"
            >
              {{ OVERVIEW_VIEW_EVOLUTION_LABEL }}
            </button>
          </template>
          <LineChart
            :label="OVERVIEW_SIGNALS_PANEL_TITLE"
            :series="overview.series"
          />
        </Panel>
        <Panel
          :title="OVERVIEW_INVESTIGATIONS_PANEL_TITLE"
          :subtitle="OVERVIEW_INVESTIGATIONS_PANEL_SUBTITLE"
        >
          <InvestigationList
            :items="overview.investigations"
            @open="openInvestigation"
          />
        </Panel>
        <Panel
          :title="OVERVIEW_HOTSPOTS_PANEL_TITLE"
          :subtitle="OVERVIEW_HOTSPOTS_PANEL_SUBTITLE"
        >
          <template #actions>
            <button
              type="button"
              @click="store.navigate('hotspots')"
            >
              {{ OVERVIEW_ALL_HOTSPOTS_LABEL }}
            </button>
          </template>
          <EvidenceTable
            :columns="columns"
            :rows="overview.hotspots"
            :row-key="(r) => r.id"
            :caption="OVERVIEW_HOTSPOTS_TABLE_CAPTION"
            :initial-sort="{ key: 'priority', dir: 'desc' }"
            @activate="openFile"
          >
            <template #cell-file="{ row }">
              <span class="ci-file-cell">
                <span class="ci-file-cell__name">{{ row.name }}</span>
                <span class="ci-file-cell__path">{{ row.path }}</span>
              </span>
            </template>
            <template #cell-complexity="{ row }">
              {{ formatMetric(row.complexity) }}
            </template>
            <template #cell-commits="{ row }">
              {{ formatMetric(row.commits90d) }}
            </template>
            <template #cell-priority="{ row }">
              <span class="ci-priority">{{ formatMetric(row.priority) }} / 100</span>
            </template>
          </EvidenceTable>
        </Panel>
        <Panel
          :title="OVERVIEW_COVERAGE_PANEL_TITLE"
          :subtitle="OVERVIEW_COVERAGE_PANEL_SUBTITLE"
        >
          <template #actions>
            <button
              type="button"
              @click="store.navigate('sources')"
            >
              {{ OVERVIEW_DATA_SOURCES_LABEL }}
            </button>
          </template>
          <EvidenceCoveragePanel :rows="overview.coverage" />
        </Panel>
      </div>
    </template>
  </div>
</template>
