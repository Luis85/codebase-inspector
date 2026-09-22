<!--
  WP-02 Part 5 (V2): COPY-30, moved out of CityWorkspace.vue with no behaviour change.
  Phase 2c, I4: spec 5.2 says a filter-hidden selection is "EXPLAINED, never silently
  replaced". NOT routed through viewSurfaceState/StatusBanner (a single-winner chain; this
  must coexist with whatever else is showing) and not a second live region
  (AnnouncementRegion owns that). Task 9 (F13): the tail used to be unpressable prose; it
  is two real buttons. A3 fix (whole-branch review, I3): all three pieces —
  COPY_30_EXPLANATION and both button labels — derive from COPY_30 itself, never retyped.
-->
<script setup lang="ts">
import { useCityStore } from '../../stores/city-store';
import { useCityRendererHandle } from '../../renderer-handle';
import { COPY_30_CLEAR_LABEL, COPY_30_EXPLANATION, COPY_30_REVEAL_LABEL } from '../../copy';

const store = useCityStore();
// Task 9 (F13): the SAME shared handle CityViewport writes (CityWorkspace provides it).
const cityRenderer = useCityRendererHandle();

/** Task 9 (F13): "Reveal file" — re-selects (idempotent) and focuses through the renderer,
 *  like FileInspector.vue's own Focus button. Never touches `store.query`: revealing is
 *  not the same action as clearing the search that hid it. */
function revealSelection(): void {
  const id = store.selectedEntityId;
  if (!id) return;
  store.select(id);
  cityRenderer.value?.focus(id);
}
</script>

<template>
  <div
    v-if="store.banner"
    class="ci-app__selection-notice"
  >
    <p class="ci-app__selection-notice-text">
      {{ COPY_30_EXPLANATION }}
    </p>
    <div class="ci-selection-notice__actions">
      <button
        type="button"
        class="ci-selection-notice__reveal"
        @click="revealSelection"
      >
        {{ COPY_30_REVEAL_LABEL }}
      </button>
      <button
        type="button"
        class="ci-selection-notice__clear"
        @click="store.clearSelection()"
      >
        {{ COPY_30_CLEAR_LABEL }}
      </button>
    </div>
  </div>
</template>
