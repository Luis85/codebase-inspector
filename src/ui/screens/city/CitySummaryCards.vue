<script setup lang="ts">
import { formatMetric } from '../../evidence';
import { useReadModels } from '../../read-models/use-read-models';
import { useCityStore } from '../../stores/city-store';
import Icon from '../../kit/Icon.vue';
import ProvenanceBadge from '../../kit/ProvenanceBadge.vue';

const store = useCityStore();
const { citySummary } = useReadModels();
</script>

<template>
  <div class="ci-city-summary">
    <button
      v-for="card in citySummary"
      :key="card.id"
      type="button"
      class="ci-city-summary__card"
      @click="store.navigate(card.route)"
    >
      <span class="ci-city-summary__value">{{ formatMetric(card.value) }}</span>
      <span class="ci-city-summary__text">
        <span class="ci-city-summary__title">{{ card.title }}
          <ProvenanceBadge
            v-if="card.value.state !== 'collected'"
            :state="card.value.state"
          />
        </span>
        <span class="ci-city-summary__caption">{{ card.value.reason ?? card.caption }}</span>
      </span>
      <Icon name="arrow-right" />
    </button>
  </div>
</template>
