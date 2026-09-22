<script setup lang="ts">
import { computed, ref } from 'vue';
import { downloadText } from '../export/download';
import { CONCENTRATION_WARNING, stewardshipCsv, type StewardshipAction } from '../read-models/ownership';
import { useReadModels } from '../read-models/use-read-models';
import { useCityStore } from '../stores/city-store';
import { useReviewStore } from '../stores/review-store';
import {
  EXPORT_FAILED, OWNERSHIP_ACTION_DONE, OWNERSHIP_ACTION_FAILED, OWNERSHIP_ACTIONS_SUBTITLE, OWNERSHIP_ACTIONS_TITLE,
  OWNERSHIP_BAR_LABEL, OWNERSHIP_BARS_FOOTNOTE, OWNERSHIP_BARS_LABEL, OWNERSHIP_BARS_SUBTITLE, OWNERSHIP_BARS_TITLE, OWNERSHIP_CALLOUT,
  OWNERSHIP_CALLOUT_TITLE, OWNERSHIP_CSV_FILENAME, OWNERSHIP_EXPORT, OWNERSHIP_EYEBROW, OWNERSHIP_HIDDEN,
  OWNERSHIP_SUBTITLE, OWNERSHIP_TABLE_SUBTITLE, OWNERSHIP_TABLE_TITLE, OWNERSHIP_TITLE, SAMPLE_BADGE_DETAIL,
} from '../inspector-copy';
import { formatMetric } from '../evidence';
import PageHeader from '../kit/PageHeader.vue';
import Panel from '../kit/Panel.vue';
import Callout from '../kit/Callout.vue';
import Icon from '../kit/Icon.vue';
import MeterList from '../kit/MeterList.vue';
import type { MeterItem } from '../kit/meter-types';
import NoSnapshot from './NoSnapshot.vue';
import StewardshipActions from './ownership/StewardshipActions.vue';
import StewardshipTable from './ownership/StewardshipTable.vue';

const store = useCityStore();
const review = useReviewStore();
const { ownership } = useReadModels();
const liveMessage = ref('');
const root = ref<HTMLElement | null>(null);

const bars = computed<MeterItem[]>(() => ownership.value.rows.map((row) => ({
  id: row.module,
  label: row.label,
  value: row.concentration,
  tone: (row.concentration.value ?? 0) >= CONCENTRATION_WARNING ? 'warning' : 'accent',
  ariaLabel: OWNERSHIP_BAR_LABEL(row.label, formatMetric(row.concentration, '%')),
})));

/** Q11: the city's own path search, exactly what the user could type. It dims files
 *  outside the module and never moves the camera or changes the selection. */
function showInCity(module: string): void {
  store.setQuery(`${module}/`);
  store.navigate('city');
}

/** E17: announce a real outcome only. A refusal (null) announces nothing, and a throw
 *  announces the failure string. */
async function addAction(a: StewardshipAction): Promise<void> {
  try {
    const item = await review.addWorkItem({ kind: 'module', module: a.module }, a.intent, a.title, new Date());
    if (item) liveMessage.value = OWNERSHIP_ACTION_DONE;
  } catch {
    liveMessage.value = OWNERSHIP_ACTION_FAILED;
  }
}

function exportCsv(): void {
  if (!root.value) return;
  try {
    downloadText(root.value, OWNERSHIP_CSV_FILENAME, stewardshipCsv(ownership.value.rows));
  } catch {
    liveMessage.value = EXPORT_FAILED;
  }
}
</script>

<template>
  <div
    ref="root"
    class="ci-screen ci-screen--ownership"
  >
    <PageHeader
      :eyebrow="OWNERSHIP_EYEBROW"
      :title="OWNERSHIP_TITLE"
      :subtitle="OWNERSHIP_SUBTITLE"
    >
      <template #actions>
        <button
          type="button"
          class="ci-ownership__export"
          :disabled="ownership.rows.length === 0"
          @click="exportCsv"
        >
          <Icon name="download" />
          {{ OWNERSHIP_EXPORT }}
        </button>
      </template>
    </PageHeader>
    <p
      class="visually-hidden ci-ownership__live"
      role="status"
    >
      {{ liveMessage }}
    </p>
    <NoSnapshot v-if="!store.snapshot" />
    <template v-else>
      <Callout
        :title="OWNERSHIP_CALLOUT_TITLE"
        :badge="SAMPLE_BADGE_DETAIL"
      >
        {{ OWNERSHIP_CALLOUT }}
      </Callout>
      <div class="ci-screen__grid">
        <Panel
          :title="OWNERSHIP_BARS_TITLE"
          :subtitle="OWNERSHIP_BARS_SUBTITLE"
          :footnote="OWNERSHIP_BARS_FOOTNOTE"
        >
          <MeterList
            :items="bars"
            :label="OWNERSHIP_BARS_LABEL"
          />
        </Panel>
        <Panel
          :title="OWNERSHIP_ACTIONS_TITLE"
          :subtitle="OWNERSHIP_ACTIONS_SUBTITLE"
        >
          <StewardshipActions
            :actions="ownership.actions"
            @add="addAction"
          />
        </Panel>
      </div>
      <Panel
        :title="OWNERSHIP_TABLE_TITLE"
        :subtitle="OWNERSHIP_TABLE_SUBTITLE"
      >
        <StewardshipTable
          :rows="ownership.rows"
          @city="showInCity"
        />
        <p
          v-if="ownership.hiddenModules > 0"
          class="ci-note"
        >
          {{ OWNERSHIP_HIDDEN(ownership.hiddenModules) }}
        </p>
      </Panel>
    </template>
  </div>
</template>
