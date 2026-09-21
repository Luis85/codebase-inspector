<script setup lang="ts">
defineProps<{ eyebrow: string; title: string; subtitle?: string }>();
</script>

<template>
  <header class="ci-page-header">
    <div class="ci-page-header__text">
      <p class="ci-page-header__eyebrow">
        {{ eyebrow }}
      </p>
      <h2 class="ci-page-header__title">
        {{ title }}
      </h2>
      <p
        v-if="subtitle"
        class="ci-page-header__subtitle"
      >
        {{ subtitle }}
      </p>
    </div>
    <div class="ci-page-header__actions">
      <slot name="actions" />
    </div>
  </header>
</template>
