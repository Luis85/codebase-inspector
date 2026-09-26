<script setup lang="ts">
import { useCityStore } from '../../stores/city-store';
import {
  SETTINGS_INVENTORY, SETTINGS_INVENTORY_OPEN, SETTINGS_INVENTORY_TEXT, SETTINGS_MOTION, SETTINGS_MOTION_TEXT,
  SETTINGS_SHORTCUT_LIST, SETTINGS_SHORTCUTS,
} from '../../inspector-copy';

const store = useCityStore();

function openInventory(): void {
  store.setViewMode('list');
  store.navigate('city');
}
</script>

<template>
  <div class="ci-setting-row">
    <div>
      <h3>{{ SETTINGS_MOTION }}</h3>
      <p class="ci-note">
        {{ SETTINGS_MOTION_TEXT }}
      </p>
    </div>
  </div>
  <div class="ci-setting-row">
    <div>
      <h3>{{ SETTINGS_INVENTORY }}</h3>
      <p class="ci-note">
        {{ SETTINGS_INVENTORY_TEXT }}
      </p>
    </div>
    <button
      type="button"
      class="ci-settings__inventory"
      @click="openInventory"
    >
      {{ SETTINGS_INVENTORY_OPEN }}
    </button>
  </div>
  <div class="ci-setting-row ci-setting-row--stacked">
    <h3>{{ SETTINGS_SHORTCUTS }}</h3>
    <dl class="ci-settings__shortcuts">
      <template
        v-for="s in SETTINGS_SHORTCUT_LIST"
        :key="s.keys"
      >
        <dt><kbd>{{ s.keys }}</kbd></dt>
        <dd>{{ s.action }}</dd>
      </template>
    </dl>
  </div>
</template>
