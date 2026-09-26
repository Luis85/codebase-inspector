<script setup lang="ts">
import type { ScopeRow } from '../../read-models/sources';
import { SOURCES_SCOPE_EDIT, SOURCES_SCOPE_SUBTITLE, SOURCES_SCOPE_TITLE } from '../../inspector-copy';
import Panel from '../../kit/Panel.vue';
import NoSnapshot from '../NoSnapshot.vue';

defineProps<{ rows: readonly ScopeRow[] | null }>();
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
        <p class="ci-note">
          {{ SOURCES_SCOPE_EDIT }}
        </p>
      </template>
    </Panel>
  </div>
</template>
