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
import { countDirectoryDistricts } from '../../domain/layout/districts';
import {
  COPY_CITY_HEADER_TITLE, COPY_CITY_HEADER_BADGE, COPY_CITY_HEADER_EYEBROW, formatCityHeaderSubtitle,
} from '../copy';

const store = useCityStore();

// Both counts read from the SAME LayoutResult the renderer itself consumes
// (task-7-brief.md: "derive both counts from store.layout... the footer states the
// same numbers, and two counts kept in separate places are two counts that can
// disagree"). `lots` are one per FILE (never a directory or the repository root).
//
// Task 7 fix round 2: the "directory districts" count itself moved to
// `countDirectoryDistricts` (src/domain/layout/districts.ts) -- which districts are
// directory districts is a fact about the LAYOUT, not about how this subtitle words
// it, and the footer (task 8) must state the same number without re-deriving the
// off-by-one fix independently. See that function's own comment for why the raw
// `districts.length` over-counts by one (the repository root's own district).
const subtitle = computed(() => {
  const layout = store.layout;
  if (!layout) return '';
  return formatCityHeaderSubtitle(layout.lots.length, countDirectoryDistricts(layout.districts));
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
