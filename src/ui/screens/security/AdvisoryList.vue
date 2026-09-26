<script setup lang="ts">
import { computed } from 'vue';
import type { SampleAdvisory, SamplePackage } from '../../fixtures/sample-packages';
import { useUniqueId } from '../../unique-id';
import { SECURITY_ADVISORY_LABEL, SECURITY_ADVISORY_VERSIONS, SECURITY_REVIEW_BADGE } from '../../inspector-copy';
import Icon from '../../kit/Icon.vue';
import ProvenanceBadge from '../../kit/ProvenanceBadge.vue';

interface AdvisoryItem { pkg: SamplePackage; advisory: SampleAdvisory; summaryId: string }

const props = defineProps<{ advisories: readonly SamplePackage[] }>();
const emit = defineEmits<{ inspect: [pkg: SamplePackage] }>();

// One id per row, aligned by index to `advisories` (called once in setup, per
// useUniqueId's "script setup only" contract) — fix round 1 (Minor 5): the button's
// aria-describedby points at its own summary span.
const summaryIds = props.advisories.map(() => useUniqueId('ci-advisory-summary'));

// Narrows `advisory` to non-null without an assertion: every row in this list has one,
// but SamplePackage's own type still allows null.
const items = computed<AdvisoryItem[]>(() => props.advisories.flatMap((pkg, i) => (
  pkg.advisory ? [{ pkg, advisory: pkg.advisory, summaryId: summaryIds[i]! }] : []
)));
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
        :aria-describedby="item.summaryId"
        @click="emit('inspect', item.pkg)"
      >
        <Icon name="alert-triangle" />
        <span class="ci-advisory__body">
          <span class="ci-advisory__top">
            <span class="ci-chip ci-chip--warning">{{ SECURITY_REVIEW_BADGE }}</span>
            <code>{{ item.advisory.id }}</code>
            <span class="ci-advisory__name">{{ item.pkg.name }}</span>
          </span>
          <span
            :id="item.summaryId"
            class="ci-advisory__summary"
          >{{ item.advisory.summary }}</span>
          <span class="ci-advisory__versions">{{ SECURITY_ADVISORY_VERSIONS(item.pkg.version, item.advisory.patched) }}</span>
        </span>
      </button>
      <ProvenanceBadge state="sample" />
    </li>
  </ul>
</template>
