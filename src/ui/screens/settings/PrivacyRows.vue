<script setup lang="ts">
import {
  SETTINGS_CLEAR, SETTINGS_CLEAR_OPEN, SETTINGS_CLEAR_TEXT, SETTINGS_EXPORT, SETTINGS_NETWORK, SETTINGS_NETWORK_TEXT,
  SETTINGS_NETWORK_VALUE, SETTINGS_STORAGE, SETTINGS_STORAGE_TEXT,
} from '../../inspector-copy';
import type { ImportCandidate } from './import-candidate';
import ImportRow from './ImportRow.vue';

const emit = defineEmits<{ clear: []; export: []; parsed: [candidate: ImportCandidate] }>();
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
    </div>
    <button
      type="button"
      class="mod-warning ci-settings__clear"
      @click="emit('clear')"
    >
      {{ SETTINGS_CLEAR_OPEN }}
    </button>
  </div>
</template>
