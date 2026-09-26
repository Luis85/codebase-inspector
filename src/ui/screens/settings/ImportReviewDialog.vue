<script setup lang="ts">
// Part 5 V16: confirms an import. Replace goes through the store (`replaceAll`: persist
// first, reload after). Only `true` closes the dialog and announces (E17). A refusal or a
// rejection stays in the dialog's own alert. Imported text is only ever interpolated,
// never rendered as HTML (V15).
import { computed } from 'vue';
import { reviewFailureText } from '../../read-models/review-failure';
import { useCityStore } from '../../stores/city-store';
import { useReportStore } from '../../stores/report-store';
import { useReviewStore } from '../../stores/review-store';
import {
  IMPORT_BUSY, IMPORT_CANCEL, IMPORT_CONFIRM, IMPORT_CONFIRM_TEXT, IMPORT_DIALOG_TITLE, IMPORT_FAILED, IMPORT_ORIGIN,
  IMPORT_ORIGIN_UNKNOWN, IMPORT_REPLACE_TEXT, IMPORT_STALE, IMPORTED,
} from '../../inspector-copy';
import CiDialog from '../../kit/Dialog.vue';
import { useBusyAction } from '../../kit/use-busy-action';
import type { ImportCandidate } from './import-candidate';

const props = defineProps<{ candidate: ImportCandidate }>();
const emit = defineEmits<{ close: []; done: [message: string] }>();
const city = useCityStore();
const review = useReviewStore();
const report = useReportStore();
const { busy, error, requestClose: requestCloseWith, run } = useBusyAction();
const counts = computed(() => IMPORT_CONFIRM_TEXT(
  props.candidate.state.workItems.length, props.candidate.state.dispositions.length,
  props.candidate.state.rules.length, props.candidate.state.report.note !== '',
));
const origin = computed(() => (props.candidate.state.origin ? IMPORT_ORIGIN(props.candidate.state.origin.folder) : IMPORT_ORIGIN_UNKNOWN));

/** Part 4 E13: while the replacement is in flight, Cancel, Escape and the backdrop (all
 *  routed through CiDialog's `close`) are ignored, so the outcome is never lost. */
function requestClose(): void {
  requestCloseWith(() => emit('close'));
}

/** Part 5 E19: defence in depth against SettingsScreen's own close-on-switch watcher —
 *  this check runs SYNCHRONOUSLY, before any `await`, so it catches a codebase switch that
 *  races ahead of that (deferred) watcher too. A mismatch applies nothing.
 *
 *  Part 5 E20: a SECOND check after `replaceAll` resolves catches a switch that landed
 *  WHILE it was running. That check comes before the true/false split, not after: a
 *  `false` `replaceAll` now returned either because it was genuinely busy (repositoryId
 *  unchanged — show IMPORT_BUSY, as before) or because the codebase changed mid-flight
 *  (review-store's own guard) — those need different handling, and only the repositoryId
 *  check tells them apart. On a mismatch — true or false — nothing further is applied and
 *  nothing is announced: report.restore no-ops on its own mismatch guard regardless, and
 *  SettingsScreen's watcher has already closed this dialog. */
function confirm(): Promise<void> {
  return run(async () => {
    if (city.snapshot?.repositoryId !== props.candidate.repositoryId) {
      error.value = IMPORT_STALE;
      return;
    }
    const { workItems, rules, dispositions } = props.candidate.state;
    const replaced = await review.replaceAll({ workItems, rules, dispositions });
    if (city.snapshot?.repositoryId !== props.candidate.repositoryId) return;
    if (replaced) {
      report.restore(props.candidate.repositoryId, props.candidate.state.report.sections, props.candidate.state.report.note);
      emit('done', IMPORTED(workItems.length, dispositions.length, rules.length));
    } else {
      error.value = IMPORT_BUSY;
    }
  }, (e) => reviewFailureText(e, IMPORT_FAILED));   // Polish 5b (L3): a refused write names its reason
}
</script>

<template>
  <CiDialog
    :label="IMPORT_DIALOG_TITLE"
    @close="requestClose"
  >
    <div class="ci-import-dialog">
      <h3>{{ IMPORT_DIALOG_TITLE }}</h3>
      <p class="ci-import-dialog__counts">
        {{ counts }}
      </p>
      <p class="ci-import-dialog__origin">
        {{ origin }}
      </p>
      <p class="ci-note">
        {{ IMPORT_REPLACE_TEXT }}
      </p>
      <p
        v-if="error"
        class="ci-import-dialog__error"
        role="alert"
      >
        {{ error }}
      </p>
      <div class="ci-import-dialog__actions">
        <button
          type="button"
          class="ci-import-dialog__cancel"
          :aria-disabled="busy ? 'true' : undefined"
          @click="requestClose"
        >
          {{ IMPORT_CANCEL }}
        </button>
        <button
          type="button"
          class="mod-cta ci-import-dialog__confirm"
          :aria-disabled="busy ? 'true' : undefined"
          @click="confirm"
        >
          {{ IMPORT_CONFIRM }}
        </button>
      </div>
    </div>
  </CiDialog>
</template>
