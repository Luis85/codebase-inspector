<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useReadModels } from '../read-models/use-read-models';
import { evidenceBadgeFor } from '../read-models/evidence-index';
import { reviewFailureText } from '../read-models/review-failure';
import { useCityStore } from '../stores/city-store';
import { useReviewStore } from '../stores/review-store';
import { useImportReport } from './use-import-report';
import {
  ADD_TO_PLAN_FAILED, FILE_BROWSE_HOTSPOTS, FILE_EYEBROW, FILE_HISTORY_FOOTNOTE, FILE_HISTORY_NONE, FILE_HISTORY_SUBTITLE,
  FILE_HISTORY_TITLE, FILE_NO_SELECTION, FILE_NO_SELECTION_TITLE, WORK_ITEM_TITLE,
} from '../inspector-copy';
import PageHeader from '../kit/PageHeader.vue';
import MetricCard from '../kit/MetricCard.vue';
import Panel from '../kit/Panel.vue';
import LineChart from '../kit/LineChart.vue';
import NoSnapshot from './NoSnapshot.vue';
import FileHeader from './file/FileHeader.vue';
import SourceContextPanel from './file/SourceContextPanel.vue';
import FileFindingsPanel from './file/FileFindingsPanel.vue';
import FileWorkItemsPanel from './file/FileWorkItemsPanel.vue';
import FindingReviewDialog from './quality/FindingReviewDialog.vue';

const store = useCityStore();
const review = useReviewStore();
const { fileDetail, quality } = useReadModels();
/** Part 6 Y36/Y39 (Polish E9): Import report goes to Data & scans and asks for the S14 dialog. */
const importReport = useImportReport();
const liveMessage = ref('');
/** The fingerprint under review; the dialog is shared with Code quality. */
const reviewing = ref<string | null>(null);
watch(() => store.selectedEntityId, () => { liveMessage.value = ''; reviewing.value = null; });
/** Fix round 1: as on Code quality, a rescan that drops the finding ends the review. */
watch(() => reviewing.value !== null && !quality.value.byFingerprint.has(reviewing.value), (gone) => {
  if (gone) reviewing.value = null;
});

const workItems = computed(() => {
  const id = fileDetail.value?.file.id;
  return id ? review.workItemsForFile(id) : [];
});

/** P11: back to the city with the same selection. Opening the inspector never moves the
 *  camera (city-store invariant). */
function showInCity(): void {
  store.navigate('city');
  store.openInspector();
}

/** Records intent only, through the review port. Nothing in the source is touched. */
async function addWorkItem(): Promise<void> {
  const detail = fileDetail.value;
  if (!detail) return;
  try {
    await review.addWorkItemForFile(detail.file.id, WORK_ITEM_TITLE(detail.file.name), new Date());
  } catch (e) {
    liveMessage.value = reviewFailureText(e, ADD_TO_PLAN_FAILED);
  }
}
</script>

<template>
  <div class="ci-screen ci-screen--file">
    <NoSnapshot v-if="!store.snapshot" />
    <template v-else-if="!fileDetail">
      <PageHeader
        :eyebrow="FILE_EYEBROW"
        :title="FILE_NO_SELECTION_TITLE"
        :subtitle="FILE_NO_SELECTION"
      />
      <div>
        <button
          type="button"
          class="ci-file-detail__browse"
          @click="store.navigate('hotspots')"
        >
          {{ FILE_BROWSE_HOTSPOTS }}
        </button>
      </div>
    </template>
    <template v-else>
      <FileHeader
        :detail="fileDetail"
        :in-plan="review.hasWorkItemFor(fileDetail.file.id)"
        :pending="review.isPendingFor(fileDetail.file.id)"
        @show-in-city="showInCity"
        @inspect-architecture="store.navigate('architecture')"
        @add-work-item="addWorkItem"
      />
      <p
        class="visually-hidden"
        role="status"
      >
        {{ liveMessage }}
      </p>
      <div class="ci-screen__cards">
        <MetricCard
          v-for="card in fileDetail.cards"
          :key="card.id"
          :label="card.label"
          :icon="card.icon"
          :value="card.value"
          :unit="card.unit"
          :caption="card.caption"
          :tone="card.tone"
        />
      </div>
      <div class="ci-file-detail__grid">
        <SourceContextPanel :detail="fileDetail" />
        <FileFindingsPanel
          :findings="fileDetail.findings"
          :count="fileDetail.findingsCount"
          :statuses="quality.byFingerprint"
          :evidence="quality.evidence.state"
          :badge="evidenceBadgeFor(quality.evidence)"
          @review="reviewing = $event"
          @import="importReport"
        />
      </div>
      <div class="ci-file-detail__grid">
        <Panel
          :title="FILE_HISTORY_TITLE"
          :subtitle="FILE_HISTORY_SUBTITLE"
          :footnote="FILE_HISTORY_FOOTNOTE"
        >
          <LineChart
            v-if="fileDetail.history.length"
            :label="FILE_HISTORY_TITLE"
            :series="fileDetail.history"
          />
          <p
            v-else
            class="ci-note"
          >
            {{ FILE_HISTORY_NONE }}
          </p>
        </Panel>
        <FileWorkItemsPanel :items="workItems" />
      </div>
      <!-- Already this file's detail: "Open file detail" only closes the dialog. -->
      <FindingReviewDialog
        v-if="reviewing"
        :fingerprint="reviewing"
        @close="reviewing = null"
        @open-file="reviewing = null"
      />
    </template>
  </div>
</template>
