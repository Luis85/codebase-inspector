<script setup lang="ts">
import { ref } from 'vue';
import { JSON_MIME, useCsvExport } from '../export/use-csv-export';
import { reviewStateJson } from '../read-models/review-state';
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
import type { SettingsTab } from './settings/settings-tabs';

const TABS: readonly TabItem[] = (['appearance', 'analysis', 'accessibility', 'privacy', 'about'] as const).map((id) => ({ id, label: SETTINGS_TAB[id] }));

const review = useReviewStore();
const report = useReportStore();
const root = ref<HTMLElement | null>(null);
const liveMessage = ref('');
const tab = ref<string>('appearance');
const showPriority = ref(false);
const showClear = ref(false);
const exportText = useCsvExport(root, liveMessage);

/** W14: JSON through the leaf's own document only; relative paths, never raw entity ids. */
function exportState(): void {
  exportText(SETTINGS_JSON_FILENAME, () => reviewStateJson({
    workItems: review.workItems, rules: review.rules, dispositions: review.dispositions,
    report: { sections: report.sections, note: report.note }, exportedAt: new Date(),
  }), JSON_MIME);
}
function cleared(message: string): void {
  showClear.value = false;
  liveMessage.value = message;
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
        :tab="tab as SettingsTab"
        @priority="showPriority = true"
        @clear="showClear = true"
        @export="exportState"
      />
    </Tabs>
    <PriorityFormulaDialog
      v-if="showPriority"
      @close="showPriority = false"
    />
    <ClearReviewDialog
      v-if="showClear"
      @close="showClear = false"
      @done="cleared"
    />
  </div>
</template>
