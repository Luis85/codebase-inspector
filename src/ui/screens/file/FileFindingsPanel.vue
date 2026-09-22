<script setup lang="ts">
import { formatMetric, type MetricValue } from '../../evidence';
import type { FileFinding } from '../../read-models/file-detail';
import type { FindingStatus, QualityFinding } from '../../read-models/findings';
import {
  FILE_FINDINGS_CAVEAT, FILE_FINDINGS_CAVEAT_TITLE, FILE_FINDINGS_SUBTITLE, FILE_FINDINGS_TITLE, FILE_NO_FINDINGS,
  FINDING_META, FINDING_STATUS_LABEL, SEVERITY_LABEL,
} from '../../inspector-copy';
import Panel from '../../kit/Panel.vue';
import Callout from '../../kit/Callout.vue';
import ProvenanceBadge from '../../kit/ProvenanceBadge.vue';

const props = defineProps<{ findings: readonly FileFinding[]; count: MetricValue; statuses: ReadonlyMap<string, QualityFinding> }>();
const emit = defineEmits<{ review: [fingerprint: string] }>();
/** A finding without a decision is open. */
const statusOf = (fingerprint: string): FindingStatus => props.statuses.get(fingerprint)?.status ?? 'open';
</script>

<template>
  <Panel
    :title="FILE_FINDINGS_TITLE"
    :subtitle="FILE_FINDINGS_SUBTITLE(formatMetric(count))"
  >
    <ul
      v-if="findings.length"
      class="ci-findings"
    >
      <li
        v-for="f in findings"
        :key="f.fingerprint"
        class="ci-file-finding"
      >
        <!-- E20: a <button> holds phrasing content only, so every block is a <span>. -->
        <button
          type="button"
          class="ci-file-finding__review"
          @click="emit('review', f.fingerprint)"
        >
          <span class="ci-file-finding__head">
            <span
              class="ci-severity"
              :class="`ci-severity--${f.severity}`"
            >{{ SEVERITY_LABEL[f.severity] }}</span>
            <span
              class="ci-chip"
              :class="`ci-chip--status-${statusOf(f.fingerprint)}`"
            >{{ FINDING_STATUS_LABEL[statusOf(f.fingerprint)] }}</span>
            <code class="ci-ref-id">{{ f.id }}</code>
          </span>
          <span class="ci-file-finding__title">{{ f.title }}</span>
          <span class="ci-file-finding__meta">
            {{ FINDING_META(f.line) }}
            <ProvenanceBadge state="sample" />
          </span>
        </button>
      </li>
    </ul>
    <p
      v-else
      class="ci-note"
    >
      {{ FILE_NO_FINDINGS }}
    </p>
    <Callout :title="FILE_FINDINGS_CAVEAT_TITLE">
      {{ FILE_FINDINGS_CAVEAT }}
    </Callout>
  </Panel>
</template>
