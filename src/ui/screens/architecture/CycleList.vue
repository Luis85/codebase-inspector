<script setup lang="ts">
// WP-03 N21: one row per reported import cycle, then per re-export cycle (the relation
// model's order), each with its kind, member count and path text (N20). A re-export cycle
// has no hop order, so its members are listed as text; so are the members of a cycle with
// one outside the snapshot, each marked (N7). Review finding (N15) needs the finding's
// fingerprint; Show in city (N30) needs every member in the snapshot and selects the
// anchor — the lexicographically first member (N10). None of these buttons can become
// blocked while focused, so none needs E40.
import type { EntityId } from '../../../domain/entity-id';
import type { CycleView } from '../../read-models/relations';
import {
  ARCH_NODE_FILES, CYCLE_KIND_IMPORT, CYCLE_KIND_RE_EXPORT, CYCLE_REVIEW, CYCLE_REVIEW_LABEL, CYCLE_SHOW_IN_CITY,
  CYCLE_SHOW_IN_CITY_LABEL, CYCLES_NONE, FALLOW_NOT_ANALYSED, RELATION_MEMBER_UNMATCHED,
} from '../../inspector-copy';

defineProps<{ cycles: readonly CycleView[]; notAnalysed: boolean; selectedId: string | null }>();
const emit = defineEmits<{ select: [id: string]; review: [fingerprint: string]; 'show-in-city': [id: string, anchorId: EntityId] }>();

/** N10: a matched cycle's anchor is its lexicographically first member; null when any
 *  member is outside the snapshot (nothing to select, and no hop is drawn, N7). */
function anchorOf(cycle: CycleView): EntityId | null {
  if (!cycle.matched) return null;
  const first = [...cycle.members].sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0))[0];
  return first?.id ?? null;
}

function showInCity(cycle: CycleView): void {
  const anchor = anchorOf(cycle);
  if (anchor !== null) emit('show-in-city', cycle.findingId, anchor);
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
      v-for="c in cycles"
      :key="c.findingId"
      class="ci-cycle-list__row"
      :class="{ 'ci-cycle-list__row--selected': c.findingId === selectedId }"
    >
      <button
        type="button"
        class="ci-cycle-list__select"
        :aria-pressed="c.findingId === selectedId"
        @click="emit('select', c.findingId)"
      >
        <span class="ci-cycle-list__kind">{{ c.kind === 'import' ? CYCLE_KIND_IMPORT : CYCLE_KIND_RE_EXPORT }}</span>
        <span class="ci-cycle-list__count">{{ ARCH_NODE_FILES(c.members.length) }}</span>
        <code
          v-if="c.pathText !== ''"
          class="ci-cycle-list__path"
        >{{ c.pathText }}</code>
      </button>
      <ul
        v-if="c.pathText === '' || !c.matched"
        class="ci-cycle-list__members"
      >
        <li
          v-for="m in c.members"
          :key="m.path"
          class="ci-cycle-list__member"
        >
          <code>{{ m.path }}</code><span
            v-if="m.id === null"
            class="ci-cycle-list__unmatched"
          > ({{ RELATION_MEMBER_UNMATCHED }})</span>
        </li>
      </ul>
      <div class="ci-cycle-list__actions">
        <button
          v-if="c.fingerprint !== null"
          type="button"
          class="ci-cycle-list__review"
          :aria-label="CYCLE_REVIEW_LABEL(c.findingId)"
          @click="emit('review', c.fingerprint)"
        >
          {{ CYCLE_REVIEW }}
        </button>
        <button
          v-if="anchorOf(c) !== null"
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
