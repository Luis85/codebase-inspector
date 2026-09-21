<script setup lang="ts">
import type { Investigation } from '../../read-models/overview';
import Icon from '../../kit/Icon.vue';

defineProps<{ items: readonly Investigation[] }>();
const emit = defineEmits<{ open: [item: Investigation] }>();
</script>

<template>
  <ul class="ci-investigations">
    <li
      v-for="item in items"
      :key="item.id"
    >
      <button
        type="button"
        class="ci-investigation"
        @click="emit('open', item)"
      >
        <Icon :name="item.icon" />
        <span class="ci-investigation__text">
          <span class="ci-investigation__title">{{ item.title }}</span>
          <span class="ci-investigation__detail">{{ item.detail }}</span>
        </span>
        <Icon name="chevron-right" />
      </button>
    </li>
  </ul>
</template>
