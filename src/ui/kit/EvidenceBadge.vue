<script setup lang="ts">
// Part 6 Y32 (C13, R8): who reported the evidence, how fresh it is and whether its source
// match is verified, as one line of text, never a coloured dot alone. A fallow report
// carries no root or revision, so the source match always reads "Unverified" (Y27).
import { computed } from 'vue';
import { EVIDENCE_BADGE } from '../inspector-copy';

const props = defineProps<{ version: string; state: 'imported' | 'stale' }>();
const text = computed(() => EVIDENCE_BADGE(props.version, props.state));
</script>

<template>
  <span
    class="ci-evidence-badge"
    :class="`ci-evidence-badge--${state}`"
  >{{ text }}</span>
</template>
