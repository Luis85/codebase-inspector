<script setup lang="ts">
import { formatMetric, type MetricValue } from '../../evidence';
import type { FileFinding } from '../../read-models/file-detail';
import {
  FILE_FINDINGS_CAVEAT, FILE_FINDINGS_CAVEAT_TITLE, FILE_FINDINGS_SUBTITLE, FILE_FINDINGS_TITLE, FILE_NO_FINDINGS,
  FINDING_META, SEVERITY_LABEL,
} from '../../inspector-copy';
import Panel from '../../kit/Panel.vue';
import Callout from '../../kit/Callout.vue';
import ProvenanceBadge from '../../kit/ProvenanceBadge.vue';

/** P13: rows are not interactive yet; the finding-review dialog arrives in Part 3. */
defineProps<{ findings: readonly FileFinding[]; count: MetricValue }>();
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
        :key="f.id"
        class="ci-finding"
      >
        <p class="ci-finding__head">
          <span
            class="ci-finding__severity"
            :class="`ci-finding__severity--${f.severity}`"
          >{{ SEVERITY_LABEL[f.severity] }}</span>
          <code class="ci-finding__id">{{ f.id }}</code>
        </p>
        <p class="ci-finding__title">
          {{ f.title }}
        </p>
        <p class="ci-finding__meta">
          {{ FINDING_META(f.line) }}
          <ProvenanceBadge state="sample" />
        </p>
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
