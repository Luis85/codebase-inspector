<!--
  Task 10 (F5) — extracted out of App.vue, which the brief's own measurement found
  at its 400/400 line cap with no headroom left for this task's own markup
  regardless of which file it went in (CityViewport.vue was at 397/400, forcing an
  extraction either way). Owns exactly what App.vue's `.ci-app__stage-column` owned
  before this task -- CityHeader above the stage, the stage itself, and MetricLegend
  below it -- moved wholesale, not rewritten; see App.vue's own git history for the
  comments this replaced.

  CameraControls is composed INSIDE CityViewport's own default slot here, not as a
  sibling the way it used to sit beside CityViewport in App.vue. That is required by
  a ruling that supersedes the brief's own instruction to anchor the overlay against
  `.ci-app__stage-column`: once Task 7 added CityHeader to that column and Task 8's
  MetricLegend sits below the viewport inside it, the COLUMN's own bottom-right
  corner is over the legend, not the canvas. `position: absolute` only ever
  positions against an ANCESTOR, never a sibling, so the overlay (`--overlay`,
  styles.css) needs CameraControls to be a DOM descendant of `.ci-viewport` (the
  stage box the canvas actually fills, already `position: relative`) -- which
  CityViewport's own template now makes possible via a plain `<slot />`.

  The alternative the brief itself allowed -- rendering CameraControls directly
  inside CityViewport.vue and extracting something else from that file instead --
  was also considered and rejected: CityViewport.vue is already the single owner of
  renderer construction, teardown and sizing (ruling M68), and adding an unrelated
  UI-composition concern to it would have mixed two things this codebase has kept
  deliberately separate everywhere else. Composing CityHeader, CityViewport (with
  CameraControls slotted in) and MetricLegend together in ONE file, here, is the
  natural place to read "what this column contains" in one pass -- which is what
  made this file worth extracting on its own, not only App.vue's own line budget.
-->
<script setup lang="ts">
import { computed, ref } from 'vue';
import { useCityStore } from '../stores/city-store';
import CityHeader from './CityHeader.vue';
import CityViewport from './CityViewport.vue';
import CameraControls from './CameraControls.vue';
import MetricLegend from './MetricLegend.vue';
import LensHeading from '../screens/city/LensHeading.vue';
import { useLensRenderer } from '../screens/city/use-lens-renderer';
import { useRelationRenderer } from '../screens/city/use-relation-renderer';

const store = useCityStore();
// Part 6 Y40: the findings lens reaches the renderer from here. CityViewport.vue is at
// 400/400 and is not edited — see use-lens-renderer.ts. WP-03 N31: so do the relation arcs.
useLensRenderer();
useRelationRenderer();

interface CityViewportExposed { stageEl: HTMLElement | null }
const cityViewportRef = ref<CityViewportExposed | null>(null);

// App.vue's own `rendererHost` contract (ruling M68), relayed one level down: this
// file is now the thing that holds the ref to CityViewport, so App.vue reads its
// stage element through THIS component's own exposed surface instead of reaching
// past it.
const stageEl = computed(() => cityViewportRef.value?.stageEl ?? null);
defineExpose({ stageEl });
</script>

<template>
  <!-- Class name kept from App.vue's own `.ci-app__stage-column` -- the CSS chain
       tests/component/stage-height.test.ts pins (`.ci-app` -> `.ci-app__body` ->
       this column, `flex: 1 1 auto; min-height: 0`) reads it by that selector, and
       styles.css is unchanged by this extraction: only which .vue file renders the
       div with this class moved. -->
  <div class="ci-app__stage-column">
    <CityHeader />
    <LensHeading />
    <!-- Task 10 fix round 1 (ruling M75, carried unchanged from App.vue): NOT
         mounted in list mode. Spec 5.2 says the list-first fallback "creates no
         WebGL context at all", spec 4.2 says "in 'list' mode no renderer exists",
         and browsers cap live contexts at roughly 8-16 -- see App.vue's own former
         copy of this comment for the full account. CameraControls being slotted
         INSIDE this `v-if` means it is gated by the exact same condition it always
         was, with no separate `v-if` of its own needed any more. -->
    <CityViewport
      v-if="store.viewMode !== 'list'"
      ref="cityViewportRef"
    >
      <CameraControls />
    </CityViewport>
    <MetricLegend />
  </div>
</template>
