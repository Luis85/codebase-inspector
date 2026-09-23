<script setup lang="ts">
// Part 6 Y36: three states, never confused: Not analysed (no report attached), analysed with
// no finding for this file (not the same as zero complexity, S15), and the reported
// findings. The EvidenceBadge heads the panel whenever a report is attached.
import { formatMetric, type MetricValue } from '../../evidence';
import type { EvidenceIndexState } from '../../read-models/evidence-index';
import type { FileFinding } from '../../read-models/file-detail';
import { severityTone, type FindingStatus, type QualityFinding } from '../../read-models/findings';
import {
  FILE_FINDINGS_CAVEAT, FILE_FINDINGS_CAVEAT_TITLE, FILE_FINDINGS_SUBTITLE, FILE_FINDINGS_TITLE, FILE_NO_FINDINGS_REPORTED,
  FINDING_META, FINDING_STATUS_LABEL, SEVERITY_TEXT,
} from '../../inspector-copy';
import Panel from '../../kit/Panel.vue';
import Callout from '../../kit/Callout.vue';
import EvidenceBadge from '../../kit/EvidenceBadge.vue';
import NotAnalysed from '../../kit/NotAnalysed.vue';

const props = defineProps<{
  findings: readonly FileFinding[]; count: MetricValue; statuses: ReadonlyMap<string, QualityFinding>;
  evidence: EvidenceIndexState; version: string;
}>();
const emit = defineEmits<{ review: [fingerprint: string]; import: [] }>();
/** A finding without a decision is open. */
const statusOf = (fingerprint: string): FindingStatus => props.statuses.get(fingerprint)?.status ?? 'open';
</script>

<template>
  <Panel
    :title="FILE_FINDINGS_TITLE"
    :subtitle="evidence === 'none' ? undefined : FILE_FINDINGS_SUBTITLE(formatMetric(count))"
  >
    <template
      v-if="evidence !== 'none'"
      #actions
    >
      <EvidenceBadge
        :version="version"
        :state="evidence === 'stale' ? 'stale' : 'imported'"
      />
    </template>
    <NotAnalysed
      v-if="evidence === 'none'"
      @import="emit('import')"
    />
    <ul
      v-else-if="findings.length"
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
              :class="`ci-severity--${severityTone(f.severity)}`"
            >{{ SEVERITY_TEXT(f.severity) }}</span>
            <span
              class="ci-chip"
              :class="`ci-chip--status-${statusOf(f.fingerprint)}`"
            >{{ FINDING_STATUS_LABEL[statusOf(f.fingerprint)] }}</span>
            <code class="ci-ref-id">{{ f.id }}</code>
          </span>
          <span class="ci-file-finding__title">{{ f.title }}</span>
          <span class="ci-file-finding__meta">
            {{ FINDING_META(f.line, f.endLine, f.rule) }}
          </span>
        </button>
      </li>
    </ul>
    <p
      v-else
      class="ci-note ci-file-findings__none"
    >
      {{ FILE_NO_FINDINGS_REPORTED }}
    </p>
    <Callout :title="FILE_FINDINGS_CAVEAT_TITLE">
      {{ FILE_FINDINGS_CAVEAT }}
    </Callout>
  </Panel>
</template>
