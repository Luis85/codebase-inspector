<!--
  Task 7 (F8, ruling P3): S05 composes the canvas with a header above it -- an
  eyebrow, a title, a subtitle naming the counts, and a "Read-only snapshot" badge.
  Mounted at the top of `.ci-app__stage-column` (App.vue), above CityViewport.

  Heading level: <h2>. The only other headings in this tree today are <h3>
  (CodebaseFileList's own panel title, FileInspector's own panel title) and <h4>
  (CodebaseFileListGroup's per-district heading, nested inside the h3 file-list
  panel) -- neither of those is a page-level title, both are one panel's own label
  among several panels the view shows side by side. This header names the CITY
  ITSELF, which those panels sit alongside rather than beneath, so it takes the
  level one step above them, keeping a single coherent outline (h2 > h3 > h4)
  instead of implying the canvas is subordinate to the file list or the inspector.
  Not <h1>: this view mounts inside an Obsidian leaf whose own tab chrome is not
  this component's to claim a heading level against, and nothing here establishes
  that no ancestor in the host page already owns h1.

  foundations/04 requires equivalent non-3D access; the city's own name is the
  landmark a screen-reader user navigates to, so this must be a real heading
  element, not a styled div (tests/component/city-header.test.ts pins the tag).

  v-if, not `hidden`/`v-show`: the cascade-trap this stylesheet is exposed to
  (an author `display` declaration beats the UA `[hidden]` rule by cascade ORIGIN,
  not specificity -- see the .ci-city-labels__label comment in styles.css) only
  bites elements toggled by the `hidden` attribute or `v-show`. This component is
  entirely absent from the DOM before a snapshot exists, so that hazard does not
  apply here.
-->
<script setup lang="ts">
import { computed } from 'vue';
import { useCityStore } from '../stores/city-store';
import {
  COPY_CITY_HEADER_TITLE, COPY_CITY_HEADER_BADGE, COPY_CITY_HEADER_EYEBROW, formatCityHeaderSubtitle,
} from '../copy';

const store = useCityStore();

// Both counts read from the SAME LayoutResult the renderer itself consumes
// (task-7-brief.md: "derive both counts from store.layout... the footer states the
// same numbers, and two counts kept in separate places are two counts that can
// disagree"). `lots` are one per FILE (never a directory or the repository root).
//
// `districts`, unfiltered, is NOT "directory districts": buildDistrictLayout
// (src/domain/layout/districts.ts, collectResults) always pushes ONE district for
// the repository root itself first (depth 0, `entity.kind === 'repository'`),
// before the real subdirectories (depth >= 1). Verified directly: a 6-directory
// fixture produces `layout.districts.length === 7`, districts[0] named after the
// repository. The brief's own worked example ("144 files grouped into 6 directory
// districts") only holds once that synthetic root entry is excluded -- a repo root
// is not itself a directory a user asked to see districted. `depth > 0` is exact
// and needs no entity-kind lookup: buildNode assigns depth 0 to the single root
// call and increments for every real child, so there is never a second depth-0
// entry to accidentally keep or a real district to accidentally drop.
const subtitle = computed(() => {
  const layout = store.layout;
  if (!layout) return '';
  const directoryDistrictCount = layout.districts.filter((d) => d.depth > 0).length;
  return formatCityHeaderSubtitle(layout.lots.length, directoryDistrictCount);
});
</script>

<template>
  <div
    v-if="store.layout"
    class="ci-city-header"
  >
    <div class="ci-city-header__text">
      <p class="ci-city-header__eyebrow">
        {{ COPY_CITY_HEADER_EYEBROW }}
      </p>
      <h2 class="ci-city-header__title">
        {{ COPY_CITY_HEADER_TITLE }}
      </h2>
      <p class="ci-city-header__subtitle">
        {{ subtitle }}
      </p>
    </div>
    <!-- Not a button: it asserts a fact about the snapshot, triggers nothing, and
         has no interactive state -- so the M113 skinned-button recipe (type
         selector + :hover rule) does not apply here, and PLUGIN_SKINNED_BUTTONS in
         tests/unit/host-cascade.test.ts is deliberately NOT extended for it. -->
    <span class="ci-city-header__badge">
      {{ COPY_CITY_HEADER_BADGE }}
    </span>
  </div>
</template>
