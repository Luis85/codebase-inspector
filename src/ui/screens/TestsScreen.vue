<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import type { EntityId } from '../../domain/entity-id';
import { formatMetric, hasValue, sumEvidence } from '../evidence';
import { downloadText } from '../export/download';
import type { FileSummary } from '../read-models/file-summaries';
import { TABLE_PAGE } from '../read-models/hotspots';
import { GAP_THRESHOLD, coverageTiles, gapsCsv } from '../read-models/test-confidence';
import { useReadModels } from '../read-models/use-read-models';
import { useCityStore } from '../stores/city-store';
import { useReviewStore } from '../stores/review-store';
import { useUniqueId } from '../unique-id';
import {
  CONFIGURE_EVIDENCE, EVIDENCE_SOURCE_NONE, EVIDENCE_SOURCE_SAMPLE, EXPORT_FAILED, HOTSPOTS_ALL_MODULES,
  HOTSPOTS_MODULE_FILTER, MUTATION_EMPTY, MUTATION_EMPTY_TITLE, MUTATION_SUBTITLE, MUTATION_TITLE, TESTS_EVIDENCE,
  TESTS_EXPORT, TESTS_CSV_FILENAME, TESTS_EYEBROW, TESTS_GAPS_SUBTITLE, TESTS_GAPS_TITLE, TESTS_MAP_FOOTNOTE,
  TESTS_MAP_SUBTITLE, TESTS_MAP_TITLE, TESTS_MODULE_BAR_LABEL, TESTS_MODULES_HIDDEN, TESTS_MODULES_LABEL,
  TESTS_MODULES_SUBTITLE, TESTS_MODULES_TITLE, TESTS_OPEN_FILE, TESTS_PLAN_ADDED, TESTS_PLAN_FAILED, TESTS_PLAN_TITLE,
  TESTS_RUNS_SUBTITLE, TESTS_RUNS_TITLE, TESTS_SELECTED, TESTS_SHOWING, TESTS_SOURCE_LABELS, TESTS_SOURCES_TITLE,
  TESTS_SUBTITLE, TESTS_TAB_MAP, TESTS_TAB_MUTATION, TESTS_TAB_RESULTS, TESTS_TABS_LABEL, TESTS_TITLE,
} from '../inspector-copy';
import PageHeader from '../kit/PageHeader.vue';
import MetricCard from '../kit/MetricCard.vue';
import Panel from '../kit/Panel.vue';
import Icon from '../kit/Icon.vue';
import Tabs from '../kit/Tabs.vue';
import MeterList from '../kit/MeterList.vue';
import type { MeterItem } from '../kit/meter-types';
import type { TabItem } from '../kit/tab-types';
import NoSnapshot from './NoSnapshot.vue';
// `screens/test-confidence/`, not `screens/tests/`: eslint's `**/tests/**` guard keeps
// test code out of the bundle and would reject a src folder named `tests`.
import CoverageMap from './test-confidence/CoverageMap.vue';
import CoverageGapsTable from './test-confidence/CoverageGapsTable.vue';
import TestRunsTable from './test-confidence/TestRunsTable.vue';
import UnknownEvidenceState from './shared/UnknownEvidenceState.vue';
import EvidenceSourceDialog from './shared/EvidenceSourceDialog.vue';
import type { EvidenceSourceRow } from './shared/evidence-source';

const TABS: readonly TabItem[] = [
  { id: 'map', label: TESTS_TAB_MAP },
  { id: 'results', label: TESTS_TAB_RESULTS },
  { id: 'mutation', label: TESTS_TAB_MUTATION },
];

const store = useCityStore();
const review = useReviewStore();
const { files, testConfidence } = useReadModels();
const tab = ref('map');
const moduleFilter = ref<string | null>(null);
const shown = ref(TABLE_PAGE);
const evidenceOpen = ref(false);
const liveMessage = ref('');
const root = ref<HTMLElement | null>(null);
const moduleSelectId = useUniqueId('ci-tests-module');

const tiles = computed(() => coverageTiles(files.value, moduleFilter.value));
/** Like Hotspots: any selected file, even one the tile cap or module filter hides. */
const selected = computed(() => files.value.find((f) => f.id === store.selectedEntityId) ?? null);
/** F3: a rescan or snapshot switch can drop the filtered module; fall back to all. */
watch(() => testConfidence.value?.moduleOptions ?? [], (options) => {
  if (moduleFilter.value !== null && !options.some((m) => m.name === moduleFilter.value)) moduleFilter.value = null;
});

const meters = computed<MeterItem[]>(() => (testConfidence.value?.modules ?? []).map((m) => ({
  id: m.module,
  label: m.label,
  value: m.coverage,
  tone: hasValue(m.coverage) && m.coverage.value < GAP_THRESHOLD ? 'warning' : 'success',
  ariaLabel: TESTS_MODULE_BAR_LABEL(m.label, formatMetric(m.coverage, '%')),
})));

const runsSubtitle = computed(() => {
  const runs = testConfidence.value?.runs ?? [];
  if (runs.length === 0) return undefined;
  const tests = sumEvidence(runs.map((r) => r.tests));
  const failing = sumEvidence(runs.map((r) => r.failing));
  // Same arithmetic as the results card; an unknown part keeps the total unknown ("—").
  const passing = !hasValue(tests) ? tests : !hasValue(failing) ? failing : { ...tests, value: tests.value - failing.value };
  return TESTS_RUNS_SUBTITLE(formatMetric(tests), formatMetric(passing), formatMetric(failing));
});

const evidenceRows = computed<EvidenceSourceRow[]>(() => {
  const hasRuns = (testConfidence.value?.runs.length ?? 0) > 0;
  return [
    { label: TESTS_SOURCE_LABELS.coverage, state: 'sample', source: EVIDENCE_SOURCE_SAMPLE },
    { label: TESTS_SOURCE_LABELS.runs, state: hasRuns ? 'sample' : 'unknown', source: hasRuns ? EVIDENCE_SOURCE_SAMPLE : EVIDENCE_SOURCE_NONE },
    { label: TESTS_SOURCE_LABELS.mutation, state: 'unknown', source: EVIDENCE_SOURCE_NONE },
  ];
});

/** Selection goes through the ONE owner and never moves the camera. */
function openFile(id: EntityId): void {
  store.select(id);
  store.navigate('file');
}

/** E17: announce only a real outcome; a refused (null) request announces nothing. */
async function planTests(f: FileSummary): Promise<void> {
  try {
    const item = await review.addWorkItem({ kind: 'file', entityId: f.id }, 'tests', TESTS_PLAN_TITLE(f.name), new Date());
    if (item) liveMessage.value = TESTS_PLAN_ADDED(f.name);
  } catch {
    liveMessage.value = TESTS_PLAN_FAILED;
  }
}

function exportCsv(): void {
  const model = testConfidence.value;
  if (!root.value || !model) return;
  try {
    downloadText(root.value, TESTS_CSV_FILENAME, gapsCsv(model.gaps));
  } catch {
    liveMessage.value = EXPORT_FAILED;
  }
}
</script>

<template>
  <div
    ref="root"
    class="ci-screen ci-screen--tests"
  >
    <PageHeader
      :eyebrow="TESTS_EYEBROW"
      :title="TESTS_TITLE"
      :subtitle="TESTS_SUBTITLE"
    >
      <template #actions>
        <button
          type="button"
          class="ci-tests__evidence"
          @click="evidenceOpen = true"
        >
          <Icon name="info" />
          {{ TESTS_EVIDENCE }}
        </button>
        <button
          type="button"
          class="ci-tests__export"
          :disabled="!testConfidence || testConfidence.gaps.length === 0"
          @click="exportCsv"
        >
          <Icon name="download" />
          {{ TESTS_EXPORT }}
        </button>
      </template>
    </PageHeader>
    <p
      class="visually-hidden ci-tests__live"
      role="status"
    >
      {{ liveMessage }}
    </p>
    <NoSnapshot v-if="!store.snapshot || !testConfidence" />
    <template v-else>
      <div class="ci-overview__cards">
        <MetricCard
          v-for="card in testConfidence.cards"
          :key="card.id"
          :label="card.label"
          :icon="card.icon"
          :value="card.value"
          :unit="card.unit"
          :caption="card.caption"
          :tone="card.tone"
        />
      </div>
      <Tabs
        v-model="tab"
        :tabs="TABS"
        :label="TESTS_TABS_LABEL"
      >
        <template v-if="tab === 'map'">
          <div class="ci-overview__grid">
            <Panel
              :title="TESTS_MAP_TITLE"
              :subtitle="TESTS_MAP_SUBTITLE"
              :footnote="TESTS_MAP_FOOTNOTE"
            >
              <template #actions>
                <label
                  class="visually-hidden"
                  :for="moduleSelectId"
                >{{ HOTSPOTS_MODULE_FILTER }}</label>
                <select
                  :id="moduleSelectId"
                  v-model="moduleFilter"
                  class="dropdown ci-tests__module"
                >
                  <option :value="null">
                    {{ HOTSPOTS_ALL_MODULES }}
                  </option>
                  <option
                    v-for="m in testConfidence.moduleOptions"
                    :key="m.name"
                    :value="m.name"
                  >
                    {{ m.label }}
                  </option>
                </select>
              </template>
              <CoverageMap
                :tiles="tiles.tiles"
                :selected-id="store.selectedEntityId"
                @select="store.select($event)"
              />
              <p
                v-if="tiles.total > tiles.tiles.length"
                class="ci-hotspots__note"
              >
                {{ TESTS_SHOWING(tiles.tiles.length, tiles.total) }}
              </p>
              <div class="ci-hotspots__selected">
                <!-- F7: the live region exists before its text changes, so the change is announced. -->
                <span role="status">{{ selected ? TESTS_SELECTED(selected.name) : '' }}</span>
                <button
                  v-if="selected"
                  type="button"
                  @click="openFile(selected.id)"
                >
                  {{ TESTS_OPEN_FILE }}
                </button>
              </div>
            </Panel>
            <Panel
              :title="TESTS_MODULES_TITLE"
              :subtitle="TESTS_MODULES_SUBTITLE"
            >
              <MeterList
                :items="meters"
                :label="TESTS_MODULES_LABEL"
              />
              <p
                v-if="testConfidence.hiddenModules > 0"
                class="ci-hotspots__note"
              >
                {{ TESTS_MODULES_HIDDEN(testConfidence.hiddenModules) }}
              </p>
            </Panel>
          </div>
          <Panel
            :title="TESTS_GAPS_TITLE"
            :subtitle="TESTS_GAPS_SUBTITLE"
          >
            <CoverageGapsTable
              :rows="testConfidence.gaps"
              :limit="shown"
              @plan="planTests"
              @open="openFile"
              @more="shown += TABLE_PAGE"
            />
          </Panel>
        </template>
        <Panel
          v-else-if="tab === 'results'"
          :title="TESTS_RUNS_TITLE"
          :subtitle="runsSubtitle"
        >
          <TestRunsTable
            :runs="testConfidence.runs"
            @open="openFile"
          />
        </Panel>
        <Panel
          v-else
          :title="MUTATION_TITLE"
          :subtitle="MUTATION_SUBTITLE"
        >
          <UnknownEvidenceState
            :title="MUTATION_EMPTY_TITLE"
            :body="MUTATION_EMPTY"
          >
            <button
              type="button"
              class="ci-tests__configure"
              @click="store.navigate('sources')"
            >
              {{ CONFIGURE_EVIDENCE }}
            </button>
          </UnknownEvidenceState>
        </Panel>
      </Tabs>
    </template>
    <EvidenceSourceDialog
      v-if="evidenceOpen"
      :title="TESTS_SOURCES_TITLE"
      :rows="evidenceRows"
      @close="evidenceOpen = false"
    />
  </div>
</template>
