<script setup lang="ts">
import {
  DIALOG_CLOSE, PRIORITY_CAVEAT, PRIORITY_DIALOG_TITLE, PRIORITY_FORMULA, PRIORITY_TERMS, PRIORITY_UNKNOWN_RULE,
} from '../../inspector-copy';
import CiDialog from '../../kit/Dialog.vue';

const emit = defineEmits<{ close: [] }>();
</script>

<template>
  <CiDialog
    :label="PRIORITY_DIALOG_TITLE"
    @close="emit('close')"
  >
    <div class="ci-formula">
      <h3 class="ci-formula__title">
        {{ PRIORITY_DIALOG_TITLE }}
      </h3>
      <p><code class="ci-formula__code">{{ PRIORITY_FORMULA }}</code></p>
      <dl class="ci-facts">
        <template
          v-for="t in PRIORITY_TERMS"
          :key="t.term"
        >
          <dt><code>{{ t.term }}</code></dt>
          <dd>{{ t.meaning }}</dd>
        </template>
      </dl>
      <p>{{ PRIORITY_CAVEAT }}</p>
      <p>{{ PRIORITY_UNKNOWN_RULE }}</p>
      <div class="ci-formula__actions">
        <button
          type="button"
          class="mod-cta"
          @click="emit('close')"
        >
          {{ DIALOG_CLOSE }}
        </button>
      </div>
    </div>
  </CiDialog>
</template>
