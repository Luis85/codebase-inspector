<script setup lang="ts">
import { computed } from 'vue';
import {
  REVIEW_RECORDS_SKIPPED, REVIEW_STORE_READ_FAILED, REVIEW_STORE_UNSUPPORTED_NOTE,
  SETTINGS_CLEAR, SETTINGS_CLEAR_HINT, SETTINGS_CLEAR_OPEN, SETTINGS_CLEAR_TEXT, SETTINGS_EXPORT, SETTINGS_NETWORK,
  SETTINGS_NETWORK_TEXT, SETTINGS_NETWORK_VALUE, SETTINGS_STORAGE, SETTINGS_STORAGE_TEXT,
} from '../../inspector-copy';
import { useCityStore } from '../../stores/city-store';
import { useReviewStore } from '../../stores/review-store';
import { useUniqueId } from '../../unique-id';
import type { ImportCandidate } from './import-candidate';
import ImportRow from './ImportRow.vue';

const emit = defineEmits<{ clear: []; export: []; parsed: [candidate: ImportCandidate] }>();
const city = useCityStore();
const review = useReviewStore();
const clearHintId = useUniqueId('ci-settings-clear-hint');
/** Part 6 Y7/R3: one line about the bound codebase's saved review state, shown only while
 *  it could not be read, is read-only, or has records that could not be read. */
const storageNote = computed((): string => {
  const { skipped, unsupported } = review.storageDiagnostics;
  if (review.loadFailed) return REVIEW_STORE_READ_FAILED;
  if (unsupported) return REVIEW_STORE_UNSUPPORTED_NOTE;
  return skipped > 0 ? REVIEW_RECORDS_SKIPPED(skipped) : '';
});
/** Part 6 R3: blocked (aria-disabled plus this guard, E40) while no codebase is on screen —
 *  the saved review state belongs to one codebase. Announces nothing (E17). */
function requestClear(): void {
  if (!city.snapshot) return;
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
  <ImportRow @parsed="emit('parsed', $event)" />
  <div class="ci-setting-row">
    <div>
      <h3>{{ SETTINGS_CLEAR }}</h3>
      <p class="ci-note">
        {{ SETTINGS_CLEAR_TEXT }}
      </p>
      <p
        v-if="!city.snapshot"
        :id="clearHintId"
        class="ci-note ci-settings__clear-hint"
      >
        {{ SETTINGS_CLEAR_HINT }}
      </p>
    </div>
    <button
      type="button"
      class="mod-warning ci-settings__clear"
      :aria-disabled="city.snapshot ? undefined : 'true'"
      :aria-describedby="city.snapshot ? undefined : clearHintId"
      @click="requestClear"
    >
      {{ SETTINGS_CLEAR_OPEN }}
    </button>
  </div>
</template>
