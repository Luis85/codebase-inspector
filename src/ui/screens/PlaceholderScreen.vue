<script setup lang="ts">
import { computed } from 'vue';
import type { RouteId } from '../../domain/route-ids';
import { ROUTE_META } from '../routes';
import { PLACEHOLDER_ARRIVES } from '../inspector-copy';
import PageHeader from '../kit/PageHeader.vue';
import Callout from '../kit/Callout.vue';

const props = defineProps<{ route: RouteId }>();
const meta = computed(() => ROUTE_META[props.route]);
</script>

<template>
  <div class="ci-screen ci-screen--placeholder">
    <PageHeader
      :eyebrow="`${meta.group} / ${meta.title}`"
      :title="meta.title"
      :subtitle="meta.goal"
    />
    <Callout :title="PLACEHOLDER_ARRIVES(meta.part)">
      {{ meta.goal }}
    </Callout>
  </div>
</template>
