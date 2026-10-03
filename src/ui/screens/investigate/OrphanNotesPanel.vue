<!--
  WP-04 IN34, IN36 (O6, IP38): the notes for findings not in this report — a changed
  analysis is not completion, so each keeps its status, is listed by path (the read model's
  order) and can be opened or refreshed; a malformed note is counted, never dropped. Every
  value is interpolated text only (IN17). As NotesPanel, the screen owns the async open and
  its guard: this panel reflects `opening` and `openFailed` and guards its own presses (E40).
-->
<script setup lang="ts">
import type { NoteLink } from '../../../application/investigation/note-index';
import {
  NOTE_OPEN, NOTE_OPEN_FAILED, NOTE_OPEN_LABEL, NOTE_STATUS, NOTES_MALFORMED, NOTES_ORPHAN_TEXT, NOTES_ORPHAN_TITLE, REFRESH_OPEN,
  REFRESH_OPEN_LABEL,
} from '../../audit-copy/investigation';
import Panel from '../../kit/Panel.vue';

const props = defineProps<{
  notes: readonly NoteLink[]; malformed: number;
  /** True while an Open is in flight; `openFailed` is the path whose last Open failed. */
  opening: boolean; openFailed: string | null;
}>();
const emit = defineEmits<{ open: [path: string]; refresh: [link: NoteLink] }>();

function guardedOpen(path: string): void {
  if (!props.opening) emit('open', path);
}
</script>

<template>
  <Panel :title="NOTES_ORPHAN_TITLE">
    <template v-if="notes.length > 0">
      <p class="ci-note ci-orphan-notes__text">
        {{ NOTES_ORPHAN_TEXT }}
      </p>
      <ul class="ci-orphan-notes__list">
        <li
          v-for="link in notes"
          :key="link.path"
          class="ci-orphan-notes__item"
        >
          <span class="ci-orphan-notes__path">{{ link.path }}</span>
          <span class="ci-orphan-notes__status">{{ NOTE_STATUS(link.status) }}</span>
          <button
            type="button"
            class="ci-orphan-notes__open"
            :data-path="link.path"
            :aria-label="NOTE_OPEN_LABEL(link.path)"
            :aria-disabled="opening ? 'true' : undefined"
            @click="guardedOpen(link.path)"
          >
            {{ NOTE_OPEN }}
          </button>
          <button
            type="button"
            class="ci-orphan-notes__refresh"
            :data-path="link.path"
            :aria-label="REFRESH_OPEN_LABEL(link.path)"
            @click="emit('refresh', link)"
          >
            {{ REFRESH_OPEN }}
          </button>
          <p
            v-if="openFailed === link.path"
            class="ci-orphan-notes__open-error"
            role="alert"
          >
            {{ NOTE_OPEN_FAILED }}
          </p>
        </li>
      </ul>
    </template>
    <p
      v-if="malformed > 0"
      class="ci-note ci-orphan-notes__malformed"
    >
      {{ NOTES_MALFORMED(malformed) }}
    </p>
  </Panel>
</template>
