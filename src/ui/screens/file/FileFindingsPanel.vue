<script setup lang="ts">
import { formatMetric, type MetricValue } from '../../evidence';
import type { FileFinding } from '../../read-models/file-detail';
import type { QualityFinding } from '../../read-models/findings';
import {
  FILE_FINDINGS_CAVEAT, FILE_FINDINGS_CAVEAT_TITLE, FILE_FINDINGS_SUBTITLE, FILE_FINDINGS_TITLE, FILE_NO_FINDINGS,
  FINDING_META, FINDING_STATUS_LABEL, SEVERITY_LABEL,
} from '../../inspector-copy';
import Panel from '../../kit/Panel.vue';
import Callout from '../../kit/Callout.vue';
import ProvenanceBadge from '../../kit/ProvenanceBadge.vue';

defineProps<{ findings: readonly FileFinding[]; count: MetricValue; statuses: ReadonlyMap<string, QualityFinding> }>();
const emit = defineEmits<{ review: [fingerprint: string] }>();
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
        class="ci-finding"
      >
        <!-- E20: a <button> holds phrasing content only, so every block is a <span>. -->
        <button
          type="button"
          class="ci-finding__review"
          @click="emit('review', f.fingerprint)"
        >
          <span class="ci-finding__head">
            <span
              class="ci-finding__severity"
              :class="`ci-finding__severity--${f.severity}`"
            >{{ SEVERITY_LABEL[f.severity] }}</span>
            <span
              class="ci-chip"
              :class="`ci-chip--status-${statuses.get(f.fingerprint)?.status ?? 'open'}`"
            >{{ FINDING_STATUS_LABEL[statuses.get(f.fingerprint)?.status ?? 'open'] }}</span>
            <code class="ci-finding__id">{{ f.id }}</code>
          </span>
          <span class="ci-finding__title">{{ f.title }}</span>
          <span class="ci-finding__meta">
            {{ FINDING_META(f.line) }}
            <ProvenanceBadge state="sample" />
          </span>
        </button>
      </li>
    </ul>
    <p
      v-else
      class="ci-hotspots__note"
    >
      {{ FILE_NO_FINDINGS }}
    </p>
    <Callout :title="FILE_FINDINGS_CAVEAT_TITLE">
      {{ FILE_FINDINGS_CAVEAT }}
    </Callout>
  </Panel>
</template>
