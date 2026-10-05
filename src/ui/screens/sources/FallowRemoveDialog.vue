<script setup lang="ts">
// Polish F5: the Remove confirmation, moved verbatim out of SourcesScreen.vue.
import { FALLOW_REMOVE, FALLOW_REMOVE_CANCEL, FALLOW_REMOVE_TEXT, FALLOW_REMOVE_TITLE } from '../../inspector-copy';
import CiDialog from '../../kit/Dialog.vue';

const emit = defineEmits<{ close: []; confirm: [] }>();
</script>

<template>
  <CiDialog
    :label="FALLOW_REMOVE_TITLE"
    @close="emit('close')"
  >
    <div class="ci-fallow-remove">
      <h3>{{ FALLOW_REMOVE_TITLE }}</h3>
      <p>{{ FALLOW_REMOVE_TEXT }}</p>
      <div class="ci-fallow-remove__actions">
        <button
          type="button"
          class="ci-fallow-remove__cancel"
          @click="emit('close')"
        >
          {{ FALLOW_REMOVE_CANCEL }}
        </button>
        <button
          type="button"
          class="mod-warning ci-fallow-remove__confirm"
          @click="emit('confirm')"
        >
          {{ FALLOW_REMOVE }}
        </button>
      </div>
    </div>
  </CiDialog>
</template>
