<script setup lang="ts">
import { HOTSPOT_THRESHOLD } from '../../read-models/overview';
import { useCityStore } from '../../stores/city-store';
import {
  SETTINGS_ACCESS, SETTINGS_ACCESS_TEXT, SETTINGS_ACCESS_VALUE, SETTINGS_PRIORITY_HELP, SETTINGS_SCOPE, SETTINGS_SCOPE_TEXT,
  SETTINGS_SCOPE_VIEW, SETTINGS_THRESHOLD, SETTINGS_THRESHOLD_TEXT,
} from '../../inspector-copy';

const emit = defineEmits<{ priority: [] }>();
const store = useCityStore();
</script>

<template>
  <div class="ci-setting-row">
    <div>
      <h3>{{ SETTINGS_THRESHOLD }}</h3>
      <p class="ci-note">
        {{ SETTINGS_THRESHOLD_TEXT(HOTSPOT_THRESHOLD) }}
      </p>
    </div>
    <button
      type="button"
      class="ci-settings__priority"
      @click="emit('priority')"
    >
      {{ SETTINGS_PRIORITY_HELP }}
    </button>
  </div>
  <div class="ci-setting-row">
    <div>
      <h3>{{ SETTINGS_ACCESS }}</h3>
      <p class="ci-note">
        {{ SETTINGS_ACCESS_TEXT }}
      </p>
    </div>
    <span class="ci-chip ci-chip--success">{{ SETTINGS_ACCESS_VALUE }}</span>
  </div>
  <div class="ci-setting-row">
    <div>
      <h3>{{ SETTINGS_SCOPE }}</h3>
      <p class="ci-note">
        {{ SETTINGS_SCOPE_TEXT }}
      </p>
    </div>
    <button
      type="button"
      class="ci-settings__scope"
      @click="store.navigate('sources')"
    >
      {{ SETTINGS_SCOPE_VIEW }}
    </button>
  </div>
</template>
