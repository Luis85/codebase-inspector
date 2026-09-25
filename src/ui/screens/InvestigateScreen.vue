<!--
  WP-04 IN1-IN6, IN14-IN17: the Investigate route. Task 1 laid the empty and gone states;
  this task adds the finding list, filters, evidence bundle, uncertainty panel and Add
  work item. Selecting a finding changes neither the city selection nor the camera (IP20);
  only Open file detail selects the anchor and navigates (IP20).
-->
<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import type { EntityId } from '../../domain/entity-id';
import { useReadModels } from '../read-models/use-read-models';
import {
  DEFAULT_INVESTIGATION_FILTER, filterInvestigation, type InvestigationFilter,
} from '../read-models/investigation';
import {
  evidenceBundleFor, locationInputsFor, previewRequestFor, uncertaintiesFor, checklistFor,
} from '../read-models/investigation-evidence';
import { FINDINGS_PAGE } from '../read-models/findings';
import { locationVerdict, type LocationVerdict } from '../../application/investigation/stale-location';
import { useCityStore } from '../stores/city-store';
import { useInvestigationStore } from '../stores/investigation-store';
import { useImportReport } from './use-import-report';
import { reannounce } from '../kit/reannounce';
import {
  FINDING_KIND_LABEL, FINDING_LINE_TEXT, INVESTIGATE_COUNTS, INVESTIGATE_EYEBROW, INVESTIGATE_FINDING_GONE, INVESTIGATE_LIST_TITLE,
  INVESTIGATE_NONE_SELECTED, INVESTIGATE_SUBTITLE, INVESTIGATE_TITLE, INVESTIGATE_WORK_NOTES, INVESTIGATE_WORK_TITLE, RULE_TEXT,
} from '../inspector-copy';
import PageHeader from '../kit/PageHeader.vue';
import Panel from '../kit/Panel.vue';
import Callout from '../kit/Callout.vue';
import NotAnalysed from '../kit/NotAnalysed.vue';
import NoSnapshot from './NoSnapshot.vue';
import InvestigationFilters from './investigate/InvestigationFilters.vue';
import InvestigationList from './investigate/InvestigationList.vue';
import EvidencePanel from './investigate/EvidencePanel.vue';
import UncertaintyPanel from './investigate/UncertaintyPanel.vue';
import SourcePreviewPanel from './investigate/SourcePreviewPanel.vue';
import FindingReviewDialog from './quality/FindingReviewDialog.vue';
import WorkItemEditor from './workbench/WorkItemEditor.vue';

const store = useCityStore();
const investigationStore = useInvestigationStore();
const importReport = useImportReport();
const { quality, investigation, files } = useReadModels();
const report = computed(() => quality.value.evidence.report);
const liveMessage = ref('');

const filter = ref<InvestigationFilter>({ ...DEFAULT_INVESTIGATION_FILTER });
const shown = ref(FINDINGS_PAGE);
const reviewing = ref<string | null>(null);
const addingWorkItem = ref(false);

const model = computed(() => investigation.value);
const rows = computed(() => filterInvestigation(model.value.rows, filter.value));
const selectedRow = computed(() => (investigationStore.selectedFingerprint === null
  ? null : model.value.byFingerprint.get(investigationStore.selectedFingerprint) ?? null));
const bundle = computed(() => (selectedRow.value ? evidenceBundleFor(selectedRow.value, model.value.evidence, files.value) : null));
/** IN10: the highlight verdict, only once the CURRENT selection's preview has read ok —
 *  a stale or in-flight result for another row (mid-switch) never lends its verdict here. */
const verdict = computed<LocationVerdict | null>(() => {
  const row = selectedRow.value;
  const snapshot = store.snapshot;
  const state = investigationStore.preview;
  if (row === null || snapshot === null) return null;
  if (state.status !== 'ready' || state.fingerprint !== row.fingerprint || state.result.status !== 'ok') return null;
  return locationVerdict(locationInputsFor(row, snapshot, model.value.evidence, state.result.text));
});
const uncertainties = computed(() => (selectedRow.value && bundle.value ? uncertaintiesFor(selectedRow.value, bundle.value, verdict.value) : []));
const checklist = computed(() => (selectedRow.value ? checklistFor(selectedRow.value.kind) : []));
/** IN12: offered only when the anchor is a `.md` file the vault itself holds — the port's
 *  own check (host/investigation-notes.ts); this screen only asks and shows what it says. */
const notePath = computed(() => {
  const row = selectedRow.value;
  const snapshot = store.snapshot;
  if (row === null || snapshot === null) return null;
  return investigationStore.sourceNotePath(snapshot.scope.rootPath, row.anchorPath);
});
const listCounts = computed(() => INVESTIGATE_COUNTS(model.value.rows.length, model.value.withNotes, model.value.orphanNotes.length, model.value.malformedNotes));
const workDraft = computed(() => {
  const row = selectedRow.value;
  if (!row) return null;
  return {
    title: INVESTIGATE_WORK_TITLE(row.id, row.file.name),
    notes: INVESTIGATE_WORK_NOTES(FINDING_KIND_LABEL[row.kind], RULE_TEXT(row.rule), row.anchorPath, FINDING_LINE_TEXT(row.line, row.endLine)),
  };
});

/** IN4/IN34: a re-import that no longer reports the selected fingerprint clears the
 *  selection and raises the gone notice. Reads the investigation model's own map (Task 11),
 *  which shares quality's keys. E17: announce only the real outcome, through reannounce. */
watch(() => {
  const fp = investigationStore.selectedFingerprint;
  return fp !== null && report.value !== null && !model.value.byFingerprint.has(fp);
}, (gone) => {
  if (!gone) return;
  investigationStore.markGone();
  void reannounce(liveMessage, INVESTIGATE_FINDING_GONE);
}, { immediate: true });

/** IN4/IP19/IPF7: an entry point that selects a finding resets the filter when it hides
 *  the row, and ALWAYS pages so the row's page is shown, whether or not a reset was
 *  needed — the early return below skips only the filter reset, never the paging.
 *  `immediate`: a real entry point sets the fingerprint before this screen mounts, so the
 *  first run must not wait for a later change. `shown` is otherwise only reset by the
 *  filter UI itself (updateFilter/resetFilters below), never by a bare `watch(filter,
 *  …)` — that would also fire on THIS watcher's own reset and erase the page it just set,
 *  in the same flush. */
watch(() => investigationStore.selectedFingerprint, (fp) => {
  if (fp === null || !model.value.byFingerprint.has(fp)) return;
  if (!rows.value.some((r) => r.fingerprint === fp)) filter.value = { ...DEFAULT_INVESTIGATION_FILTER };
  const i = rows.value.findIndex((r) => r.fingerprint === fp);
  if (i >= 0 && i >= shown.value) shown.value = Math.ceil((i + 1) / FINDINGS_PAGE) * FINDINGS_PAGE;
}, { immediate: true });

/** IN7/IN13 (IP39): the ONLY trigger for a preview read besides Reload — a selection
 *  change, never a list render or a re-import. `immediate` so a fingerprint opened before
 *  this screen mounted (a real entry point) still reads on first render. */
watch(() => investigationStore.selectedFingerprint, (fp) => {
  const row = fp === null ? null : model.value.byFingerprint.get(fp) ?? null;
  const snapshot = store.snapshot;
  if (row !== null && snapshot !== null) void investigationStore.readPreview(row.fingerprint, previewRequestFor(row, snapshot));
}, { immediate: true });

function updateFilter(next: InvestigationFilter): void {
  filter.value = next;
  shown.value = FINDINGS_PAGE;
}

function resetFilters(): void {
  filter.value = { ...DEFAULT_INVESTIGATION_FILTER };
  shown.value = FINDINGS_PAGE;
}

function select(fingerprint: string): void {
  investigationStore.open(fingerprint);
}

/** IN11: Reload re-reads the CURRENT selection's anchor file (the panel itself guards a
 *  press while already loading, E40). */
function reloadPreview(): void {
  const row = selectedRow.value;
  const snapshot = store.snapshot;
  if (row !== null && snapshot !== null) void investigationStore.readPreview(row.fingerprint, previewRequestFor(row, snapshot));
}

function openInObsidian(): void {
  const path = notePath.value;
  if (path !== null) void investigationStore.openNote(path);
}

function openReview(): void {
  if (selectedRow.value) reviewing.value = selectedRow.value.fingerprint;
}

function closeReview(): void {
  reviewing.value = null;
}

/** IP20: Open file detail is the only Investigate control that selects the anchor and
 *  navigates; it never touches the camera (there is no renderer call here). */
function openFile(id?: EntityId): void {
  reviewing.value = null;
  const target = id ?? selectedRow.value?.file.id;
  if (!target) return;
  store.select(target);
  store.navigate('file');
}

function openWorkItemEditor(): void {
  if (selectedRow.value) addingWorkItem.value = true;
}

function closeWorkItemEditor(): void {
  addingWorkItem.value = false;
}

async function workItemDone(message: string): Promise<void> {
  addingWorkItem.value = false;
  await reannounce(liveMessage, message);
}
</script>

<template>
  <div class="ci-screen ci-screen--investigate">
    <PageHeader
      :eyebrow="INVESTIGATE_EYEBROW"
      :title="INVESTIGATE_TITLE"
      :subtitle="INVESTIGATE_SUBTITLE"
    />
    <p
      class="visually-hidden ci-investigate__live"
      role="status"
    >
      {{ liveMessage }}
    </p>
    <NoSnapshot v-if="!store.snapshot" />
    <template v-else>
      <Callout
        v-if="investigationStore.findingGone"
        tone="warning"
        :title="INVESTIGATE_FINDING_GONE"
      />
      <NotAnalysed
        v-if="!report"
        @import="importReport"
      />
      <div
        v-else
        class="ci-investigate__layout"
      >
        <Panel
          :title="INVESTIGATE_LIST_TITLE"
          :subtitle="listCounts"
        >
          <InvestigationFilters
            :filter="filter"
            :rules="model.rules"
            :severities="model.severities"
            @update:filter="updateFilter"
            @reset="resetFilters"
          />
          <InvestigationList
            :rows="rows"
            :limit="shown"
            :selected="investigationStore.selectedFingerprint"
            @select="select"
            @more="shown += FINDINGS_PAGE"
          />
        </Panel>
        <div class="ci-investigate__detail">
          <template v-if="selectedRow && bundle">
            <EvidencePanel
              :row="selectedRow"
              :bundle="bundle"
              @review="openReview"
              @open-file="openFile()"
              @add-work-item="openWorkItemEditor"
            />
            <SourcePreviewPanel
              :row="selectedRow"
              :state="investigationStore.preview"
              :verdict="verdict"
              :note-path="notePath"
              @reload="reloadPreview"
              @open-in-obsidian="openInObsidian"
            />
            <UncertaintyPanel
              :uncertainties="uncertainties"
              :checklist="checklist"
            />
          </template>
          <p
            v-else
            class="ci-note ci-investigate__none-selected"
          >
            {{ INVESTIGATE_NONE_SELECTED }}
          </p>
        </div>
      </div>
    </template>
    <FindingReviewDialog
      v-if="reviewing"
      :fingerprint="reviewing"
      @close="closeReview"
      @open-file="openFile"
    />
    <WorkItemEditor
      v-if="addingWorkItem && selectedRow"
      :item-id="null"
      :new-file="selectedRow.file"
      :draft="workDraft"
      @close="closeWorkItemEditor"
      @done="workItemDone"
    />
  </div>
</template>
