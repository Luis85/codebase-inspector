<script setup lang="ts">
import type { ScopeRow } from '../../read-models/sources';
import { SOURCES_SCOPE_EDIT, SOURCES_SCOPE_SUBTITLE, SOURCES_SCOPE_TITLE } from '../../inspector-copy';
import Panel from '../../kit/Panel.vue';
import NoSnapshot from '../NoSnapshot.vue';

defineProps<{ rows: readonly ScopeRow[] | null; warnings?: readonly string[] }>();
</script>

<template>
  <div class="ci-sources__scope">
    <Panel
      :title="SOURCES_SCOPE_TITLE"
      :subtitle="SOURCES_SCOPE_SUBTITLE"
    >
      <NoSnapshot v-if="!rows" />
      <template v-else>
        <dl class="ci-sources__facts">
          <template
            v-for="r in rows"
            :key="r.id"
          >
            <dt>
              {{ r.label }}
            </dt>
            <dd>
              <code v-if="r.mono">{{ r.value }}</code>
              <template v-else>
                {{ r.value }}
              </template>
            </dd>
          </template>
        </dl>
        <!-- GRB12 / E34: the snapshot's own warnings, each verbatim (skip reasons and the
             wildcard-exclusion warning). Each one explains itself, so there is no heading. -->
        <ul
          v-if="warnings && warnings.length > 0"
          class="ci-sources__warnings"
        >
          <li
            v-for="(w, i) in warnings"
            :key="i"
          >
            {{ w }}
          </li>
        </ul>
        <p class="ci-note">
          {{ SOURCES_SCOPE_EDIT }}
        </p>
      </template>
    </Panel>
  </div>
</template>
