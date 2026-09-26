<script setup lang="ts">
defineProps<{ title?: string; subtitle?: string; footnote?: string }>();
</script>

<template>
  <section class="ci-panel">
    <header
      v-if="title || $slots.actions"
      class="ci-panel__header"
    >
      <div>
        <h3
          v-if="title"
          class="ci-panel__title"
        >
          {{ title }}
        </h3>
        <p
          v-if="subtitle"
          class="ci-panel__subtitle"
        >
          {{ subtitle }}
        </p>
      </div>
      <slot name="actions" />
    </header>
    <div class="ci-panel__body">
      <slot />
    </div>
    <p
      v-if="footnote"
      class="ci-panel__footnote"
    >
      {{ footnote }}
    </p>
  </section>
</template>
