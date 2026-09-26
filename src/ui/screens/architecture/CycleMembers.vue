<script setup lang="ts">
// WP-03 N7/N21: a cycle's members as text — for a re-export cycle (no hop order) or a
// cycle with a member outside the snapshot, which is marked. Shared by the Cycles tab and
// the Selected cycle panel. Report values are text only.
import type { CycleView } from '../../read-models/relations';
import { RELATION_MEMBER_UNMATCHED } from '../../inspector-copy';

defineProps<{ cycle: CycleView }>();
</script>

<template>
  <ul class="ci-cycle-list__members">
    <li
      v-for="m in cycle.members"
      :key="m.path"
      class="ci-cycle-list__member"
    >
      <code>{{ m.path }}</code><span
        v-if="m.id === null"
        class="ci-cycle-list__unmatched"
      > ({{ RELATION_MEMBER_UNMATCHED }})</span>
    </li>
  </ul>
</template>
