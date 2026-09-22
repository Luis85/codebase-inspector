<script setup lang="ts">
import { WORK_CHECKLIST_TITLE, WORK_CHECK_LABELS } from '../../inspector-copy';

// X19: split out of WorkItemEditor.vue once it passed the 300-line threshold. Same
// parent-owned defineModel pattern as ReviewChecklist.vue (security/ReviewChecklist.vue).
const checks = defineModel<[boolean, boolean, boolean]>({ required: true });
</script>

<template>
  <fieldset class="ci-work-editor__checks">
    <legend>{{ WORK_CHECKLIST_TITLE }}</legend>
    <label
      v-for="(label, i) in WORK_CHECK_LABELS"
      :key="label"
      class="ci-work-editor__check"
    >
      <input
        v-model="checks[i]"
        type="checkbox"
      >
      {{ label }}
    </label>
  </fieldset>
</template>
