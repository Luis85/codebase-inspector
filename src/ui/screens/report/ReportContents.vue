<script setup lang="ts">
import { nextTick, ref, watch } from 'vue';
import { REPORT_NOTE_MAX, REPORT_SECTIONS, useReportStore } from '../../stores/report-store';
import { useUniqueId } from '../../unique-id';
import {
  REPORT_CALLOUT, REPORT_CALLOUT_TITLE, REPORT_CONTENTS_SUBTITLE, REPORT_CONTENTS_TITLE, REPORT_NOTE_APPLIED, REPORT_NOTE_APPLY,
  REPORT_NOTE_LABEL, REPORT_NOTE_PANEL_SUBTITLE, REPORT_NOTE_PANEL_TITLE, REPORT_NOTE_TOO_LONG, REPORT_SECTION_LABEL,
} from '../../inspector-copy';
import Panel from '../../kit/Panel.vue';
import Callout from '../../kit/Callout.vue';
import Icon from '../../kit/Icon.vue';

const emit = defineEmits<{ announce: [message: string] }>();
const report = useReportStore();
const noteId = useUniqueId('ci-report-note');
const errorId = useUniqueId('ci-report-note-error');
const draft = ref(report.note);
const error = ref('');

// A fresh edit invalidates the previous refusal; the error only ever reflects the
// most recent "Apply note" press.
watch(draft, () => { error.value = ''; });

/** A repeated identical refusal must be announced again (role="alert" only fires a live
 *  region on a real text change), so the message is cleared and re-set after a tick. */
async function apply(): Promise<void> {
  error.value = '';
  await nextTick();
  if (report.applyNote(draft.value)) emit('announce', REPORT_NOTE_APPLIED);
  else error.value = REPORT_NOTE_TOO_LONG(REPORT_NOTE_MAX);
}
</script>

<template>
  <aside class="ci-report-contents">
    <Panel
      :title="REPORT_CONTENTS_TITLE"
      :subtitle="REPORT_CONTENTS_SUBTITLE"
    >
      <label
        v-for="s in REPORT_SECTIONS"
        :key="s"
        class="ci-report-contents__check"
      >
        <input
          type="checkbox"
          :value="s"
          :checked="report.sections[s]"
          @change="report.setSection(s, ($event.target as HTMLInputElement).checked)"
        >
        {{ REPORT_SECTION_LABEL[s] }}
      </label>
    </Panel>
    <Panel
      :title="REPORT_NOTE_PANEL_TITLE"
      :subtitle="REPORT_NOTE_PANEL_SUBTITLE"
    >
      <label
        class="visually-hidden"
        :for="noteId"
      >{{ REPORT_NOTE_LABEL }}</label>
      <textarea
        :id="noteId"
        v-model="draft"
        class="ci-report-contents__note"
        :maxlength="REPORT_NOTE_MAX"
        :aria-describedby="error ? errorId : undefined"
        :aria-invalid="error ? 'true' : undefined"
      />
      <p
        v-if="error"
        :id="errorId"
        class="ci-report-contents__error"
        role="alert"
      >
        {{ error }}
      </p>
      <button
        type="button"
        class="ci-report-contents__apply"
        @click="apply"
      >
        <Icon name="check" />
        {{ REPORT_NOTE_APPLY }}
      </button>
    </Panel>
    <Callout
      tone="warning"
      :title="REPORT_CALLOUT_TITLE"
    >
      {{ REPORT_CALLOUT }}
    </Callout>
  </aside>
</template>
