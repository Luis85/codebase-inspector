<script setup lang="ts">
// WP-03 N14: FindingReviewDialog's "Also involves" row, split out to keep the dialog
// under its size cap. Every related path is listed as text (never v-html); an unmatched
// one (not one of this snapshot's own files) also reads RELATION_MEMBER_UNMATCHED. For an
// import cycle, `pathText` (cyclePathText(detail.hops), N20's format) is shown in a
// <code>; empty for a re-export cycle (no hop order) or a non-cycle finding.
import { FINDING_RELATED_LABEL, RELATION_MEMBER_UNMATCHED } from '../../inspector-copy';

defineProps<{ related: readonly string[]; unmatched: ReadonlySet<string>; pathText: string }>();
</script>

<template>
  <div
    v-if="related.length > 0"
    class="ci-finding-dialog__related"
  >
    <p class="ci-finding-dialog__related-label">
      {{ FINDING_RELATED_LABEL }}
    </p>
    <ul>
      <li
        v-for="path in related"
        :key="path"
      >
        {{ path }}
        <span
          v-if="unmatched.has(path)"
          class="ci-note"
        >{{ RELATION_MEMBER_UNMATCHED }}</span>
      </li>
    </ul>
    <code
      v-if="pathText"
      class="ci-finding-dialog__cycle-path"
    >{{ pathText }}</code>
  </div>
</template>
