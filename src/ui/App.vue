<!--
  Welcome-state shell only (task 3). Task 9 builds the real C01 shell with the file
  list, camera controls, inspector, etc. This component owns exactly two things:
  - the always-present welcome copy (COPY-01/COPY-02), because task 3 never has a
    profile or a snapshot to show anything else;
  - an empty host element the minimal renderer mounts its canvas into, exposed to
    CityView so host orchestration (measuring width, constructing/disposing the
    renderer) stays out of this component entirely.
  `rendererAvailable` is owned by CityView (via provide/inject) so re-renders driven by
  a ResizeObserver never require remounting this component.
-->
<script setup lang="ts">
import { inject, ref } from 'vue';
import type { Ref } from 'vue';

const rendererAvailable = inject<Ref<boolean>>('rendererAvailable', ref(true));
const rendererHost = ref<HTMLElement | null>(null);
defineExpose({ rendererHost });

// Task 8: CityView provides this so "Select a codebase" runs the SAME startScan()
// method the scan-codebase command does -- there is no second, independent trigger for
// the consent chain. Defaults to a no-op so this component still renders standalone
// (e.g. under a future component test) without a CityView above it.
const onSelectCodebase = inject<() => void>('onSelectCodebase', () => {});

// Spec 5.2 microcopy, verbatim. COPY-20 ("Unused candidate") and the dropped S01
// "Analysis reports can be added later" string must never appear here.
const COPY_01 = 'Understand your codebase. Start with its structure.';
const COPY_02 = 'Select a codebase';
const COPY_14 = 'The 3D view is unavailable. File inspection still works.';
</script>

<template>
  <div class="ci-welcome">
    <div
      ref="rendererHost"
      class="ci-welcome__viewport-host"
      aria-hidden="true"
    />
    <p
      v-if="!rendererAvailable"
      class="ci-welcome__notice"
    >
      {{ COPY_14 }}
    </p>
    <h2 class="ci-welcome__title">
      {{ COPY_01 }}
    </h2>
    <button
      type="button"
      class="ci-welcome__action"
      @click="onSelectCodebase"
    >
      {{ COPY_02 }}
    </button>
  </div>
</template>
