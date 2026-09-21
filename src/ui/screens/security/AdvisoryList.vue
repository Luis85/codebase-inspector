<script setup lang="ts">
import { computed } from 'vue';
import type { SampleAdvisory, SamplePackage } from '../../fixtures/sample-packages';
import { SECURITY_ADVISORY_LABEL, SECURITY_ADVISORY_VERSIONS, SECURITY_REVIEW_BADGE } from '../../inspector-copy';
import Icon from '../../kit/Icon.vue';
import ProvenanceBadge from '../../kit/ProvenanceBadge.vue';

interface AdvisoryItem { pkg: SamplePackage; advisory: SampleAdvisory }

const props = defineProps<{ advisories: readonly SamplePackage[] }>();
const emit = defineEmits<{ inspect: [pkg: SamplePackage] }>();

// Narrows `advisory` to non-null without an assertion: every row in this list has one,
// but SamplePackage's own type still allows null.
const items = computed<AdvisoryItem[]>(() => props.advisories.flatMap((pkg) => (pkg.advisory ? [{ pkg, advisory: pkg.advisory }] : [])));
</script>

<template>
  <ul class="ci-advisories">
    <li
      v-for="item in items"
      :key="item.pkg.name"
      class="ci-advisory"
    >
      <button
        type="button"
        class="ci-advisory__open"
        :aria-label="SECURITY_ADVISORY_LABEL(item.advisory.id, item.pkg.name)"
        @click="emit('inspect', item.pkg)"
      >
        <Icon name="alert-triangle" />
        <span class="ci-advisory__body">
          <span class="ci-advisory__top">
            <span class="ci-chip ci-chip--warning">{{ SECURITY_REVIEW_BADGE }}</span>
            <code>{{ item.advisory.id }}</code>
            <span class="ci-advisory__name">{{ item.pkg.name }}</span>
          </span>
          <span class="ci-advisory__summary">{{ item.advisory.summary }}</span>
          <span class="ci-advisory__versions">{{ SECURITY_ADVISORY_VERSIONS(item.pkg.version, item.advisory.patched) }}</span>
        </span>
      </button>
      <ProvenanceBadge state="sample" />
    </li>
  </ul>
</template>
