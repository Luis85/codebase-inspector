<script setup lang="ts">
import { nextTick, ref } from 'vue';
import { useUniqueId } from '../unique-id';
import type { TabItem } from './tab-types';

const props = defineProps<{ tabs: readonly TabItem[]; label: string }>();
const model = defineModel<string>({ required: true });
const base = useUniqueId('ci-tabs');
const list = ref<HTMLElement | null>(null);

/** WAI-ARIA tabs with automatic activation: arrows, Home and End move AND select, and
 *  focus follows onto the new tab. Only the selected tab is a tab stop. */
function onKeydown(event: KeyboardEvent): void {
  const n = props.tabs.length;
  const i = props.tabs.findIndex((t) => t.id === model.value);
  const target = event.key === 'ArrowRight' ? (i + 1) % n
    : event.key === 'ArrowLeft' ? (i - 1 + n) % n
      : event.key === 'Home' ? 0
        : event.key === 'End' ? n - 1 : -1;
  const tab = props.tabs[target];
  if (!tab) return;
  event.preventDefault();
  model.value = tab.id;
  void nextTick(() => list.value?.querySelector<HTMLElement>('[aria-selected="true"]')?.focus());
}
</script>

<template>
  <div class="ci-tabs">
    <div class="ci-tabs__bar">
      <div
        ref="list"
        role="tablist"
        class="ci-tabs__list"
        :aria-label="label"
        @keydown="onKeydown"
      >
        <button
          v-for="t in tabs"
          :id="`${base}-tab-${t.id}`"
          :key="t.id"
          type="button"
          role="tab"
          class="ci-tabs__tab"
          :aria-selected="t.id === model"
          :aria-controls="`${base}-panel`"
          :tabindex="t.id === model ? 0 : -1"
          @click="model = t.id"
        >
          {{ t.label }}
        </button>
      </div>
      <slot name="toolbar" />
    </div>
    <div
      :id="`${base}-panel`"
      role="tabpanel"
      class="ci-tabs__panel"
      :aria-labelledby="`${base}-tab-${model}`"
    >
      <slot />
    </div>
  </div>
</template>
