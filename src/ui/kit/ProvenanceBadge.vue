<script setup lang="ts">
import { computed } from 'vue';
import { EVIDENCE_LABELS, type EvidenceState } from '../evidence';

const props = defineProps<{ state: EvidenceState; detail?: string }>();
const label = computed(() => EVIDENCE_LABELS[props.state]);
</script>

<template>
  <span
    class="ci-provenance"
    :class="`ci-provenance--${state}`"
    :title="detail"
  >{{ label }}</span>
</template>
