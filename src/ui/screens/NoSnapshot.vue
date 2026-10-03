<script setup lang="ts">
import { inject } from 'vue';
import { COPY_02 } from '../copy';
import { SCREEN_NO_SNAPSHOT } from '../inspector-copy';
import { useCityStore } from '../stores/city-store';

const store = useCityStore();
const onSelectCodebase = inject<() => void>('onSelectCodebase', () => {});
// The WP-01 scan states live only on the city route, so show it before the scan starts.
function selectCodebase(): void {
  store.navigate('city');
  onSelectCodebase();
}
</script>

<template>
  <div class="ci-empty ci-no-snapshot">
    <p>{{ SCREEN_NO_SNAPSHOT }}</p>
    <button
      type="button"
      class="mod-cta"
      @click="selectCodebase"
    >
      {{ COPY_02 }}
    </button>
  </div>
</template>
