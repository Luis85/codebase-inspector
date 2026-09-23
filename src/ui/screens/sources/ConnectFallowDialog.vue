<script setup lang="ts">
// Part 6 Y38 (S14): Connect fallow.
// - Step 1 picks a report through this component's own hidden file input. That is the only
//   report read. The input sits beside CiDialog's panel, not in it, because CiDialog's focus
//   selector includes `input:not([disabled])`: inside the panel it would break the Tab trap.
// - Step 2 reviews how the report matches the snapshot on screen, then attaches it through
//   the evidence store.
// - Part 7 Z29: step 1 also offers "Run installed fallow" (FallowInstalledRoute.vue, in this
//   same dialog and under its busy action); nothing runs before its "Trust and run".
// Nothing is installed. A failure never touches the attached evidence (Y31), and report
// text is only ever interpolated (E34).
import { computed, nextTick, onBeforeUnmount, ref, shallowRef, watch } from 'vue';
import { formatAbsoluteTime } from '../../copy';
import { readFallowReportFile, reviewFallowCandidate, type FallowCandidate } from '../../read-models/fallow-candidate';
import { useReadModels } from '../../read-models/use-read-models';
import { useCityStore } from '../../stores/city-store';
import { useEvidenceStore } from '../../stores/evidence-store';
import { useAnalysisStore } from '../../stores/analysis-store';
import { useUniqueId } from '../../unique-id';
import {
  FALLOW_ATTACH, FALLOW_ATTACH_REFUSED, FALLOW_ATTACHED, FALLOW_CANCEL, FALLOW_CHOOSE, FALLOW_DIALOG_EYEBROW,
  FALLOW_DIALOG_INTRO, FALLOW_DIALOG_TITLE, FALLOW_DISCLOSURE, FALLOW_IMPORT_ERROR, FALLOW_INSTALL_NOTE, FALLOW_MAPPING_OFFER,
  FALLOW_REPLACE_NOTE, FALLOW_REVIEW_TITLE, FALLOW_ROUTE_IMPORT_TEXT, FALLOW_ROUTE_IMPORT_TITLE, FALLOW_ROUTE_RUN_ACTION,
  FALLOW_ROUTE_RUN_TEXT, FALLOW_ROUTE_RUN_TITLE, FALLOW_RUN_BUSY_HINT, FALLOW_SNAPSHOT_FILES,
} from '../../inspector-copy';
import CiDialog from '../../kit/Dialog.vue';
import { reannounce } from '../../kit/reannounce';
import { useBusyAction } from '../../kit/use-busy-action';
import FallowReportFacts from './FallowReportFacts.vue';
import FallowInstalledRoute from './FallowInstalledRoute.vue';
import type { InstalledRouteStart } from '../../read-models/fallow-run';

/** Part 7 Z29: which route opens first; the installed route's own starting point. */
const props = withDefaults(defineProps<{ initialRoute?: 'choose' | 'installed'; installed?: InstalledRouteStart }>(), { initialRoute: 'choose', installed: undefined });
const emit = defineEmits<{ close: []; done: [message: string]; busy: [busy: boolean, failed: boolean] }>();
const route = ref<'choose' | 'installed'>(props.initialRoute);
const city = useCityStore();
const evidence = useEvidenceStore();
const analysis = useAnalysisStore();
const { files } = useReadModels();
/** K32: one busy action for both routes, so Cancel/Escape/backdrop stay ignored mid-step. */
const action = useBusyAction();
const { busy, error, requestClose: requestCloseWith, run } = action;
/** Polish C10 (L23 as amended): SourcesScreen holds a newer request while a step is in flight.
 *  `failed`: the step ended with a refusal in the alert, which a held request must not erase
 *  (E13). Sync, so a request in the same tick as the step's start is already held. */
watch(busy, (now) => { emit('busy', now, !now && error.value !== ''); }, { flush: 'sync' });
const importHeadingId = useUniqueId('ci-connect-fallow-import');
const runHeadingId = useUniqueId('ci-connect-fallow-run');
const mappingId = useUniqueId('ci-connect-fallow-mapping');
const busyHintId = useUniqueId('ci-connect-fallow-busy');
/** Part 4 E8/E11: the codebase this dialog was opened for. Every async step checks it again. */
const repositoryId = city.snapshot?.repositoryId ?? '';
const fileInput = ref<HTMLInputElement | null>(null);
const reviewHeading = ref<HTMLElement | null>(null);
const candidate = shallowRef<FallowCandidate | null>(null);
const mapped = ref(false);
const snapshotPaths = computed<ReadonlySet<string>>(() => new Set(files.value.map((f) => f.path)));
const review = computed(() => (candidate.value ? reviewFallowCandidate(candidate.value, snapshotPaths.value, mapped.value) : null));
/** Y31: re-importing while a report is attached says what it replaces. */
const replaceNote = computed(() => (evidence.report
  ? FALLOW_REPLACE_NOTE(formatAbsoluteTime(evidence.report.importedAt, Intl), evidence.report.collected === undefined ? 'imported' : 'collected') : ''));
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

/** Final review (Z32/K9): an import mid-run would supersede the run, and the command and Not
 *  analysed's Import open this dialog without the card's guard. So, while this codebase's
 *  fallow analysis is in flight, Choose and Attach are blocked here too (E40), with the
 *  busy hint; the dialog still opens, so the request is answered rather than dropped. */
const importBlocked = computed(() => busy.value || analysis.active);

/** Blocked while a read is in flight, or mid-run (aria-disabled plus this guard, E40). */
function choose(): void {
  if (importBlocked.value) return;
  fileInput.value?.click();
}

/** Part 7 Z29: the installed-analyzer route, inside this same dialog. */
function useInstalled(): void {
  if (busy.value) return;
  clearError();
  route.value = 'installed';
}
/** PF13: the installed route never writes to this dialog's action; it asks for the clear. */
function clearError(): void {
  error.value = '';
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
  if (importBlocked.value || !c || !review.value) return;
  if (!bound()) { drop(); return; }
  // Fix round 1 (M1): the report belongs to the snapshot on screen NOW, the one the review
  // resolved against, and is imported now. A silent same-codebase refresh after the read
  // would otherwise make the report read Stale the moment it is attached.
  const now = { ...c, snapshotId: city.snapshot?.snapshotId ?? '', importedAt: new Date().toISOString() };
  const r = reviewFallowCandidate(now, snapshotPaths.value, mapped.value);
  // E48 (M5): that refresh can also leave the report no match at all. Refused as at the
  // pick (Y26), in the dialog's alert; the attached evidence is untouched (Y31).
  if (r.mismatch) { void reannounce(error, FALLOW_IMPORT_ERROR['source-mismatch']('')); return; }
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
      <FallowInstalledRoute
        v-if="route === 'installed'"
        :start="installed"
        :action="action"
        @close="requestClose"
        @started="emit('done', '')"
        @clear-error="clearError"
      />
      <template v-else-if="!review">
        <p class="ci-connect-fallow__eyebrow">
          {{ FALLOW_DIALOG_EYEBROW }}
        </p>
        <h3>{{ FALLOW_DIALOG_TITLE }}</h3>
        <p>{{ FALLOW_DIALOG_INTRO }}</p>
        <p class="ci-note">
          {{ FALLOW_SNAPSHOT_FILES(files.length) }}
        </p>
        <section
          class="ci-connect-fallow__route"
          :aria-labelledby="importHeadingId"
        >
          <h4 :id="importHeadingId">
            {{ FALLOW_ROUTE_IMPORT_TITLE }}
          </h4>
          <p>{{ FALLOW_ROUTE_IMPORT_TEXT }}</p>
          <button
            type="button"
            class="mod-cta ci-connect-fallow__choose"
            :aria-disabled="importBlocked ? 'true' : undefined"
            :aria-describedby="analysis.active ? busyHintId : undefined"
            @click="choose"
          >
            {{ FALLOW_CHOOSE }}
          </button>
        </section>
        <section
          class="ci-connect-fallow__route"
          :aria-labelledby="runHeadingId"
        >
          <h4 :id="runHeadingId">
            {{ FALLOW_ROUTE_RUN_TITLE }}
          </h4>
          <p>{{ FALLOW_ROUTE_RUN_TEXT }}</p>
          <button
            type="button"
            class="ci-connect-fallow__use-installed"
            :aria-disabled="busy ? 'true' : undefined"
            @click="useInstalled"
          >
            {{ FALLOW_ROUTE_RUN_ACTION }}
          </button>
        </section>
        <p class="ci-connect-fallow__disclosure">
          {{ FALLOW_DISCLOSURE }} {{ FALLOW_INSTALL_NOTE }}
        </p>
      </template>
      <template v-else-if="review">
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
        v-if="route !== 'installed' && analysis.active"
        :id="busyHintId"
        class="ci-note ci-connect-fallow__busy"
      >
        {{ FALLOW_RUN_BUSY_HINT }}
      </p>
      <p
        v-if="error"
        class="ci-connect-fallow__error"
        role="alert"
      >
        {{ error }}
      </p>
      <div
        v-if="route !== 'installed'"
        class="ci-connect-fallow__actions"
      >
        <button
          type="button"
          class="ci-connect-fallow__cancel"
          :aria-disabled="busy ? 'true' : undefined"
          @click="requestClose"
        >
          {{ FALLOW_CANCEL }}
        </button>
        <button
          v-if="review"
          type="button"
          class="mod-cta ci-connect-fallow__attach"
          :aria-disabled="importBlocked ? 'true' : undefined"
          :aria-describedby="analysis.active ? busyHintId : undefined"
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
