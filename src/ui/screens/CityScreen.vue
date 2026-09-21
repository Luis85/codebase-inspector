<script setup lang="ts">
import { computed, ref } from 'vue';
import CityWorkspace from './CityWorkspace.vue';

interface WorkspaceExposed { rendererHost: HTMLElement | null }
const workspace = ref<WorkspaceExposed | null>(null);
const rendererHost = computed(() => workspace.value?.rendererHost ?? null);
defineExpose({ rendererHost });
</script>

<template>
  <div class="ci-screen ci-screen--city">
    <CityWorkspace ref="workspace" />
  </div>
</template>
