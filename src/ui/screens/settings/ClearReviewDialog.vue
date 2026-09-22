<script setup lang="ts">
import { computed, ref } from 'vue';
import { useReportStore } from '../../stores/report-store';
import { useReviewStore } from '../../stores/review-store';
import {
  SETTINGS_CLEAR_CANCEL, SETTINGS_CLEAR_CONFIRM, SETTINGS_CLEAR_DIALOG_TEXT, SETTINGS_CLEAR_DIALOG_TITLE, SETTINGS_CLEAR_FAILED,
  SETTINGS_CLEARED,
} from '../../inspector-copy';
import CiDialog from '../../kit/Dialog.vue';

const emit = defineEmits<{ close: []; done: [message: string] }>();
const review = useReviewStore();
const report = useReportStore();
const busy = ref(false);
const error = ref('');
const text = computed(() => SETTINGS_CLEAR_DIALOG_TEXT(review.workItems.length, review.dispositions.length, review.rules.length));

/** W14: everything goes through the port first (clearAll reloads from it); the report
 *  choices and note are reset with it. The dialog closes and the screen announces. */
async function confirm(): Promise<void> {
  if (busy.value) return;
  busy.value = true;
  error.value = '';
  try {
    await review.clearAll();
    report.reset();
    emit('done', SETTINGS_CLEARED);
  } catch {
    error.value = SETTINGS_CLEAR_FAILED;
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <CiDialog
    :label="SETTINGS_CLEAR_DIALOG_TITLE"
    @close="emit('close')"
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
          @click="emit('close')"
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
