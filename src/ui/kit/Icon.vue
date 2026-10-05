<script setup lang="ts">
import { onMounted, ref, watch } from 'vue';
import { setIcon } from 'obsidian';

const props = defineProps<{ name: string }>();
const el = ref<HTMLElement | null>(null);

function paint(): void {
  if (el.value) setIcon(el.value, props.name);
}
onMounted(paint);
watch(() => props.name, paint);
</script>

<template>
  <span
    ref="el"
    class="ci-icon"
    aria-hidden="true"
  />
</template>
