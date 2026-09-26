<!--
  WP-04 IN31-IN34 (IP25; E15, E17, E40, IPF9): the refresh dialog. It names the snapshot
  change (old, from the note's frontmatter, to new), any source-path change, and the evidence
  state and line the new block records — the note stores no old line or state, so those are
  never compared (IP25). Nothing is written until Refresh evidence. The screen's composable
  owns the write and its outcome (use-note-refresh.ts, E22-E24): a refreshed or partial
  result closes this dialog and is announced there; every refusal stays in this dialog's own
  role="alert" line (or is announced, when this dialog closed meanwhile) and changed nothing. The busy/error scaffold is use-busy-action (IPF9),
  and both buttons are aria-disabled with guarded handlers while the write runs (E40).
-->
<script setup lang="ts">
import type { NoteLink } from '../../../application/investigation/note-index';
import type { RefreshNoteRequest } from '../../../application/ports/investigation-notes-port';
import type { RefreshChanges } from '../../read-models/investigation-evidence';
import { refreshWords, type SubmitRefresh } from './use-note-refresh';
import { useBusyAction } from '../../kit/use-busy-action';
import {
  REFRESH_AFTER, REFRESH_CANCEL, REFRESH_CONFIRM, REFRESH_EXPLAIN, REFRESH_FAILED, REFRESH_LINE, REFRESH_SNAPSHOT, REFRESH_SOURCE_PATH,
  REFRESH_STATE, REFRESH_TITLE,
} from '../../audit-copy/investigation';
import CiDialog from '../../kit/Dialog.vue';

const props = defineProps<{ link: NoteLink; changes: RefreshChanges; request: RefreshNoteRequest; submit: SubmitRefresh }>();
const emit = defineEmits<{ close: [] }>();
const { busy, error, requestClose: requestCloseWith, run } = useBusyAction();

function requestClose(): void {
  requestCloseWith(() => emit('close'));
}

function confirm(): Promise<void> {
  if (busy.value) return Promise.resolve();
  return run(async () => {
    const result = await props.submit(props.request);
    if (result === 'refreshed' || result === 'partial') return;   // the screen closes this dialog
    error.value = refreshWords(result, props.request.path);
  }, REFRESH_FAILED['write-failed']);
}
</script>

<template>
  <CiDialog
    :label="REFRESH_TITLE"
    @close="requestClose"
  >
    <div class="ci-refresh-note">
      <h3>{{ REFRESH_TITLE }}</h3>
      <p class="ci-refresh-note__path">
        <code>{{ link.path }}</code>
      </p>
      <p class="ci-refresh-note__explain">
        {{ REFRESH_EXPLAIN }}
      </p>
      <ul
        v-if="changes.snapshot || changes.sourcePath"
        class="ci-refresh-note__changes"
      >
        <li
          v-if="changes.snapshot"
          class="ci-refresh-note__snapshot"
        >
          {{ REFRESH_SNAPSHOT(changes.snapshot.from, changes.snapshot.to) }}
        </li>
        <li
          v-if="changes.sourcePath"
          class="ci-refresh-note__source"
        >
          {{ REFRESH_SOURCE_PATH(changes.sourcePath.from, changes.sourcePath.to) }}
        </li>
      </ul>
      <p class="ci-refresh-note__after-label">
        {{ REFRESH_AFTER }}
      </p>
      <ul class="ci-refresh-note__after">
        <li class="ci-refresh-note__state">
          {{ REFRESH_STATE[changes.state] }}
        </li>
        <li
          v-if="changes.state !== 'not-reported'"
          class="ci-refresh-note__line"
        >
          {{ REFRESH_LINE(changes.line, changes.endLine) }}
        </li>
      </ul>
      <p
        v-if="error"
        class="ci-refresh-note__error"
        role="alert"
      >
        {{ error }}
      </p>
      <div class="ci-refresh-note__actions">
        <button
          type="button"
          class="ci-refresh-note__cancel"
          :aria-disabled="busy ? 'true' : undefined"
          @click="requestClose"
        >
          {{ REFRESH_CANCEL }}
        </button>
        <button
          type="button"
          class="mod-cta ci-refresh-note__confirm"
          :aria-disabled="busy ? 'true' : undefined"
          @click="confirm"
        >
          {{ REFRESH_CONFIRM }}
        </button>
      </div>
    </div>
  </CiDialog>
</template>
