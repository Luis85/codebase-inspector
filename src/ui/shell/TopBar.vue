<script setup lang="ts">
import { computed } from 'vue';
import { ROUTE_META } from '../routes';
import {
  BREADCRUMB_LABEL, BREADCRUMB_ROOT, OPEN_NAVIGATION_LABEL, PALETTE_SHORTCUT_HINT,
  SAMPLE_DATA_DETAIL, SAMPLE_DATA_NOTICE, SEARCH_TRIGGER_LABEL,
} from '../inspector-copy';
import { useCityStore } from '../stores/city-store';
import { useRouteProvenance } from './use-route-provenance';
import Icon from '../kit/Icon.vue';

defineProps<{ workspaceLabel: string }>();
const emit = defineEmits<{ 'open-nav': []; 'open-palette': [] }>();
const store = useCityStore();
const title = computed(() => ROUTE_META[store.route].title);
const usesSample = useRouteProvenance();
</script>

<template>
  <header class="ci-shell__topbar ci-topbar">
    <button
      type="button"
      class="ci-topbar__menu"
      :aria-label="OPEN_NAVIGATION_LABEL"
      @click="emit('open-nav')"
    >
      <Icon name="menu" />
    </button>
    <nav
      class="ci-topbar__crumbs"
      :aria-label="BREADCRUMB_LABEL"
    >
      <span>{{ BREADCRUMB_ROOT }}</span>
      <span aria-hidden="true">/</span>
      <span>{{ workspaceLabel }}</span>
      <span aria-hidden="true">/</span>
      <span aria-current="page">{{ title }}</span>
    </nav>
    <button
      type="button"
      class="ci-topbar__search"
      @click="emit('open-palette')"
    >
      <Icon name="search" />
      <span>{{ SEARCH_TRIGGER_LABEL }}</span>
      <kbd>{{ PALETTE_SHORTCUT_HINT }}</kbd>
    </button>
    <span
      v-if="usesSample"
      class="ci-provenance ci-provenance--sample ci-topbar__sample"
      :title="SAMPLE_DATA_DETAIL"
    >{{ SAMPLE_DATA_NOTICE }}</span>
    <slot name="snapshot" />
  </header>
</template>
