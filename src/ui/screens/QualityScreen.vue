<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue';
import type { EntityId } from '../../domain/entity-id';
import { formatAbsoluteTime } from '../copy';
import { useCsvExport } from '../export/use-csv-export';
import {
  DEFAULT_QUALITY_FILTER, FINDINGS_PAGE, filterFindings, findingsCsv, type QualityFilter, type QualityFinding,
} from '../read-models/findings';
import { useReadModels } from '../read-models/use-read-models';
import { evidenceBadgeFor, staleCauseOf } from '../read-models/evidence-index';
import { useCityStore } from '../stores/city-store';
import { useEvidenceStore } from '../stores/evidence-store';
import { useImportReport } from './use-import-report';
import {
  FALLOW_STALE_NOTICE, QUALITY_CSV_FILENAME, QUALITY_EXPORT, QUALITY_EYEBROW, QUALITY_FOOTNOTE, QUALITY_SUBTITLE,
  QUALITY_NO_FINDINGS_REPORTED, QUALITY_TABLE_TITLE, QUALITY_TITLE,
} from '../inspector-copy';
import PageHeader from '../kit/PageHeader.vue';
import MetricCard from '../kit/MetricCard.vue';
import Panel from '../kit/Panel.vue';
import Callout from '../kit/Callout.vue';
import Icon from '../kit/Icon.vue';
import EvidenceBadge from '../kit/EvidenceBadge.vue';
import NotAnalysed from '../kit/NotAnalysed.vue';
import NoSnapshot from './NoSnapshot.vue';
import FindingFilters from './quality/FindingFilters.vue';
import FindingsTable from './quality/FindingsTable.vue';
import FindingReviewDialog from './quality/FindingReviewDialog.vue';

const store = useCityStore();
const evidenceStore = useEvidenceStore();
/** Y35/Y39 (Polish E9): the S14 dialog lives on Data & scans. Go there and ask for it, exactly as
 *  the "Import analysis report" command does; the file picker then opens from a real click in it. */
const importReport = useImportReport();
const { quality } = useReadModels();
const filter = ref<QualityFilter>({ ...DEFAULT_QUALITY_FILTER });
const shown = ref(FINDINGS_PAGE);
const reviewing = ref<string | null>(null);
const openedIndex = ref(0);
const liveMessage = ref('');
const root = ref<HTMLElement | null>(null);
const exportText = useCsvExport(root, liveMessage);

const rows = computed(() => filterFindings(quality.value.findings, filter.value));
/** Part 6 Y30/Y32/Y35: the report the model was built from (null: Not analysed), and whether
 *  it predates the snapshot on screen. */
const report = computed(() => quality.value.evidence.report);
const stale = computed(() => quality.value.evidence.state === 'stale');
const staleNotice = computed(() => (report.value && stale.value
  ? FALLOW_STALE_NOTICE(formatAbsoluteTime(report.value.importedAt, Intl), staleCauseOf(report.value)) : ''));
/** Part 6 E13: another leaf on this codebase can remove or replace the shared report while
 *  Export has focus, so it is aria-disabled and exportCsv ignores the press (E40/E44/E50). */
const exportBlocked = computed(() => rows.value.length === 0);
watch(filter, () => { shown.value = FINDINGS_PAGE; });
/** Hotspots F3: a rescan or snapshot switch can drop the filtered module; fall back to all. */
watch(() => quality.value.modules, (modules) => {
  const module = filter.value.module;
  if (module !== null && !modules.some((m) => m.name === module)) filter.value = { ...filter.value, module: null };
});
/** Part 6 fix round 1: likewise a rescan or report change can drop the filtered severity
 *  from the options; fall back to all, so the select never misstates the filter. */
watch(() => quality.value.severities, (severities) => {
  const s = filter.value.severity;
  if (s !== null && !severities.includes(s)) filter.value = { ...filter.value, severity: null };
});
/** Polish E13 (L19): another leaf can remove the report, or replace it with one that reports
 *  nothing, while focus is inside the findings panel. The focused control unmounts; focus moves
 *  to what replaced it — NotAnalysed's Import, or the panel itself — never to <body>. */
watch([() => report.value === null, () => quality.value.findings.length === 0], async () => {
  const el = root.value;
  const active = el?.ownerDocument.activeElement ?? null;
  if (!el || !active || !el.querySelector('.ci-quality__panel')?.contains(active)) return;
  await nextTick();
  if (active.isConnected) return;
  (el.querySelector<HTMLElement>('.ci-not-analysed__import') ?? el.querySelector<HTMLElement>('.ci-quality__panel'))?.focus();
});

/** Fix round 1: a rescan can drop the finding under review. Forget it, so the dialog
 *  cannot come back on its own when a later snapshot brings the fingerprint back. */
watch(() => reviewing.value !== null && !quality.value.byFingerprint.has(reviewing.value), (gone) => {
  if (gone) reviewing.value = null;
});

function resetFilters(): void {
  filter.value = { ...DEFAULT_QUALITY_FILTER };
}

/** Remembers which row's Review button opened the dialog, so closing can land near it (closeReview). */
function open(finding: QualityFinding): void {
  const el = root.value;
  const active = el?.ownerDocument.activeElement ?? null;
  const buttons = el ? [...el.querySelectorAll<HTMLElement>('.ci-findings-table__open')] : [];
  const at = active ? buttons.findIndex((b) => b === active) : -1;
  openedIndex.value = at < 0 ? 0 : at;
  reviewing.value = finding.fingerprint;
}

/** WP-03 N15: Architecture's cycle/violation rows go here through requestFindingReview;
 *  consumed exactly once, whether or not the finding is still listed. */
onMounted(() => {
  const fingerprint = evidenceStore.consumeFindingReviewRequest();
  const finding = fingerprint ? quality.value.byFingerprint.get(fingerprint) : undefined;
  if (finding) open(finding);
});

/** The row that opened the dialog may have left the filtered list (an Open finding that
 *  was just acknowledged). CiDialog restores focus to it when it is still there;
 *  otherwise land on the Review button now at the same place, the last one, or the panel —
 *  never the body (Part 2 F7 pattern). */
async function closeReview(): Promise<void> {
  reviewing.value = null;
  await nextTick();
  const el = root.value;
  const active = el?.ownerDocument.activeElement;
  if (!el || (active && el.contains(active))) return;   // CiDialog already restored focus inside the screen
  const buttons = [...el.querySelectorAll<HTMLElement>('.ci-findings-table__open')];
  (buttons[Math.min(openedIndex.value, buttons.length - 1)]
    ?? el.querySelector<HTMLElement>('.ci-findings-table__reset')
    ?? el.querySelector<HTMLElement>('.ci-quality__panel'))?.focus();
}

/** Selection goes through the ONE owner and never moves the camera. */
function openFile(id: EntityId): void {
  reviewing.value = null;
  store.select(id);
  store.navigate('file');
}

/** Every filtered finding, handed to the user through this leaf's own document. */
function exportCsv(): void {
  if (exportBlocked.value) return;
  exportText(QUALITY_CSV_FILENAME, () => findingsCsv(rows.value, quality.value.evidence));
}
</script>

<template>
  <div
    ref="root"
    class="ci-screen ci-screen--quality"
  >
    <PageHeader
      :eyebrow="QUALITY_EYEBROW"
      :title="QUALITY_TITLE"
      :subtitle="QUALITY_SUBTITLE"
    >
      <template #actions>
        <button
          type="button"
          class="ci-quality__export"
          :aria-disabled="exportBlocked ? 'true' : undefined"
          @click="exportCsv"
        >
          <Icon name="download" />
          {{ QUALITY_EXPORT }}
        </button>
      </template>
    </PageHeader>
    <p
      class="visually-hidden ci-quality__live"
      role="status"
    >
      {{ liveMessage }}
    </p>
    <NoSnapshot v-if="!store.snapshot" />
    <template v-else>
      <div
        v-if="report"
        class="ci-quality__evidence"
      >
        <EvidenceBadge v-bind="evidenceBadgeFor(quality.evidence)!" />
      </div>
      <Callout
        v-if="staleNotice"
        tone="warning"
        :title="staleNotice"
      />
      <div class="ci-screen__cards">
        <MetricCard
          v-for="card in quality.cards"
          :key="card.id"
          :label="card.label"
          :icon="card.icon"
          :value="card.value"
          :caption="card.caption"
          :tone="card.tone"
        />
      </div>
      <NotAnalysed
        v-if="!report"
        @import="importReport"
      />
      <section
        v-else
        class="ci-quality__panel"
        tabindex="-1"
      >
        <Panel :title="QUALITY_TABLE_TITLE">
          <FindingFilters
            v-model:filter="filter"
            :modules="quality.modules"
            :severities="quality.severities"
            @reset="resetFilters"
          />
          <!-- Part 6 E14: nothing reported on screen is not "no match", and has nothing to reset. -->
          <p
            v-if="quality.findings.length === 0"
            class="ci-note ci-quality__none"
          >
            {{ QUALITY_NO_FINDINGS_REPORTED }}
          </p>
          <FindingsTable
            v-else
            :rows="rows"
            :limit="shown"
            :stale="stale"
            @open="open"
            @more="shown += FINDINGS_PAGE"
            @reset="resetFilters"
          />
        </Panel>
      </section>
      <p class="ci-note">
        {{ QUALITY_FOOTNOTE }}
      </p>
    </template>
    <FindingReviewDialog
      v-if="reviewing"
      :fingerprint="reviewing"
      @close="closeReview"
      @open-file="openFile"
    />
  </div>
</template>
