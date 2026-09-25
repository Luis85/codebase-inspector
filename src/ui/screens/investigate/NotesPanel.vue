<!--
  WP-04 IN26, IN30, IN31 (IP24, IP38): the selected finding's linked notes — each with its
  status, an Open button and Refresh evidence… — and Create investigation note…. The notes arrive already
  sorted by path (noteIndexFor, IN30). Every value is interpolated text only (IN17). The
  screen owns the async open and its guard (the same split as SourcePreviewPanel's Open in
  Obsidian): this panel reflects `opening` and `openFailed` and guards its own presses
  synchronously (E40). `.ci-notes-panel__create` and `.ci-notes-panel__open` (+ `data-path`)
  are the classes Tasks 16 and 17 click (IPF12).
-->
<script setup lang="ts">
import type { NoteLink } from '../../../application/investigation/note-index';
import {
  NOTE_CREATE_OPEN, NOTE_OPEN, NOTE_OPEN_FAILED, NOTE_OPEN_LABEL, NOTE_PANEL_NONE, NOTE_PANEL_TITLE, NOTE_STATUS, REFRESH_OPEN,
  REFRESH_OPEN_LABEL,
} from '../../audit-copy/investigation';
import Panel from '../../kit/Panel.vue';

const props = defineProps<{
  notes: readonly NoteLink[]; createBlocked: boolean;
  /** True while an Open is in flight; `openFailed` is the path whose last Open failed. */
  opening: boolean; openFailed: string | null;
}>();
// Task 14 (IN31): each note's Refresh evidence… opens the refresh dialog for that note.
const emit = defineEmits<{ create: []; open: [path: string]; refresh: [link: NoteLink] }>();

function guardedCreate(): void {
  if (!props.createBlocked) emit('create');
}
function guardedOpen(path: string): void {
  if (!props.opening) emit('open', path);
}
</script>

<template>
  <Panel :title="NOTE_PANEL_TITLE">
    <template #actions>
      <button
        type="button"
        class="ci-notes-panel__create"
        :aria-disabled="createBlocked ? 'true' : undefined"
        @click="guardedCreate"
      >
        {{ NOTE_CREATE_OPEN }}
      </button>
    </template>
    <p
      v-if="notes.length === 0"
      class="ci-note ci-notes-panel__none"
    >
      {{ NOTE_PANEL_NONE }}
    </p>
    <ul
      v-else
      class="ci-notes-panel__list"
    >
      <li
        v-for="link in notes"
        :key="link.path"
        class="ci-notes-panel__item"
      >
        <span class="ci-notes-panel__path">{{ link.path }}</span>
        <span class="ci-notes-panel__status">{{ NOTE_STATUS(link.status) }}</span>
        <button
          type="button"
          class="ci-notes-panel__open"
          :data-path="link.path"
          :aria-label="NOTE_OPEN_LABEL(link.path)"
          :aria-disabled="opening ? 'true' : undefined"
          @click="guardedOpen(link.path)"
        >
          {{ NOTE_OPEN }}
        </button>
        <button
          type="button"
          class="ci-notes-panel__refresh"
          :data-path="link.path"
          :aria-label="REFRESH_OPEN_LABEL(link.path)"
          @click="emit('refresh', link)"
        >
          {{ REFRESH_OPEN }}
        </button>
        <p
          v-if="openFailed === link.path"
          class="ci-notes-panel__open-error"
          role="alert"
        >
          {{ NOTE_OPEN_FAILED }}
        </p>
      </li>
    </ul>
  </Panel>
</template>
