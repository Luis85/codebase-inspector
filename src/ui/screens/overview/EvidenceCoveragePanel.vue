<script setup lang="ts">
import type { EvidenceCoverageRow } from '../../read-models/overview';
import ProvenanceBadge from '../../kit/ProvenanceBadge.vue';

defineProps<{ rows: readonly EvidenceCoverageRow[] }>();
</script>

<template>
  <dl class="ci-evidence-coverage">
    <template
      v-for="row in rows"
      :key="row.id"
    >
      <dt>{{ row.label }}</dt>
      <dd>
        <span
          class="ci-evidence-coverage__bar"
          :class="`ci-evidence-coverage__bar--${row.state}`"
        />
        <ProvenanceBadge
          :state="row.state"
          :detail="row.source"
        />
      </dd>
    </template>
  </dl>
</template>
