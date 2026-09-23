<!--
  Part 6 Y40 (S15 zone 2): the findings-lens heading over the viewport — eyebrow, title, the
  matched counts and the C13 EvidenceBadge, plus COPY-16 when the evidence is stale (the lens
  stays available on stale evidence, Y30). Rendered only while the lens is active.
-->
<script setup lang="ts">
import { computed } from 'vue';
import { useLensView } from '../../read-models/use-lens-view';
import { evidenceBadgeFor, staleCauseOf } from '../../read-models/evidence-index';
import { originOf } from '../../read-models/fallow-candidate';
import { formatAbsoluteTime } from '../../copy';
import { FALLOW_STALE_NOTICE, LENS_EYEBROW, LENS_SUBTITLE, LENS_TITLE } from '../../inspector-copy';
import EvidenceBadge from '../../kit/EvidenceBadge.vue';

const { active, evidence } = useLensView();
const report = computed(() => (active.value ? evidence.value.report : null));
const stale = computed(() => evidence.value.state === 'stale');
const subtitle = computed(() => LENS_SUBTITLE(evidence.value.matchedFindings, evidence.value.matchedFiles, report.value ? originOf(report.value) : 'imported'));
const staleNote = computed(() => (report.value && stale.value
  ? FALLOW_STALE_NOTICE(formatAbsoluteTime(report.value.importedAt, Intl), staleCauseOf(report.value)) : null));
</script>

<template>
  <div
    v-if="report"
    class="ci-city-lens"
  >
    <div class="ci-city-lens__text">
      <p class="ci-city-lens__eyebrow">
        {{ LENS_EYEBROW }}
      </p>
      <h3 class="ci-city-lens__title">
        {{ LENS_TITLE }}
      </h3>
      <p class="ci-city-lens__subtitle">
        {{ subtitle }}
      </p>
      <p
        v-if="staleNote"
        class="ci-city-lens__stale"
      >
        {{ staleNote }}
      </p>
    </div>
    <EvidenceBadge v-bind="evidenceBadgeFor(evidence)!" />
  </div>
</template>
