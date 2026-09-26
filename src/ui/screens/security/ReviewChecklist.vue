<script setup lang="ts">
import { useUniqueId } from '../../unique-id';
import { SECURITY_CHECKLIST, SECURITY_NO_CONCLUSION } from '../../inspector-copy';
import Callout from '../../kit/Callout.vue';

// Fix round 1 (Important 1): state is owned by the parent screen, not this component —
// it sits behind a `v-if` tab in SecurityScreen.vue, so a component-local ref would be
// torn down and recreated (losing every check) on every tab switch. Still local to the
// screen and unsaved (Q7): no store, no persistence.
const checked = defineModel<boolean[]>({ required: true });
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
