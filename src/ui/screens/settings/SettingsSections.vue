<script setup lang="ts">
import type { ImportCandidate } from './import-candidate';
import type { SettingsTab } from './settings-tabs';
import AboutRows from './AboutRows.vue';
import AccessibilityRows from './AccessibilityRows.vue';
import AnalysisRows from './AnalysisRows.vue';
import AppearanceRows from './AppearanceRows.vue';
import PrivacyRows from './PrivacyRows.vue';

defineProps<{ tab: SettingsTab }>();
const emit = defineEmits<{ priority: []; clear: []; export: []; parsed: [candidate: ImportCandidate] }>();
</script>

<template>
  <div class="ci-settings__rows">
    <AppearanceRows v-if="tab === 'appearance'" />
    <AnalysisRows
      v-else-if="tab === 'analysis'"
      @priority="emit('priority')"
    />
    <AccessibilityRows v-else-if="tab === 'accessibility'" />
    <PrivacyRows
      v-else-if="tab === 'privacy'"
      @clear="emit('clear')"
      @export="emit('export')"
      @parsed="emit('parsed', $event)"
    />
    <AboutRows v-else />
  </div>
</template>
