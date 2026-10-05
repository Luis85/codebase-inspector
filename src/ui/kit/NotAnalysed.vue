<script setup lang="ts">
// Part 6 Y35/Y36: no report is attached, so findings are unknown, not zero. One action: the
// host screen decides what Import does (Y39: go to Data & scans and ask for the S14 dialog).
import { FALLOW_IMPORT_ACTION, FALLOW_NOT_ANALYSED_BODY, FALLOW_NOT_ANALYSED_TITLE } from '../inspector-copy';

const emit = defineEmits<{ import: [] }>();
</script>

<template>
  <div class="ci-empty ci-not-analysed">
    <p class="ci-empty__title ci-not-analysed__title">
      {{ FALLOW_NOT_ANALYSED_TITLE }}
    </p>
    <p class="ci-note ci-not-analysed__body">
      {{ FALLOW_NOT_ANALYSED_BODY }}
    </p>
    <button
      type="button"
      class="mod-cta ci-not-analysed__import"
      @click="emit('import')"
    >
      {{ FALLOW_IMPORT_ACTION }}
    </button>
  </div>
</template>
