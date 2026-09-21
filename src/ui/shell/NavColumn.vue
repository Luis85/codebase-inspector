<script setup lang="ts">
import { computed, inject } from 'vue';
import type { RouteId } from '../../domain/route-ids';
import { NAV_FOOTER, NAV_SECTIONS, ROUTE_META } from '../routes';
import { CLOSE_NAVIGATION_LABEL } from '../inspector-copy';
import { useCityStore } from '../stores/city-store';
import { useReviewStore } from '../stores/review-store';
import { useReadModels } from '../read-models/use-read-models';
import Icon from '../kit/Icon.vue';

const props = defineProps<{ drawer: boolean; workspaceLabel: string }>();
const emit = defineEmits<{ navigate: [route: RouteId]; close: [] }>();

const store = useCityStore();
const review = useReviewStore();
const { overview } = useReadModels();
const onSelectCodebase = inject<() => void>('onSelectCodebase', () => {});

/** Only COLLECTED counts become nav badges: a nav badge carries no Sample label, so a
 *  sample findings count would read as measured (spec §9 A11 — none are collected in
 *  Part 1, so the Code quality badge is absent). Work items are real, in-memory. */
const badges = computed<Partial<Record<RouteId, number>>>(() => {
  const findings = overview.value?.cards.find((c) => c.id === 'findings')?.value;
  return {
    quality: findings?.state === 'collected' ? findings.value : undefined,
    workbench: review.workItemCount || undefined,
  };
});

/** Escape closes the nav only as a DRAWER (spec §9 A12); the inline column leaves the
 *  press unclaimed so the city's own escape chain still resolves it. */
function onKeydown(event: KeyboardEvent): void {
  if (event.key !== 'Escape' || !props.drawer) return;
  event.preventDefault();
  event.stopPropagation();
  emit('close');
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
