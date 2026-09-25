<!--
  WP-04 Task 15 (IP32/IP33): the city inspector's Findings section, beside
  CityRelationsPanel — shown only while a report is attached, for the selected file's
  own `touchingFindings` (findings.ts): anchored findings first, then related ones
  (marked FINDING_VIA_RELATED), at most CITY_FINDINGS_LIMIT rows, then "N more on
  Investigate". Every row's Investigate button goes through the ONE entry point
  (use-open-investigation.ts, IN5) — it never selects a file or moves the camera; IP20
  keeps the city selection exactly where the entry point found it.
-->
<script setup lang="ts">
import { computed } from 'vue';
import { useCityStore } from '../../stores/city-store';
import { useReadModels } from '../../read-models/use-read-models';
import { touchingFindings } from '../../read-models/findings';
import { useOpenInvestigation } from '../investigate/use-open-investigation';
import {
  CITY_FINDINGS_MORE, CITY_FINDINGS_ROW, CITY_FINDINGS_TITLE, FINDING_KIND_LABEL, FINDING_VIA_RELATED, INVESTIGATE_ACTION,
  INVESTIGATE_FINDING_LABEL, RULE_TEXT,
} from '../../inspector-copy';

// IP32: an exported constant nobody imports is a dead export (npm run analyze), so this
// stays module-private.
const CITY_FINDINGS_LIMIT = 10;

const city = useCityStore();
const { files, evidence } = useReadModels();
const openInvestigation = useOpenInvestigation();

const selectedFile = computed(() => files.value.find((f) => f.id === city.selectedEntityId) ?? null);

/** Anchored rows first, then related ones — both from the ONE canonical builder
 *  (touchingFindings), so this can never list a finding the Quality/File detail screens
 *  would not also show for this file. */
const rows = computed(() => {
  const file = selectedFile.value;
  if (!file || evidence.value.report === null) return [];
  const all = touchingFindings(file, evidence.value);
  return [...all.filter((f) => f.anchored), ...all.filter((f) => !f.anchored)];
});
const shown = computed(() => rows.value.slice(0, CITY_FINDINGS_LIMIT));
const hiddenCount = computed(() => Math.max(0, rows.value.length - CITY_FINDINGS_LIMIT));
</script>

<template>
  <section
    v-if="selectedFile && evidence.report"
    class="ci-city-findings"
  >
    <h4 class="ci-city-findings__title">
      {{ CITY_FINDINGS_TITLE }}
    </h4>
    <ul class="ci-city-findings__list">
      <li
        v-for="f in shown"
        :key="f.fingerprint"
        class="ci-city-findings__row"
      >
        <span class="ci-city-findings__text">{{ CITY_FINDINGS_ROW(FINDING_KIND_LABEL[f.kind], RULE_TEXT(f.rule), f.line) }}</span>
        <span
          v-if="!f.anchored"
          class="ci-city-findings__via"
        >{{ FINDING_VIA_RELATED(f.anchorPath) }}</span>
        <button
          type="button"
          class="ci-city-findings__investigate"
          :aria-label="INVESTIGATE_FINDING_LABEL(f.id, f.anchorPath)"
          @click="openInvestigation(f.fingerprint)"
        >
          {{ INVESTIGATE_ACTION }}
        </button>
      </li>
    </ul>
    <p
      v-if="hiddenCount > 0"
      class="ci-note"
    >
      {{ CITY_FINDINGS_MORE(hiddenCount) }}
    </p>
  </section>
</template>
