<script setup lang="ts">
import { computed, ref, shallowRef, watch } from 'vue';
import { JSON_MIME, useCsvExport } from '../export/use-csv-export';
import { reviewStateJson, reviewStateSource } from '../read-models/review-state';
import { reannounce } from '../kit/reannounce';
import { useCityStore } from '../stores/city-store';
import { useReportStore } from '../stores/report-store';
import { useReviewStore } from '../stores/review-store';
import type { TabItem } from '../kit/tab-types';
import {
  SETTINGS_EXPORT, SETTINGS_EYEBROW, SETTINGS_JSON_FILENAME, SETTINGS_SUBTITLE, SETTINGS_TAB, SETTINGS_TABS_LABEL, SETTINGS_TITLE,
} from '../inspector-copy';
import PageHeader from '../kit/PageHeader.vue';
import Tabs from '../kit/Tabs.vue';
import Icon from '../kit/Icon.vue';
import PriorityFormulaDialog from './hotspots/PriorityFormulaDialog.vue';
import SettingsSections from './settings/SettingsSections.vue';
import ClearReviewDialog from './settings/ClearReviewDialog.vue';
import ImportReviewDialog from './settings/ImportReviewDialog.vue';
import type { ImportCandidate } from './settings/import-candidate';
import { SETTINGS_TABS, isSettingsTab, type SettingsTab } from './settings/settings-tabs';

const TABS: readonly TabItem[] = SETTINGS_TABS.map((id) => ({ id, label: SETTINGS_TAB[id] }));

const city = useCityStore();
const review = useReviewStore();
const report = useReportStore();
const root = ref<HTMLElement | null>(null);
const liveMessage = ref('');
const tab = ref<string>('appearance');
const showPriority = ref(false);
const showClear = ref(false);
/** Part 5 V16: the parsed file waiting for confirmation. Shallow: it is handed on, never edited. */
const importing = shallowRef<ImportCandidate | null>(null);
/** V27: Tabs' v-model is a plain string; narrowed here, with no cast. */
const current = computed<SettingsTab>(() => (isSettingsTab(tab.value) ? tab.value : 'appearance'));
const exportText = useCsvExport(root, liveMessage);

/** Part 5 E19: a codebase switch (a scan/approval completing) while the import dialog is
 *  open closes it — the parsed file was matched against the codebase that is no longer on
 *  screen. Nothing is announced: the user did not act. ImportReviewDialog's own confirm()
 *  carries a defence-in-depth check for a switch that races ahead of this watcher. */
watch(() => city.snapshot?.repositoryId, () => { importing.value = null; });

/** W14 / Part 5 V11: JSON through the leaf's own document only; relative paths, never raw
 *  entity ids; the source names the folder and a digest, never the absolute root or the id. */
function exportState(): void {
  exportText(SETTINGS_JSON_FILENAME, () => reviewStateJson({
    workItems: review.workItems, rules: review.rules, dispositions: review.dispositions,
    report: { sections: report.sections, note: report.note }, exportedAt: new Date(),
    source: reviewStateSource(city.snapshot),
  }), JSON_MIME);
}
/** A dialog's real outcome (E17): the dialog closes and the Settings live region
 *  announces it. `reannounce` (V22) makes a repeated outcome (a second clear, a second
 *  import of the same file) heard again. */
function announce(message: string): void {
  showClear.value = false;
  importing.value = null;
  void reannounce(liveMessage, message);
}
</script>

<template>
  <div
    ref="root"
    class="ci-screen ci-screen--settings"
  >
    <PageHeader
      :eyebrow="SETTINGS_EYEBROW"
      :title="SETTINGS_TITLE"
      :subtitle="SETTINGS_SUBTITLE"
    >
      <template #actions>
        <button
          type="button"
          class="ci-settings__export"
          @click="exportState"
        >
          <Icon name="download" />
          {{ SETTINGS_EXPORT }}
        </button>
      </template>
    </PageHeader>
    <p
      class="visually-hidden ci-settings__live"
      role="status"
    >
      {{ liveMessage }}
    </p>
    <Tabs
      v-model="tab"
      :tabs="TABS"
      :label="SETTINGS_TABS_LABEL"
    >
      <SettingsSections
        :tab="current"
        @priority="showPriority = true"
        @clear="showClear = true"
        @export="exportState"
        @parsed="importing = $event"
      />
    </Tabs>
    <PriorityFormulaDialog
      v-if="showPriority"
      @close="showPriority = false"
    />
    <ClearReviewDialog
      v-if="showClear"
      @close="showClear = false"
      @done="announce"
    />
    <ImportReviewDialog
      v-if="importing"
      :candidate="importing"
      @close="importing = null"
      @done="announce"
    />
  </div>
</template>
