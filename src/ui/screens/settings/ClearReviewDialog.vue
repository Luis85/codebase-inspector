<script setup lang="ts">
import { computed } from 'vue';
import { useReportStore } from '../../stores/report-store';
import { useReviewStore } from '../../stores/review-store';
import {
  SETTINGS_CLEAR_BUSY, SETTINGS_CLEAR_CANCEL, SETTINGS_CLEAR_CONFIRM, SETTINGS_CLEAR_DIALOG_TEXT, SETTINGS_CLEAR_DIALOG_TITLE,
  SETTINGS_CLEAR_FAILED, SETTINGS_CLEARED,
} from '../../inspector-copy';
import CiDialog from '../../kit/Dialog.vue';
import { useBusyAction } from '../../kit/use-busy-action';

const emit = defineEmits<{ close: []; done: [message: string] }>();
const review = useReviewStore();
const report = useReportStore();
const { busy, error, requestClose: requestCloseWith, run } = useBusyAction();
const text = computed(() => SETTINGS_CLEAR_DIALOG_TEXT(review.workItems.length, review.dispositions.length, review.rules.length));

/** Fix round 1, Minor 4: while a clear is in flight, Cancel, Escape and the backdrop
 *  click (all routed through CiDialog's `close`) are ignored — the dialog closing mid-
 *  clear would unmount it and lose the outcome (the announcement or the error). */
function requestClose(): void {
  requestCloseWith(() => emit('close'));
}

/** W14: everything goes through the port first (clearAll reloads from it); the report
 *  choices and note are reset with it. The dialog closes and the screen announces.
 *  Part 5 P1/E2: `clearAll()` refuses (false) while a change is still pending — an update
 *  whose save lands after the clear would otherwise be written back into the port and
 *  reappear on the next load. That refusal keeps the dialog open, resets nothing and
 *  announces nothing (E17), same as a rejection but with its own message. */
function confirm(): Promise<void> {
  return run(async () => {
    if (await review.clearAll()) {
      report.reset();
      emit('done', SETTINGS_CLEARED);
    } else {
      error.value = SETTINGS_CLEAR_BUSY;
    }
  }, SETTINGS_CLEAR_FAILED);
}
</script>

<template>
  <CiDialog
    :label="SETTINGS_CLEAR_DIALOG_TITLE"
    @close="requestClose"
  >
    <div class="ci-clear-dialog">
      <h3>{{ SETTINGS_CLEAR_DIALOG_TITLE }}</h3>
      <p>{{ text }}</p>
      <p
        v-if="error"
        class="ci-clear-dialog__error"
        role="alert"
      >
        {{ error }}
      </p>
      <div class="ci-clear-dialog__actions">
        <button
          type="button"
          class="ci-clear-dialog__cancel"
          :aria-disabled="busy ? 'true' : undefined"
          @click="requestClose"
        >
          {{ SETTINGS_CLEAR_CANCEL }}
        </button>
        <button
          type="button"
          class="mod-warning ci-clear-dialog__confirm"
          :aria-disabled="busy ? 'true' : undefined"
          @click="confirm"
        >
          {{ SETTINGS_CLEAR_CONFIRM }}
        </button>
      </div>
    </div>
  </CiDialog>
</template>
