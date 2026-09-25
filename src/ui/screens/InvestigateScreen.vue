<!--
  WP-04 IN4/IN6: the Investigate route. Task 1 lays the screen's empty and gone states; the
  finding list, filters, evidence bundle and note panels arrive in later tasks.
-->
<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useReadModels } from '../read-models/use-read-models';
import { useCityStore } from '../stores/city-store';
import { useInvestigationStore } from '../stores/investigation-store';
import { useImportReport } from './use-import-report';
import { reannounce } from '../kit/reannounce';
import { INVESTIGATE_EYEBROW, INVESTIGATE_FINDING_GONE, INVESTIGATE_SUBTITLE, INVESTIGATE_TITLE } from '../inspector-copy';
import PageHeader from '../kit/PageHeader.vue';
import Callout from '../kit/Callout.vue';
import NotAnalysed from '../kit/NotAnalysed.vue';
import NoSnapshot from './NoSnapshot.vue';

const store = useCityStore();
const investigation = useInvestigationStore();
const importReport = useImportReport();
const { quality } = useReadModels();
const report = computed(() => quality.value.evidence.report);
const liveMessage = ref('');

/** IN4/IN34: a re-import that no longer reports the selected fingerprint clears the
 *  selection and raises the gone notice. Task 11 replaces quality.value.byFingerprint with
 *  the investigation model's own map, which has the same keys. Global Constraints E17:
 *  announce only the real outcome, through reannounce (a repeated gone finding is heard
 *  again, as every other screen's live region does — SettingsScreen.vue, SourcesScreen.vue). */
watch(() => {
  const fp = investigation.selectedFingerprint;
  return fp !== null && report.value !== null && !quality.value.byFingerprint.has(fp);
}, (gone) => {
  if (!gone) return;
  investigation.markGone();
  void reannounce(liveMessage, INVESTIGATE_FINDING_GONE);
}, { immediate: true });
</script>

<template>
  <div class="ci-screen ci-screen--investigate">
    <PageHeader
      :eyebrow="INVESTIGATE_EYEBROW"
      :title="INVESTIGATE_TITLE"
      :subtitle="INVESTIGATE_SUBTITLE"
    />
    <p
      class="visually-hidden ci-investigate__live"
      role="status"
    >
      {{ liveMessage }}
    </p>
    <NoSnapshot v-if="!store.snapshot" />
    <template v-else>
      <Callout
        v-if="investigation.findingGone"
        tone="warning"
        :title="INVESTIGATE_FINDING_GONE"
      />
      <NotAnalysed
        v-if="!report"
        @import="importReport"
      />
    </template>
  </div>
</template>
