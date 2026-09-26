<script setup lang="ts">
import { computed, inject } from 'vue';
import type { RouteId } from '../../domain/route-ids';
import { NAV_FOOTER, NAV_SECTIONS, ROUTE_META } from '../routes';
import { CLOSE_NAVIGATION_LABEL } from '../inspector-copy';
import { useCityStore } from '../stores/city-store';
import { useReviewStore } from '../stores/review-store';
import { useReadModels } from '../read-models/use-read-models';
import { openFindingsValue } from '../read-models/findings';
import Icon from '../kit/Icon.vue';

const props = defineProps<{ drawer: boolean; workspaceLabel: string }>();
const emit = defineEmits<{ navigate: [route: RouteId]; close: [] }>();

const store = useCityStore();
const review = useReviewStore();
const { quality } = useReadModels();
const onSelectCodebase = inject<() => void>('onSelectCodebase', () => {});

/** Only COLLECTED counts become nav badges: a nav badge carries no evidence label, so a
 *  stale, partial or unknown count would read as current (spec §9 A11). Part 6 Y34: the
 *  Code quality badge counts the imported fallow findings, shown only while that count
 *  is collected (a current report). E48 (I1): it is the Quality screen's own open count,
 *  so an acknowledged or dismissed finding drops out. Work items are real. */
const badges = computed<Partial<Record<RouteId, number>>>(() => {
  const findings = openFindingsValue(quality.value);
  return {
    quality: findings.state === 'collected' ? findings.value : undefined,
    // Part 4 W13: items not yet verified.
    workbench: review.openWorkItemCount || undefined,
  };
});

/** A drawer only (spec §9 A12): Escape closes it; Tab and Shift+Tab wrap inside it, so
 *  focus never reaches the covered content. The inline column claims neither key, so the
 *  city's own escape chain still resolves Escape. */
function onKeydown(event: KeyboardEvent): void {
  if (!props.drawer) return;
  if (event.key === 'Escape') {
    event.preventDefault();
    event.stopPropagation();
    emit('close');
    return;
  }
  if (event.key !== 'Tab') return;
  const nav = event.currentTarget as HTMLElement;
  const items = [...nav.querySelectorAll<HTMLElement>('button:not([disabled])')];
  const first = items[0];
  const last = items[items.length - 1];
  const active = nav.ownerDocument.activeElement;
  if (!first || !last) return;
  if (!event.shiftKey && active === last) { event.preventDefault(); first.focus(); }
  else if (event.shiftKey && active === first) { event.preventDefault(); last.focus(); }
}
</script>

<template>
  <nav
    class="ci-shell__nav ci-nav"
    aria-label="Codebase Inspector"
    @keydown="onKeydown"
  >
    <div class="ci-nav__head">
      <button
        type="button"
        class="ci-nav__workspace"
        @click="onSelectCodebase"
      >
        <Icon name="folder-git-2" />
        <span>{{ workspaceLabel }}</span>
      </button>
      <button
        v-if="drawer"
        type="button"
        class="ci-nav__close"
        :aria-label="CLOSE_NAVIGATION_LABEL"
        @click="emit('close')"
      >
        <Icon name="x" />
      </button>
    </div>
    <div
      v-for="section in NAV_SECTIONS"
      :key="section.group"
      class="ci-nav__section"
    >
      <p class="ci-nav__group">
        {{ section.group }}
      </p>
      <button
        v-for="id in section.routes"
        :key="id"
        type="button"
        class="ci-nav__item"
        :aria-current="store.route === id ? 'page' : undefined"
        @click="emit('navigate', id)"
      >
        <Icon :name="ROUTE_META[id].icon" />
        <span class="ci-nav__label">{{ ROUTE_META[id].title }}</span>
        <span
          v-if="badges[id] !== undefined"
          class="ci-nav__badge"
        >{{ badges[id] }}</span>
      </button>
    </div>
    <div class="ci-nav__footer">
      <button
        v-for="id in NAV_FOOTER"
        :key="id"
        type="button"
        class="ci-nav__item"
        :aria-current="store.route === id ? 'page' : undefined"
        @click="emit('navigate', id)"
      >
        <Icon :name="ROUTE_META[id].icon" />
        <span class="ci-nav__label">{{ ROUTE_META[id].title }}</span>
      </button>
    </div>
  </nav>
</template>
