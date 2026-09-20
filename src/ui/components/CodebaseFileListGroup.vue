<!--
  Task 6: one district's own heading (name, count, C07's `directoryFocusRequested`
  control) plus its rows, split out of CodebaseFileList.vue purely so the row `<li
  v-for v-memo>` below is not itself nested inside a DIFFERENT v-for'd element.
  eslint-plugin-vue's `vue/valid-v-memo` (and the same rule in the Vue compiler this
  lints for) requires v-memo to sit on the SAME element as the v-for it memoises, with
  no other v-for'd ancestor in between — CodebaseFileList.vue's own `v-for="group in
  groupedFiles"` would be exactly that ancestor if this list stayed inline there. A
  component boundary is the standard way around it: this file's template has no outer
  v-for of its own, so the row `<li>`'s v-for/v-memo pair is the ONLY one here, exactly
  as it was before grouping existed. Ownership (selection, dimming, roving focus,
  district focus) stays in the parent; this component reads it through props
  (`rowStates`, precomputed once per relevant store change — never a function prop,
  see file-list-types.ts) and asks for it through emits, never touching the store
  directly.
-->
<script setup lang="ts">
import { formatDirectoryFocusLabel, formatFileListGroup } from '../copy';
import type { FileGroup, RowState } from './file-list-types';
import type { EntityId } from '../../domain/entity-id';

const props = defineProps<{
  group: FileGroup;
  rowStates: ReadonlyMap<EntityId, RowState>;
}>();

const emit = defineEmits<{
  activate: [entityId: EntityId, event: Event];
  focusRow: [entityId: EntityId];
  focusDistrict: [directoryId: EntityId];
}>();

const FALLBACK_ROW_STATE: RowState = { dimmed: false, tabIndex: -1, selected: false };

/** A row whose entity fell out of `rowStates` (never expected in practice — the parent
 *  builds it from the SAME `fileEntities` this group's own entities come from — but a
 *  stale prop mid-transition is cheaper to render inertly than to crash on). */
function rowState(entityId: EntityId): RowState {
  return props.rowStates.get(entityId) ?? FALLBACK_ROW_STATE;
}

interface PathSegment { text: string; wbr: boolean }

/** F4: `presentation/views/GeometrySidecarVie` / `w.ts` — the previous
 *  `overflow-wrap: anywhere` broke a path anywhere it ran out of room, including
 *  mid-word, inside a single filename with no separator at all. This breaks a path
 *  ONLY at `/`, via an explicit <wbr> — never mid-word — pairing with the
 *  `word-break: keep-all` half of the fix in the C07 section of styles.css; the two
 *  only work together (that rule alone would still allow a break inside a run with no
 *  <wbr>, and <wbr> alone would still let `anywhere` break elsewhere). Keeping the
 *  separator attached to the segment BEFORE it (`presentation/`, not `/presentation`)
 *  means the rendered text is character-for-character `entity.path` — <wbr> is a
 *  visual break opportunity, never a text node — so a copy/select of the row still
 *  yields the exact path (foundations/04: full path preserved "through wrapping, a
 *  copy action, and accessible text"). */
function wrapSegments(path: string): PathSegment[] {
  const parts = path.split('/');
  return parts.map((part, i) => {
    const isLast = i === parts.length - 1;
    return { text: isLast ? part : `${part}/`, wbr: !isLast };
  });
}

function activate(entityId: EntityId, event: Event): void {
  emit('activate', entityId, event);
}

function focusRow(entityId: EntityId): void {
  emit('focusRow', entityId);
}

function focusDistrict(): void {
  emit('focusDistrict', props.group.directoryId);
}
</script>

<template>
  <section class="ci-file-list__group">
    <h4 class="ci-file-list__group-heading">
      <!-- Kept on one physical line, deliberately: the Vue 3 template compiler's
           default whitespace handling drops a whitespace-only text node between
           elements when it contains a newline, but condenses one that does not to a
           single space — so a line break between these three would silently lose the
           space `groups[0].text()` (task-6 test) depends on to read "24 files" rather
           than "24files". -->
      <span class="ci-file-list__group-name">{{ group.name }}</span> <span class="ci-file-list__group-count">{{ formatFileListGroup(group.entities.length) }}</span> <button
        type="button"
        class="ci-file-list__group-focus"
        :aria-label="formatDirectoryFocusLabel(group.name)"
        @click="focusDistrict"
      >
        Focus
      </button>
    </h4>
    <ul class="ci-file-list__rows">
      <!-- `v-memo` on the row: the ONLY things that can change a row's rendering are the
           four below, so a keystroke that changes `matchingIds` now re-patches only the
           rows whose dimming actually flipped, instead of all ~1,000. `entity.path` is
           included because the entity list itself can change under a new snapshot, and
           because it is what `wrapSegments` above renders from. -->
      <li
        v-for="entity in group.entities"
        :key="entity.id"
        v-memo="[
          entity.path,
          rowState(entity.id).selected,
          rowState(entity.id).dimmed,
          rowState(entity.id).tabIndex,
        ]"
      >
        <button
          type="button"
          class="ci-file-list__row"
          :class="{
            'ci-file-list__row--dimmed': rowState(entity.id).dimmed,
            'ci-file-list__row--selected': rowState(entity.id).selected,
          }"
          :tabindex="rowState(entity.id).tabIndex"
          :aria-pressed="rowState(entity.id).selected"
          @click="activate(entity.id, $event)"
          @focus="focusRow(entity.id)"
        >
          <!-- `<span>`, not `<template>`: both are otherwise equivalent as a v-for
               host for inline content, but `span` is one of eslint-plugin-vue's own
               "inline, non-void" elements and so is exempt from its two
               content-newline rules -- `template` is not, and a rule-satisfying
               newline INSIDE this element would be a whitespace-only text node
               containing a newline, which the Vue 3 compiler's default whitespace
               handling drops entirely between two tags but is not guaranteed to drop
               between a tag and an adjacent interpolation the same way, which is a
               risk not worth taking against a test that reads the row's exact
               textContent. `<span>` sidesteps the question rather than relying on it. -->
          <span
            v-for="(segment, i) in wrapSegments(entity.path)"
            :key="i"
          >{{ segment.text }}<wbr v-if="segment.wbr"></span>
        </button>
      </li>
    </ul>
  </section>
</template>
