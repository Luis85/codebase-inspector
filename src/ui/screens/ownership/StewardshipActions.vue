<script setup lang="ts">
import type { StewardshipAction } from '../../read-models/ownership';
import { useReviewStore } from '../../stores/review-store';
import type { WorkTarget } from '../../stores/ports/review-repository';
import {
  OWNERSHIP_ACTION_ADD, OWNERSHIP_ACTION_ADD_SHORT, OWNERSHIP_ACTION_ADDED, OWNERSHIP_ACTION_ADDED_LABEL,
} from '../../inspector-copy';
import Icon from '../../kit/Icon.vue';

defineProps<{ actions: readonly StewardshipAction[] }>();
const emit = defineEmits<{ add: [action: StewardshipAction] }>();
const review = useReviewStore();

const ICON_BY_INTENT: Readonly<Record<StewardshipAction['intent'], string>> = {
  pairing: 'users', tests: 'flask-conical', documentation: 'file-text',
};

const target = (a: StewardshipAction): WorkTarget => ({ kind: 'module', module: a.module });
const added = (a: StewardshipAction): boolean => review.hasWorkItem(target(a), a.intent);
/** Task 8 lesson (carried forward, E50/E44): `disabled` on the focused button would drop
 *  focus to <body> in a real browser, so an added or pending action is `aria-disabled`
 *  and the press is ignored here instead. */
const blocked = (a: StewardshipAction): boolean => added(a) || review.isPending(target(a), a.intent);
function add(a: StewardshipAction): void {
  if (!blocked(a)) emit('add', a);
}
</script>

<template>
  <ul class="ci-steward-actions">
    <li
      v-for="a in actions"
      :key="`${a.intent}:${a.module}`"
      class="ci-steward-action"
    >
      <Icon :name="ICON_BY_INTENT[a.intent]" />
      <span class="ci-steward-action__text">
        <span class="ci-steward-action__title">{{ a.title }}</span>
        <span class="ci-steward-action__body">{{ a.body }}</span>
      </span>
      <button
        type="button"
        class="ci-steward-action__add"
        :aria-label="added(a) ? OWNERSHIP_ACTION_ADDED_LABEL(a.title) : OWNERSHIP_ACTION_ADD(a.title)"
        :aria-disabled="blocked(a)"
        @click="add(a)"
      >
        <Icon name="plus" />
        {{ added(a) ? OWNERSHIP_ACTION_ADDED : OWNERSHIP_ACTION_ADD_SHORT }}
      </button>
    </li>
  </ul>
</template>
