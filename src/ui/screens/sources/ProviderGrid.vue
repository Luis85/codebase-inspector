<script setup lang="ts">
import type { RouteId } from '../../../domain/route-ids';
import type { ProviderCard } from '../../read-models/sources';
import { ROUTE_META } from '../../routes';
import { useUniqueId } from '../../unique-id';
import { SOURCES_OPEN_ROUTE, SOURCES_PROVIDERS_TITLE, SOURCES_USED_BY, SOURCES_USED_BY_GROUP } from '../../inspector-copy';
import Icon from '../../kit/Icon.vue';
import ProvenanceBadge from '../../kit/ProvenanceBadge.vue';

defineProps<{ providers: readonly ProviderCard[] }>();
const emit = defineEmits<{ open: [route: RouteId] }>();
/** Part 5 V28: one unique base per grid. Each card's heading id adds the provider id, so
 *  every article is labelled by its own h4. */
const base = useUniqueId('ci-provider');
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
        :aria-labelledby="`${base}-${p.id}-name`"
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
        <h4
          :id="`${base}-${p.id}-name`"
          class="ci-provider__name"
        >
          {{ p.title }}
        </h4>
        <p class="ci-note">
          {{ p.source }}
        </p>
        <p class="ci-provider__text">
          {{ p.description }}
        </p>
        <!-- Part 6 Y37: an optional per-card slot, `card-<id>`; only the fallow card uses it. -->
        <slot :name="`card-${p.id}`" />
        <div
          class="ci-provider__routes"
          role="group"
          :aria-label="SOURCES_USED_BY_GROUP(p.title)"
        >
          <span class="ci-note">
            {{ SOURCES_USED_BY }}
          </span>
          <button
            v-for="r in p.routes"
            :key="r"
            type="button"
            class="ci-provider__route"
            :aria-label="SOURCES_OPEN_ROUTE(ROUTE_META[r].title)"
            @click="emit('open', r)"
          >
            {{ ROUTE_META[r].title }}
          </button>
        </div>
      </article>
    </div>
  </section>
</template>
