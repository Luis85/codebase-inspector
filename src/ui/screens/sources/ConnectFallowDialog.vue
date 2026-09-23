<script setup lang="ts">
// Part 6 Y38 (S14): Connect fallow.
// - Step 1 picks a report through this component's own hidden file input. That is the only
//   file read. The input sits beside CiDialog's panel, not in it, because CiDialog's focus
//   selector includes `input:not([disabled])`: inside the panel it would break the Tab trap.
// - Step 2 reviews how the report matches the snapshot on screen, then attaches it through
//   the evidence store.
// Nothing is run or installed. A failure never touches the attached evidence (Y31), and
// report text is only ever interpolated (E34).
import { computed, nextTick, onBeforeUnmount, ref, shallowRef } from 'vue';
import { formatAbsoluteTime } from '../../copy';
import { readFallowReportFile, reviewFallowCandidate, type FallowCandidate } from '../../read-models/fallow-candidate';
import { useReadModels } from '../../read-models/use-read-models';
import { useCityStore } from '../../stores/city-store';
import { useEvidenceStore } from '../../stores/evidence-store';
import { useUniqueId } from '../../unique-id';
import {
  FALLOW_ATTACH, FALLOW_ATTACH_REFUSED, FALLOW_ATTACHED, FALLOW_CANCEL, FALLOW_CHOOSE, FALLOW_DIALOG_EYEBROW,
  FALLOW_DIALOG_INTRO, FALLOW_DIALOG_TITLE, FALLOW_DISCLOSURE, FALLOW_IMPORT_ERROR, FALLOW_MAPPING_OFFER,
  FALLOW_REPLACE_NOTE, FALLOW_REVIEW_TITLE, FALLOW_SNAPSHOT_FILES,
} from '../../inspector-copy';
import CiDialog from '../../kit/Dialog.vue';
import { reannounce } from '../../kit/reannounce';
import { useBusyAction } from '../../kit/use-busy-action';
import FallowReportFacts from './FallowReportFacts.vue';

const emit = defineEmits<{ close: []; done: [message: string] }>();
const city = useCityStore();
const evidence = useEvidenceStore();
const { files } = useReadModels();
const { busy, error, requestClose: requestCloseWith, run } = useBusyAction();
const mappingId = useUniqueId('ci-connect-fallow-mapping');
/** Part 4 E8/E11: the codebase this dialog was opened for. Every async step checks it again. */
const repositoryId = city.snapshot?.repositoryId ?? '';
const fileInput = ref<HTMLInputElement | null>(null);
const reviewHeading = ref<HTMLElement | null>(null);
const candidate = shallowRef<FallowCandidate | null>(null);
const mapped = ref(false);
const snapshotPaths = computed<ReadonlySet<string>>(() => new Set(files.value.map((f) => f.path)));
const review = computed(() => (candidate.value ? reviewFallowCandidate(candidate.value, snapshotPaths.value, mapped.value) : null));
/** Y31: re-importing while a report is attached says what it replaces. */
const replaceNote = computed(() => (evidence.report ? FALLOW_REPLACE_NOTE(formatAbsoluteTime(evidence.report.importedAt, Intl)) : ''));
let disposed = false;
onBeforeUnmount(() => { disposed = true; });

/** Part 6 E36: still the codebase on screen, AND the one the evidence store is bound to,
 *  because `attach` takes no expected id and writes to whatever the store is bound to. */
const bound = (): boolean =>
  repositoryId !== '' && city.snapshot?.repositoryId === repositoryId && evidence.repositoryId === repositoryId;
/** Part 6 E36: the codebase changed under a step, so it applies nothing and the dialog closes.
 *  After a city switch SourcesScreen has already unmounted it; nothing is emitted then. */
function drop(): void {
  if (!disposed) emit('close');
}

/** Part 4 E13: while a read is in flight, Cancel, Escape and the backdrop are ignored. */
function requestClose(): void {
  requestCloseWith(() => emit('close'));
}

/** Blocked while a read is in flight (aria-disabled plus this guard, E40). */
function choose(): void {
  if (busy.value) return;
  fileInput.value?.click();
}

/** One outcome per pick.
 *  - The input is emptied first, so picking the same file again still fires `change`.
 *  - A refusal is re-announced: a new pick clears the previous one.
 *  - The codebase is checked before the read starts and again when it lands; a late result
 *    is dropped silently (E36).
 *  - A report with findings, none of which match even with the offered mapping, is
 *    refused as a source mismatch (Y26). */
async function picked(): Promise<void> {
  const input = fileInput.value;
  const file = input?.files?.[0];
  if (input) input.value = '';
  if (!file) return;
  if (!bound()) { drop(); return; }
  await run(async () => {
    const result = await readFallowReportFile(file);
    if (!bound()) { drop(); return; }
    if (!result.ok) {
      await reannounce(error, FALLOW_IMPORT_ERROR[result.code](result.detail));
      return;
    }
    // For the review only: Attach sets both again from the snapshot on screen then (M1).
    const next: FallowCandidate = {
      raw: result.report, fileName: file.name, importedAt: new Date().toISOString(), snapshotId: city.snapshot?.snapshotId ?? '',
    };
    if (reviewFallowCandidate(next, snapshotPaths.value, false).mismatch) {
      await reannounce(error, FALLOW_IMPORT_ERROR['source-mismatch'](''));
      return;
    }
    mapped.value = false;
    candidate.value = next;
  }, FALLOW_IMPORT_ERROR['read-failed'](''));
  if (disposed || !candidate.value) return;
  await nextTick();
  reviewHeading.value?.focus();   // Choose has gone; focus stays inside the dialog
}

/** Y31/Y38: attaches through the port. `true` closes the dialog, and the screen announces
 *  it (E17). A refusal stays in the dialog's alert. E36: the codebase is checked once more
 *  immediately before `attach`; if it changed since the pick, nothing is applied. */
function attach(): void {
  const c = candidate.value;
  if (busy.value || !c || !review.value) return;
  if (!bound()) { drop(); return; }
  // Fix round 1 (M1): the report belongs to the snapshot on screen NOW, the one the review
  // resolved against, and is imported now. A silent same-codebase refresh after the read
  // would otherwise make the report read Stale the moment it is attached.
  const now = { ...c, snapshotId: city.snapshot?.snapshotId ?? '', importedAt: new Date().toISOString() };
  const r = reviewFallowCandidate(now, snapshotPaths.value, mapped.value);
  if (evidence.attach(r.report)) emit('done', FALLOW_ATTACHED(r.matchedFindings, r.matchedFiles));
  else void reannounce(error, FALLOW_ATTACH_REFUSED);
}
</script>

<template>
  <CiDialog
    :label="FALLOW_DIALOG_TITLE"
    @close="requestClose"
  >
    <div class="ci-connect-fallow">
      <template v-if="!review">
        <p class="ci-connect-fallow__eyebrow">
          {{ FALLOW_DIALOG_EYEBROW }}
        </p>
        <h3>{{ FALLOW_DIALOG_TITLE }}</h3>
        <p>{{ FALLOW_DIALOG_INTRO }}</p>
        <p class="ci-connect-fallow__disclosure">
          {{ FALLOW_DISCLOSURE }}
        </p>
        <p class="ci-note">
          {{ FALLOW_SNAPSHOT_FILES(files.length) }}
        </p>
      </template>
      <template v-else>
        <h3
          ref="reviewHeading"
          tabindex="-1"
        >
          {{ FALLOW_REVIEW_TITLE }}
        </h3>
        <FallowReportFacts
          :report="review.report"
          :matched-findings="review.matchedFindings"
          :matched-files="review.matchedFiles"
          :unmatched-paths="review.unmatchedPaths"
          wide
        />
        <p
          v-if="review.suggestion !== null"
          class="ci-connect-fallow__mapping"
        >
          <input
            :id="mappingId"
            v-model="mapped"
            type="checkbox"
          >
          <label :for="mappingId">{{ FALLOW_MAPPING_OFFER(review.suggestion) }}</label>
        </p>
        <p
          v-if="replaceNote"
          class="ci-connect-fallow__replace"
        >
          {{ replaceNote }}
        </p>
      </template>
      <p
        v-if="error"
        class="ci-connect-fallow__error"
        role="alert"
      >
        {{ error }}
      </p>
      <div class="ci-connect-fallow__actions">
        <button
          type="button"
          class="ci-connect-fallow__cancel"
          :aria-disabled="busy ? 'true' : undefined"
          @click="requestClose"
        >
          {{ FALLOW_CANCEL }}
        </button>
        <button
          v-if="!review"
          type="button"
          class="mod-cta ci-connect-fallow__choose"
          :aria-disabled="busy ? 'true' : undefined"
          @click="choose"
        >
          {{ FALLOW_CHOOSE }}
        </button>
        <button
          v-else
          type="button"
          class="mod-cta ci-connect-fallow__attach"
          :aria-disabled="busy ? 'true' : undefined"
          @click="attach"
        >
          {{ FALLOW_ATTACH }}
        </button>
      </div>
    </div>
  </CiDialog>
  <input
    ref="fileInput"
    type="file"
    accept=".json,application/json"
    class="visually-hidden ci-connect-fallow__file"
    tabindex="-1"
    aria-hidden="true"
    @change="picked"
  >
</template>
