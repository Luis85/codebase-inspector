<script setup lang="ts">
import { inject } from 'vue';
import { COPY_02 } from '../copy';
import { SCREEN_NO_SNAPSHOT } from '../inspector-copy';

const onSelectCodebase = inject<() => void>('onSelectCodebase', () => {});
</script>

<template>
  <div class="ci-overview__empty ci-no-snapshot">
    <p>{{ SCREEN_NO_SNAPSHOT }}</p>
    <button
      type="button"
      class="mod-cta"
      @click="onSelectCodebase"
    >
      {{ COPY_02 }}
    </button>
  </div>
</template>
