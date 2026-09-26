<!--
  C17 — the full-pane half of "every view-level state has a surface" (acceptance
  criterion 2): the states where there is nothing else on screen yet (no source
  selected, an invalid directory, read access not yet approved, an empty included
  scope). Everything else is StatusBanner.vue's — see view-surface.ts's
  `isEmptyStateSurface` for the exact split. Purely presentational: it never starts,
  refreshes or authorises a scan itself.
-->
<script setup lang="ts">
import { computed } from 'vue';
import { isEmptyStateSurface, surfaceCopy } from '../view-surface';
import type { ViewSurfaceState } from '../view-surface';

const props = defineProps<{ state: ViewSurfaceState }>();
const copy = computed(() => (isEmptyStateSurface(props.state) ? surfaceCopy(props.state) : null));
</script>

<template>
  <div
    v-if="copy"
    class="ci-empty-state"
  >
    <p class="ci-empty-state__copy">
      {{ copy }}
    </p>
  </div>
</template>
