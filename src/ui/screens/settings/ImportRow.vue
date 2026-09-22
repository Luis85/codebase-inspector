<script setup lang="ts">
// Part 5 V13/V15: the Import row. The file input lives in this template and is never
// created with createElement. The button opens it, and the picked file is the only thing
// read. A refusal is one inline alert; a valid file goes up to the confirmation dialog.
import { ref } from 'vue';
import { readReviewStateFile, type ImportedReviewState } from '../../read-models/review-state-import';
import { useCityStore } from '../../stores/city-store';
import { reannounce } from '../../kit/reannounce';
import { useUniqueId } from '../../unique-id';
import {
  IMPORT_ERROR, SETTINGS_IMPORT, SETTINGS_IMPORT_HINT, SETTINGS_IMPORT_OPEN, SETTINGS_IMPORT_TEXT,
} from '../../inspector-copy';

const emit = defineEmits<{ parsed: [state: ImportedReviewState] }>();
const city = useCityStore();
const fileInput = ref<HTMLInputElement | null>(null);
const error = ref('');
const hintId = useUniqueId('ci-settings-import-hint');

/** Blocked (aria-disabled plus this guard, E40) while no codebase is on screen: imported
 *  paths need its repository id to become entity ids. */
function open(): void {
  if (!city.snapshot) return;
  fileInput.value?.click();
}

/** One outcome per pick. The input is emptied first, so picking the same file again still
 *  fires `change`. A refusal is re-announced (V15: a new pick clears the previous error
 *  first). */
async function picked(): Promise<void> {
  const input = fileInput.value;
  const file = input?.files?.[0];
  const repositoryId = city.snapshot?.repositoryId;
  if (input) input.value = '';
  if (!file || repositoryId === undefined) return;
  const result = await readReviewStateFile(file, { repositoryId });
  if (result.ok) {
    error.value = '';
    emit('parsed', result.state);
    return;
  }
  await reannounce(error, IMPORT_ERROR[result.code](result.detail));
}
</script>

<template>
  <div class="ci-setting-row">
    <div>
      <h3>{{ SETTINGS_IMPORT }}</h3>
      <p class="ci-note">
        {{ SETTINGS_IMPORT_TEXT }}
      </p>
      <p
        v-if="!city.snapshot"
        :id="hintId"
        class="ci-note ci-settings__import-hint"
      >
        {{ SETTINGS_IMPORT_HINT }}
      </p>
      <p
        v-if="error"
        class="ci-settings__import-error"
        role="alert"
      >
        {{ error }}
      </p>
    </div>
    <button
      type="button"
      class="ci-settings__import"
      :aria-disabled="city.snapshot ? undefined : 'true'"
      :aria-describedby="city.snapshot ? undefined : hintId"
      @click="open"
    >
      {{ SETTINGS_IMPORT_OPEN }}
    </button>
    <input
      ref="fileInput"
      type="file"
      accept=".json,application/json"
      class="visually-hidden ci-settings__import-file"
      tabindex="-1"
      aria-hidden="true"
      @change="picked"
    >
  </div>
</template>
