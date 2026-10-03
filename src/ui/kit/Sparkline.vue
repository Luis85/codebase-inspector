<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{ values: readonly number[]; label: string }>();
const W = 80;
const H = 28;

const points = computed(() => {
  const vs = props.values;
  if (vs.length === 0) return '';
  const min = Math.min(...vs);
  const span = Math.max(1, Math.max(...vs) - min);
  const step = vs.length > 1 ? W / (vs.length - 1) : 0;
  return vs.map((v, i) => `${(i * step).toFixed(1)},${(H - 2 - ((v - min) / span) * (H - 4)).toFixed(1)}`).join(' ');
});
</script>

<template>
  <svg
    class="ci-sparkline"
    :viewBox="`0 0 ${W} ${H}`"
    role="img"
    :aria-label="label"
    preserveAspectRatio="none"
  >
    <polyline
      :points="points"
      fill="none"
    />
  </svg>
</template>
