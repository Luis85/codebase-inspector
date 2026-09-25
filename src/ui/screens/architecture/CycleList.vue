<script setup lang="ts">
// WP-03 N21: one row per reported import cycle, then per re-export cycle (the relation
// model's order), each with its kind, member count and path text (N20). A re-export cycle
// has no hop order, so its members are listed as text; so are the members of a cycle with
// one outside the snapshot, each marked (N7). Review finding (N15) needs the finding's
// fingerprint; Show in city (N30) needs every member in the snapshot and selects the
// finding's anchor (`CycleView.anchorId`, N10). None of these buttons can become blocked
// while focused, so none needs E40.
import type { EntityId } from '../../../domain/entity-id';
import type { CycleView } from '../../read-models/relations';
import {
  ARCH_NODE_FILES, CYCLE_KIND_LABEL, CYCLE_REVIEW, CYCLE_SHOW_IN_CITY, CYCLE_SHOW_IN_CITY_LABEL, CYCLES_NONE,
  FALLOW_NOT_ANALYSED, FINDING_REVIEW_LABEL, INVESTIGATE_ACTION,
} from '../../inspector-copy';
import CycleMembers from './CycleMembers.vue';

defineProps<{ cycles: readonly CycleView[]; notAnalysed: boolean; selectedId: string | null }>();
const emit = defineEmits<{
  select: [id: string]; review: [fingerprint: string]; investigate: [fingerprint: string]; 'show-in-city': [id: string, anchorId: EntityId];
}>();

function review(cycle: CycleView): void {
  if (cycle.fingerprint !== null) emit('review', cycle.fingerprint);
}
/** WP-04 IN5/IP34: same `fingerprint !== null` guard as Review — a cycle whose anchor
 *  path is not in this snapshot has nothing to open on Investigate either. */
function investigate(cycle: CycleView): void {
  if (cycle.fingerprint !== null) emit('investigate', cycle.fingerprint);
}
function showInCity(cycle: CycleView): void {
  if (cycle.anchorId !== null) emit('show-in-city', cycle.findingId, cycle.anchorId);
}
</script>

<template>
  <p
    v-if="notAnalysed"
    class="ci-note"
  >
    {{ FALLOW_NOT_ANALYSED }}
  </p>
  <p
    v-else-if="cycles.length === 0"
    class="ci-note"
  >
    {{ CYCLES_NONE }}
  </p>
  <ul
    v-else
    class="ci-cycle-list"
  >
    <li
      v-for="(c, i) in cycles"
      :key="`${i}:${c.findingId}`"
      class="ci-cycle-list__row"
      :class="{ 'ci-cycle-list__row--selected': c.findingId === selectedId }"
    >
      <button
        type="button"
        class="ci-cycle-list__select"
        :aria-pressed="c.findingId === selectedId"
        @click="emit('select', c.findingId)"
      >
        <span class="ci-cycle-list__kind">{{ CYCLE_KIND_LABEL[c.kind] }}</span>
        <span class="ci-cycle-list__count">{{ ARCH_NODE_FILES(c.members.length) }}</span>
        <code
          v-if="c.pathText !== ''"
          class="ci-cycle-list__path"
        >{{ c.pathText }}</code>
      </button>
      <CycleMembers
        v-if="c.pathText === '' || !c.matched"
        :cycle="c"
      />
      <div class="ci-cycle-list__actions">
        <button
          v-if="c.fingerprint !== null"
          type="button"
          class="ci-cycle-list__review"
          :aria-label="FINDING_REVIEW_LABEL(c.findingId)"
          @click="review(c)"
        >
          {{ CYCLE_REVIEW }}
        </button>
        <button
          v-if="c.fingerprint !== null"
          type="button"
          class="ci-cycle-list__investigate"
          @click="investigate(c)"
        >
          {{ INVESTIGATE_ACTION }}
        </button>
        <button
          v-if="c.anchorId !== null"
          type="button"
          class="ci-cycle-list__city"
          :aria-label="CYCLE_SHOW_IN_CITY_LABEL(c.findingId)"
          @click="showInCity(c)"
        >
          {{ CYCLE_SHOW_IN_CITY }}
        </button>
      </div>
    </li>
  </ul>
</template>
