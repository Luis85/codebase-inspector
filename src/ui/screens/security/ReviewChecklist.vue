<script setup lang="ts">
import { ref } from 'vue';
import { useUniqueId } from '../../unique-id';
import { SECURITY_CHECKLIST, SECURITY_NO_CONCLUSION } from '../../inspector-copy';
import Callout from '../../kit/Callout.vue';

// Local and unsaved (Q7): no store, no persistence — a fresh mount always starts unchecked.
const checked = ref<boolean[]>(SECURITY_CHECKLIST.map(() => false));
const ids = SECURITY_CHECKLIST.map(() => useUniqueId('ci-checklist'));
</script>

<template>
  <ul class="ci-checklist">
    <li
      v-for="(item, i) in SECURITY_CHECKLIST"
      :key="item"
    >
      <input
        :id="ids[i]"
        v-model="checked[i]"
        type="checkbox"
      >
      <label :for="ids[i]">{{ item }}</label>
    </li>
  </ul>
  <Callout :title="SECURITY_NO_CONCLUSION" />
</template>
