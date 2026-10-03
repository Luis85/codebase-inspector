<script setup lang="ts">
import Icon from '../../kit/Icon.vue';

withDefaults(defineProps<{ title: string; body: string; icon?: string }>(), { icon: 'search' });
</script>

<template>
  <div class="ci-unknown-state">
    <Icon :name="icon" />
    <h3 class="ci-unknown-state__title">
      {{ title }}
    </h3>
    <p
      v-if="body"
      class="ci-unknown-state__body"
    >
      {{ body }}
    </p>
    <slot />
  </div>
</template>
