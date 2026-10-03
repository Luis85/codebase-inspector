<!--
  WP-04 IN15/IN16: generated factual statements (never a score) and the per-category
  suggested checks that seed a new note's checklist at creation.
-->
<script setup lang="ts">
import { INVESTIGATE_CHECKLIST_HINT, INVESTIGATE_CHECKLIST_TITLE, INVESTIGATE_UNCERTAINTY_TITLE } from '../../audit-copy/investigation';
import Panel from '../../kit/Panel.vue';

defineProps<{ uncertainties: readonly string[]; checklist: readonly string[] }>();
</script>

<template>
  <Panel :title="INVESTIGATE_UNCERTAINTY_TITLE">
    <ul class="ci-uncertainty-panel__list">
      <li
        v-for="(u, i) in uncertainties"
        :key="i"
      >
        {{ u }}
      </li>
    </ul>
  </Panel>
  <Panel
    :title="INVESTIGATE_CHECKLIST_TITLE"
    :subtitle="INVESTIGATE_CHECKLIST_HINT"
  >
    <ul class="ci-uncertainty-panel__checklist">
      <li
        v-for="(c, i) in checklist"
        :key="i"
      >
        {{ c }}
      </li>
    </ul>
  </Panel>
</template>
