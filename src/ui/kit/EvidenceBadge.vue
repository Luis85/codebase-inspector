<script setup lang="ts">
// Part 6 Y32 (C13, R8), Part 7 Z26: who reported the evidence, how fresh it is and whether its
// source match is verified, as one line of text, never a coloured dot alone. An imported
// report's match is always unverified (Y27); a collected run's is verified (Z25).
import { computed } from 'vue';
import { EVIDENCE_BADGE } from '../inspector-copy';

const props = withDefaults(defineProps<{
  version: string; state: 'imported' | 'collected' | 'stale'; origin?: 'imported' | 'collected'; untested?: boolean;
}>(), { origin: 'imported', untested: false });
const text = computed(() => EVIDENCE_BADGE(props.version, props.state, props.origin, props.untested));
</script>

<template>
  <span
    class="ci-evidence-badge"
    :class="`ci-evidence-badge--${state}`"
  >{{ text }}</span>
</template>
