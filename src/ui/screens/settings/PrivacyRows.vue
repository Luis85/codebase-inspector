<script setup lang="ts">
import { computed, onMounted } from 'vue';
import {
  REVIEW_RECORDS_SKIPPED, REVIEW_STORE_READ_FAILED, REVIEW_STORE_RETIRED_NOTE, REVIEW_STORE_UNSUPPORTED_NOTE,
  SETTINGS_CLEAR, SETTINGS_CLEAR_HINT, SETTINGS_CLEAR_OPEN, SETTINGS_CLEAR_TEXT, SETTINGS_EXPORT, SETTINGS_NETWORK,
  SETTINGS_NETWORK_TEXT, SETTINGS_NETWORK_VALUE, SETTINGS_STORAGE, SETTINGS_STORAGE_TEXT,
  NOTES_FOLDER_ROW_DEFAULT, NOTES_FOLDER_ROW_FAILED, NOTES_FOLDER_ROW_NO_CODEBASE, NOTES_FOLDER_ROW_TEXT, NOTES_FOLDER_ROW_TITLE,
} from '../../inspector-copy';
import { useReviewStore } from '../../stores/review-store';
import { useEvidenceStore } from '../../stores/evidence-store';
import { useInvestigationStore } from '../../stores/investigation-store';
import { useUniqueId } from '../../unique-id';
import type { ImportCandidate } from './import-candidate';
import ImportRow from './ImportRow.vue';
import { useReviewWriteGate } from './review-write-gate';

const emit = defineEmits<{ clear: []; export: []; parsed: [candidate: ImportCandidate] }>();
const review = useReviewStore();
/** WP-04 IN18: the bound codebase's notes folder, read-only (it is set in Obsidian's settings tab). */
const evidence = useEvidenceStore();
const investigation = useInvestigationStore();
// Task 10 review, item 1: the folder is changed in Obsidian's settings tab, which has no
// change signal, so the row re-reads it each time it mounts.
onMounted(() => { void investigation.loadDestination(); });
const clearHintId = useUniqueId('ci-settings-clear-hint');
const storageNoteId = useUniqueId('ci-settings-storage-note');
const clearGate = useReviewWriteGate(clearHintId, storageNoteId);
/** Part 6 Y7/R3: one line about the bound codebase's saved review state, shown only while
 *  it could not be read, is read-only, or has records that could not be read. */
const storageNote = computed((): string => {
  const { skipped, unsupported, retired } = review.storageDiagnostics;
  if (review.loadFailed) return REVIEW_STORE_READ_FAILED;
  if (retired === true) return REVIEW_STORE_RETIRED_NOTE;   // Polish 5b fix round: removed, not a format problem
  if (unsupported) return REVIEW_STORE_UNSUPPORTED_NOTE;
  return skipped > 0 ? REVIEW_RECORDS_SKIPPED(skipped) : '';
});
/** Part 6 R3/E29: blocked (aria-disabled plus this guard, E40) while no codebase is on
 *  screen — the saved review state belongs to one codebase — and while its saved state is
 *  unread (review-write-gate.ts). Announces nothing (E17). */
function requestClear(): void {
  if (clearGate.blocked.value) return;
  emit('clear');
}
</script>

<template>
  <div class="ci-setting-row">
    <div>
      <h3>{{ SETTINGS_NETWORK }}</h3>
      <p class="ci-note">
        {{ SETTINGS_NETWORK_TEXT }}
      </p>
    </div>
    <span class="ci-chip ci-chip--success">{{ SETTINGS_NETWORK_VALUE }}</span>
  </div>
  <div class="ci-setting-row">
    <div>
      <h3>{{ SETTINGS_STORAGE }}</h3>
      <p class="ci-note">
        {{ SETTINGS_STORAGE_TEXT }}
      </p>
      <p
        v-if="storageNote !== ''"
        :id="storageNoteId"
        class="ci-note ci-settings__storage-note"
      >
        {{ storageNote }}
      </p>
    </div>
    <!-- Controller ruling X18: Privacy & storage gets its own export action next to
         the header's, so a reviewer can export just before clearing without scrolling. -->
    <button
      type="button"
      class="ci-settings__export-privacy"
      @click="emit('export')"
    >
      {{ SETTINGS_EXPORT }}
    </button>
  </div>
  <div class="ci-setting-row ci-settings__notes-folder">
    <div>
      <h3>{{ NOTES_FOLDER_ROW_TITLE }}</h3>
      <p class="ci-note">
        {{ evidence.repositoryId === '' ? NOTES_FOLDER_ROW_NO_CODEBASE : NOTES_FOLDER_ROW_TEXT }}
      </p>
      <p
        v-if="evidence.repositoryId !== '' && investigation.destinationFailed"
        class="ci-note ci-settings__notes-folder-failed"
      >
        {{ NOTES_FOLDER_ROW_FAILED }}
      </p>
    </div>
    <span v-if="evidence.repositoryId !== '' && investigation.destination !== null">
      <code class="ci-settings__notes-folder-value">{{ investigation.destination.folder }}</code>
      <span
        v-if="investigation.destination.isDefault"
        class="ci-note"
      >
        {{ NOTES_FOLDER_ROW_DEFAULT }}
      </span>
    </span>
  </div>
  <ImportRow
    :storage-note-id="storageNoteId"
    @parsed="emit('parsed', $event)"
  />
  <div class="ci-setting-row">
    <div>
      <h3>{{ SETTINGS_CLEAR }}</h3>
      <p class="ci-note">
        {{ SETTINGS_CLEAR_TEXT }}
      </p>
      <p
        v-if="clearGate.noCodebase.value"
        :id="clearHintId"
        class="ci-note ci-settings__clear-hint"
      >
        {{ SETTINGS_CLEAR_HINT }}
      </p>
    </div>
    <button
      type="button"
      class="mod-warning ci-settings__clear"
      :aria-disabled="clearGate.blocked.value ? 'true' : undefined"
      :aria-describedby="clearGate.describedBy.value"
      @click="requestClear"
    >
      {{ SETTINGS_CLEAR_OPEN }}
    </button>
  </div>
</template>
