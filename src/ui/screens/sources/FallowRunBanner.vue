<script setup lang="ts">
// Part 7 Z33 (C16): the provider's status banner on the fallow card. Text first, with an
// icon; role="status". A failure shows COPY-15, its reason, whether the previous findings
// were kept (marked stale), and the last lines of fallow's error output, as text only.
import type { FallowRunBanner } from '../../read-models/fallow-run';
import { FALLOW_RUN_KEPT, FALLOW_RUN_LOG } from '../../inspector-copy';
import Icon from '../../kit/Icon.vue';

defineProps<{ banner: FallowRunBanner }>();
</script>

<template>
  <div
    class="ci-fallow-run__banner"
    :class="`ci-fallow-run__banner--${banner.tone}`"
    role="status"
  >
    <p class="ci-fallow-run__banner-text">
      <Icon :name="banner.icon" />
      {{ banner.text }}
    </p>
    <p
      v-if="banner.reason"
      class="ci-fallow-run__reason"
    >
      {{ banner.reason }}
    </p>
    <p
      v-if="banner.kept"
      class="ci-fallow-run__kept"
    >
      {{ FALLOW_RUN_KEPT }}
    </p>
    <details
      v-if="banner.log"
      class="ci-fallow-run__log"
    >
      <summary>{{ FALLOW_RUN_LOG }}</summary>
      <pre>{{ banner.log }}</pre>
    </details>
  </div>
</template>
