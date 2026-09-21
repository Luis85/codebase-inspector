<script setup lang="ts">
import Icon from './Icon.vue';

withDefaults(defineProps<{ tone?: 'info' | 'warning'; title: string; badge?: string }>(), { tone: 'info', badge: undefined });
</script>

<template>
  <div
    class="ci-callout"
    :class="`ci-callout--${tone}`"
    role="note"
  >
    <Icon :name="tone === 'warning' ? 'alert-triangle' : 'info'" />
    <div class="ci-callout__body">
      <p class="ci-callout__title">
        {{ title }}
      </p>
      <p
        v-if="$slots.default"
        class="ci-callout__text"
      >
        <slot />
      </p>
    </div>
    <span
      v-if="badge"
      class="ci-callout__badge"
    >{{ badge }}</span>
  </div>
</template>
