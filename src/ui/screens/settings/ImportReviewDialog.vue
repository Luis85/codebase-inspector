<script setup lang="ts">
// Part 5 V16: confirms an import. Replace goes through the store (`replaceAll`: persist
// first, reload after). Only `true` closes the dialog and announces (E17). A refusal or a
// rejection stays in the dialog's own alert. Imported text is only ever interpolated,
// never rendered as HTML (V15).
import { computed, ref } from 'vue';
import type { ImportedReviewState } from '../../read-models/review-state-import';
import { useReportStore } from '../../stores/report-store';
import { useReviewStore } from '../../stores/review-store';
import {
  IMPORT_BUSY, IMPORT_CANCEL, IMPORT_CONFIRM, IMPORT_CONFIRM_TEXT, IMPORT_DIALOG_TITLE, IMPORT_FAILED, IMPORT_ORIGIN,
  IMPORT_ORIGIN_UNKNOWN, IMPORT_REPLACE_TEXT, IMPORTED,
} from '../../inspector-copy';
import CiDialog from '../../kit/Dialog.vue';

const props = defineProps<{ state: ImportedReviewState }>();
const emit = defineEmits<{ close: []; done: [message: string] }>();
const review = useReviewStore();
const report = useReportStore();
const busy = ref(false);
const error = ref('');
const counts = computed(() => IMPORT_CONFIRM_TEXT(
  props.state.workItems.length, props.state.dispositions.length, props.state.rules.length, props.state.report.note !== '',
));
const origin = computed(() => (props.state.origin ? IMPORT_ORIGIN(props.state.origin.folder) : IMPORT_ORIGIN_UNKNOWN));

/** Part 4 E13: while the replacement is in flight, Cancel, Escape and the backdrop (all
 *  routed through CiDialog's `close`) are ignored, so the outcome is never lost. */
function requestClose(): void {
  if (busy.value) return;
  emit('close');
}

async function confirm(): Promise<void> {
  if (busy.value) return;
  busy.value = true;
  error.value = '';
  try {
    const { workItems, rules, dispositions } = props.state;
    if (await review.replaceAll({ workItems, rules, dispositions })) {
      report.restore(props.state.report.sections, props.state.report.note);
      emit('done', IMPORTED(workItems.length, dispositions.length, rules.length));
    } else {
      error.value = IMPORT_BUSY;
    }
  } catch {
    error.value = IMPORT_FAILED;
  } finally {
    busy.value = false;
  }
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
