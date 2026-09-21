<script setup lang="ts">
import type { SamplePackage } from '../../fixtures/sample-packages';
import { DEPS_INSPECT, DEPS_PATH_DIRECT, DEPS_PATH_TRANSITIVE } from '../../inspector-copy';

defineProps<{ rootLabel: string; path: readonly SamplePackage[] }>();
const emit = defineEmits<{ inspect: [pkg: SamplePackage] }>();

const relationshipLabel = (pkg: SamplePackage): string => (pkg.relationship === 'direct' ? DEPS_PATH_DIRECT : DEPS_PATH_TRANSITIVE);
</script>

<template>
  <ol class="ci-dep-path">
    <li class="ci-dep-path__step">
      <span class="ci-dep-path__label">{{ rootLabel }}</span>
    </li>
    <li
      v-for="pkg in path"
      :key="pkg.name"
      class="ci-dep-path__step"
    >
      <span class="ci-dep-path__label">
        <code>{{ pkg.name }}</code>
        <span class="ci-hotspots__note">{{ relationshipLabel(pkg) }} · <code>{{ pkg.version }}</code></span>
      </span>
      <button
        type="button"
        class="ci-dep-path__inspect"
        @click="emit('inspect', pkg)"
      >
        {{ DEPS_INSPECT }}
      </button>
    </li>
  </ol>
</template>
