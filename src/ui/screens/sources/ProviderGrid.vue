<script setup lang="ts">
import type { RouteId } from '../../../domain/route-ids';
import type { ProviderCard } from '../../read-models/sources';
import { ROUTE_META } from '../../routes';
import { SOURCES_PROVIDERS_TITLE, SOURCES_USED_BY } from '../../inspector-copy';
import Icon from '../../kit/Icon.vue';
import ProvenanceBadge from '../../kit/ProvenanceBadge.vue';

defineProps<{ providers: readonly ProviderCard[] }>();
const emit = defineEmits<{ open: [route: RouteId] }>();
</script>

<template>
  <section class="ci-providers">
    <h3 class="ci-providers__title">
      {{ SOURCES_PROVIDERS_TITLE }}
    </h3>
    <div class="ci-providers__grid">
      <article
        v-for="p in providers"
        :key="p.id"
        class="ci-provider"
        :class="`ci-provider--${p.id}`"
      >
        <div class="ci-provider__head">
          <span class="ci-provider__icon">
            <Icon :name="p.icon" />
          </span>
          <ProvenanceBadge
            v-if="p.state !== 'collected'"
            :state="p.state"
          />
        </div>
        <h4 class="ci-provider__name">
          {{ p.title }}
        </h4>
        <p class="ci-note">
          {{ p.source }}
        </p>
        <p class="ci-provider__text">
          {{ p.description }}
        </p>
        <div class="ci-provider__routes">
          <span class="ci-note">
            {{ SOURCES_USED_BY }}
          </span>
          <button
            v-for="r in p.routes"
            :key="r"
            type="button"
            class="ci-provider__route"
            @click="emit('open', r)"
          >
            {{ ROUTE_META[r].title }}
          </button>
        </div>
      </article>
    </div>
  </section>
</template>
