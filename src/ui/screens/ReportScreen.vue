<script setup lang="ts">
import { computed, nextTick, ref } from 'vue';
import { MARKDOWN_MIME, useCsvExport } from '../export/use-csv-export';
import { buildReportModel, reportMarkdown } from '../read-models/report';
import { useReadModels } from '../read-models/use-read-models';
import { buildWorkbenchModel } from '../read-models/work-items';
import { useCityStore } from '../stores/city-store';
import { useReportStore } from '../stores/report-store';
import { useReviewStore } from '../stores/review-store';
import { REPORT_EXPORT, REPORT_EYEBROW, REPORT_MD_FILENAME, REPORT_SUBTITLE, REPORT_TITLE } from '../inspector-copy';
import PageHeader from '../kit/PageHeader.vue';
import Icon from '../kit/Icon.vue';
import NoSnapshot from './NoSnapshot.vue';
import ReportPaper from './report/ReportPaper.vue';
import ReportContents from './report/ReportContents.vue';

const store = useCityStore();
const review = useReviewStore();
const report = useReportStore();
const { files, overview, architecture, security } = useReadModels();
const root = ref<HTMLElement | null>(null);
const liveMessage = ref('');
const exportText = useCsvExport(root, liveMessage);

/** Controller ruling E11 (amends E8): the report store is bound to the current codebase
 *  from App.vue, regardless of which screen is open — a reviewer note must never survive
 *  onto a different codebase even if they never opened Report while it was scanned in. */

/** E17-style repeat: an identical outcome (e.g. applying the same note twice) must be
 *  announced again, which a screen reader only does on an actual text change. */
async function announce(message: string): Promise<void> {
  liveMessage.value = '';
  await nextTick();
  liveMessage.value = message;
}

const model = computed(() => {
  const snapshot = store.snapshot;
  const ov = overview.value;
  if (!snapshot || !ov) return null;
  const plan = buildWorkbenchModel(review.workItems, files.value, '').rows;
  return buildReportModel({ snapshot, files: files.value, overview: ov, architecture: architecture.value, security: security.value, plan });
});

/** W6: Markdown through the leaf's own document only; nothing is written to the vault. */
function exportReport(): void {
  const m = model.value;
  if (m) exportText(REPORT_MD_FILENAME, () => reportMarkdown(m, report.sections, report.note), MARKDOWN_MIME);
}
</script>

<template>
  <div
    ref="root"
    class="ci-screen ci-screen--report"
  >
    <PageHeader
      :eyebrow="REPORT_EYEBROW"
      :title="REPORT_TITLE"
      :subtitle="REPORT_SUBTITLE"
    >
      <template #actions>
        <button
          type="button"
          class="mod-cta ci-report__export"
          :disabled="!model"
          @click="exportReport"
        >
          <Icon name="download" />
          {{ REPORT_EXPORT }}
        </button>
      </template>
    </PageHeader>
    <p
      class="visually-hidden ci-report__live"
      role="status"
    >
      {{ liveMessage }}
    </p>
    <NoSnapshot v-if="!model" />
    <div
      v-else
      class="ci-report"
    >
      <ReportPaper
        :model="model"
        :sections="report.sections"
        :note="report.note"
      />
      <ReportContents @announce="announce" />
    </div>
  </div>
</template>
