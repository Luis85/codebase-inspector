<!--
  C16 — the transient/overlaid half of "every view-level state has a surface"
  (acceptance criterion 2): everything that sits ON TOP of already-visible content
  (scanning progress, cancellation, a failed refresh, partial-read evidence, an
  unreachable root, renderer unavailability, context loss). The full-pane states
  (nothing else on screen yet) belong to EmptyState.vue — see view-surface.ts's
  `isEmptyStateSurface` for the exact split. `role="status"` (polite): a blocking
  failure gets AnnouncementRegion.vue's `role="alert"` instead, never this element.
-->
<script setup lang="ts">
import { computed } from 'vue';
import { isEmptyStateSurface, surfaceCopy } from '../view-surface';
import type { ViewSurfaceState } from '../view-surface';

const props = defineProps<{ state: ViewSurfaceState }>();
const copy = computed(() => (isEmptyStateSurface(props.state) ? null : surfaceCopy(props.state)));
</script>

<template>
  <p
    v-if="copy"
    class="ci-status-banner"
    role="status"
  >
    {{ copy }}
  </p>
</template>
