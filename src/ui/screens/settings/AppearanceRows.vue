<script setup lang="ts">
import { computed } from 'vue';
import { DENSITIES, usePreferencesStore, type Density } from '../../stores/preferences-store';
import { useUniqueId } from '../../unique-id';
import {
  SETTINGS_DENSITY, SETTINGS_DENSITY_LABEL, SETTINGS_DENSITY_TEXT, SETTINGS_THEME, SETTINGS_THEME_TEXT, SETTINGS_THEME_VALUE,
} from '../../inspector-copy';

const preferences = usePreferencesStore();
const densityId = useUniqueId('ci-settings-density');

/** A `v-model` computed avoids an `$event.target as HTMLSelectElement` cast on a native
 *  change handler (controller ruling for Task 13). */
const density = computed<Density>({
  get: () => preferences.density,
  set: (value) => { preferences.setDensity(value); },
});
</script>

<template>
  <div class="ci-setting-row">
    <div>
      <h3>{{ SETTINGS_THEME }}</h3>
      <p class="ci-note">
        {{ SETTINGS_THEME_TEXT }}
      </p>
    </div>
    <span class="ci-chip">{{ SETTINGS_THEME_VALUE }}</span>
  </div>
  <div class="ci-setting-row">
    <div>
      <h3><label :for="densityId">{{ SETTINGS_DENSITY }}</label></h3>
      <p class="ci-note">
        {{ SETTINGS_DENSITY_TEXT }}
      </p>
    </div>
    <select
      :id="densityId"
      v-model="density"
      class="dropdown ci-settings__density"
    >
      <option
        v-for="d in DENSITIES"
        :key="d"
        :value="d"
      >
        {{ SETTINGS_DENSITY_LABEL[d] }}
      </option>
    </select>
  </div>
</template>
