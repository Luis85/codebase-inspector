<script setup lang="ts">
import { computed } from 'vue';
import { formatMetric, hasValue, isSampleBacked, type MetricValue } from '../../evidence';
import type { FileSummary } from '../../read-models/file-summaries';
import { includedSections, type ReportMetric, type ReportModel, type ReportRule } from '../../read-models/report';
import type { WorkRow } from '../../read-models/work-items';
import type { ReportSection } from '../../stores/report-store';
import {
  REPORT_COL_BOUNDARY, REPORT_COL_COMMITS, REPORT_COL_COMPLEXITY, REPORT_COL_COVERAGE, REPORT_COL_FILE, REPORT_COL_PRIORITY,
  REPORT_COL_RATIONALE, REPORT_COL_RULE, REPORT_COL_STATUS, REPORT_HOTSPOTS_NOTE, REPORT_KICKER, REPORT_LIMITS,
  REPORT_LIMITS_TITLE, REPORT_NO_NOTE, REPORT_NO_PLAN, REPORT_NO_RULES, REPORT_NOTE_TITLE, REPORT_RULES_TITLE,
  REPORT_SAMPLE_BADGE, REPORT_SECTION_HEADING, REPORT_SECTION_LABEL, REPORT_SECURITY_NOTE, REPORT_SUMMARY_NOTE,
  WORK_ITEM_STATUS_LABEL, WORK_PRIORITY_LABEL, WORK_TARGET_MISSING,
} from '../../inspector-copy';
import type { TableColumn } from '../../kit/table-types';
import EvidenceTable from '../../kit/EvidenceTable.vue';
import ProvenanceBadge from '../../kit/ProvenanceBadge.vue';

const props = defineProps<{ model: ReportModel; sections: Readonly<Record<ReportSection, boolean>>; note: string }>();
const shown = computed(() => includedSections(props.sections));
const metricsOf = (section: ReportSection): readonly ReportMetric[] =>
  (section === 'summary' ? props.model.summary : section === 'architecture' ? props.model.architecture : props.model.security);
/** A value already `collected` can still partly rest on sample inputs (e.g. priority
 *  aggregates sample complexity/commits/coverage); both badges then show, never just one. */
const alsoSample = (v: MetricValue): boolean => v.state !== 'sample' && isSampleBacked(v);

/** Controller ruling review Task 11 fix #1: a package/module target has no file path —
 *  showing only `detail` ("Package"/"Module") loses which one. A file target keeps its
 *  path, plus the "not in this snapshot" marker when it no longer resolves. */
const planTargetText = (r: WorkRow): string => {
  if (r.item.target.kind !== 'file') return `${r.target.detail} ${r.target.name}`;
  return r.target.present ? r.target.detail : `${r.target.detail} · ${WORK_TARGET_MISSING}`;
};

const RULE_COLUMNS: readonly TableColumn<ReportRule>[] = [
  { key: 'id', label: REPORT_COL_RULE }, { key: 'boundary', label: REPORT_COL_BOUNDARY },
  { key: 'status', label: REPORT_COL_STATUS }, { key: 'rationale', label: REPORT_COL_RATIONALE },
];
const HOTSPOT_COLUMNS: readonly TableColumn<FileSummary>[] = [
  { key: 'file', label: REPORT_COL_FILE }, { key: 'priority', label: REPORT_COL_PRIORITY, numeric: true },
  { key: 'complexity', label: REPORT_COL_COMPLEXITY, numeric: true }, { key: 'commits', label: REPORT_COL_COMMITS, numeric: true },
  { key: 'coverage', label: REPORT_COL_COVERAGE, numeric: true },
];
</script>

<template>
  <article class="ci-report-paper">
    <div class="ci-report-paper__kicker">
      <span>{{ REPORT_KICKER }}</span>
      <span class="ci-chip ci-chip--sample">{{ REPORT_SAMPLE_BADGE }}</span>
    </div>
    <h3 class="ci-report-paper__title">
      {{ model.title }}
    </h3>
    <dl class="ci-report-paper__facts">
      <template
        v-for="f in model.facts"
        :key="f.label"
      >
        <dt>{{ f.label }}</dt>
        <dd>{{ f.value }}</dd>
      </template>
    </dl>
    <section
      v-for="(section, i) in shown"
      :key="section"
      class="ci-report-paper__section"
    >
      <h4 class="ci-report-paper__section-title">
        {{ REPORT_SECTION_HEADING(i + 1, REPORT_SECTION_LABEL[section]) }}
      </h4>
      <ul
        v-if="section === 'summary' || section === 'architecture' || section === 'security'"
        class="ci-report-paper__metrics"
      >
        <li
          v-for="m in metricsOf(section)"
          :key="m.label"
        >
          <span>{{ m.label }}</span>
          <strong>{{ formatMetric(m.value, m.unit) }}</strong>
          <ProvenanceBadge
            v-if="m.value.state !== 'collected'"
            :state="m.value.state"
          />
          <ProvenanceBadge
            v-if="alsoSample(m.value)"
            state="sample"
          />
          <span
            v-if="!hasValue(m.value) && m.value.reason"
            class="ci-note"
          >{{ m.value.reason }}</span>
        </li>
      </ul>
      <p
        v-if="section === 'summary'"
        class="ci-note"
      >
        {{ REPORT_SUMMARY_NOTE }}
      </p>
      <template v-if="section === 'architecture'">
        <h5 class="ci-report-paper__subtitle">
          {{ REPORT_RULES_TITLE }}
        </h5>
        <p
          v-if="model.rules.length === 0"
          class="ci-note"
        >
          {{ REPORT_NO_RULES }}
        </p>
        <EvidenceTable
          v-else
          :columns="RULE_COLUMNS"
          :rows="model.rules"
          :row-key="(r) => r.id"
          :caption="REPORT_RULES_TITLE"
          :interactive="false"
        >
          <template #cell-id="{ row }">
            <code>{{ row.id }}</code>
          </template>
          <template #cell-boundary="{ row }">
            {{ row.boundary }}
          </template>
          <template #cell-status="{ row }">
            {{ row.status }}
          </template>
          <template #cell-rationale="{ row }">
            {{ row.rationale }}
          </template>
        </EvidenceTable>
      </template>
      <template v-if="section === 'hotspots'">
        <EvidenceTable
          :columns="HOTSPOT_COLUMNS"
          :rows="model.hotspots"
          :row-key="(f) => f.id"
          :caption="REPORT_SECTION_LABEL.hotspots"
          :interactive="false"
        >
          <template #cell-file="{ row }">
            <span class="ci-file-cell">
              <span class="ci-file-cell__name">{{ row.name }}</span>
              <span class="ci-file-cell__path">{{ row.path }}</span>
            </span>
          </template>
          <template #cell-priority="{ row }">
            {{ formatMetric(row.priority) }}
            <ProvenanceBadge
              v-if="row.priority.state !== 'collected'"
              :state="row.priority.state"
            />
            <ProvenanceBadge
              v-if="alsoSample(row.priority)"
              state="sample"
            />
            <span
              v-if="!hasValue(row.priority) && row.priority.reason"
              class="ci-note"
            >{{ row.priority.reason }}</span>
          </template>
          <template #cell-complexity="{ row }">
            {{ formatMetric(row.complexity) }}
            <ProvenanceBadge
              v-if="row.complexity.state !== 'collected'"
              :state="row.complexity.state"
            />
            <ProvenanceBadge
              v-if="alsoSample(row.complexity)"
              state="sample"
            />
            <span
              v-if="!hasValue(row.complexity) && row.complexity.reason"
              class="ci-note"
            >{{ row.complexity.reason }}</span>
          </template>
          <template #cell-commits="{ row }">
            {{ formatMetric(row.commits90d) }}
            <ProvenanceBadge
              v-if="row.commits90d.state !== 'collected'"
              :state="row.commits90d.state"
            />
            <ProvenanceBadge
              v-if="alsoSample(row.commits90d)"
              state="sample"
            />
            <span
              v-if="!hasValue(row.commits90d) && row.commits90d.reason"
              class="ci-note"
            >{{ row.commits90d.reason }}</span>
          </template>
          <template #cell-coverage="{ row }">
            {{ formatMetric(row.branchCoverage, '%') }}
            <ProvenanceBadge
              v-if="row.branchCoverage.state !== 'collected'"
              :state="row.branchCoverage.state"
            />
            <ProvenanceBadge
              v-if="alsoSample(row.branchCoverage)"
              state="sample"
            />
            <span
              v-if="!hasValue(row.branchCoverage) && row.branchCoverage.reason"
              class="ci-note"
            >{{ row.branchCoverage.reason }}</span>
          </template>
        </EvidenceTable>
        <p class="ci-note">
          {{ REPORT_HOTSPOTS_NOTE }}
        </p>
      </template>
      <p
        v-if="section === 'security'"
        class="ci-note"
      >
        {{ REPORT_SECURITY_NOTE }}
      </p>
      <template v-if="section === 'plan'">
        <p
          v-if="model.plan.length === 0"
          class="ci-note"
        >
          {{ REPORT_NO_PLAN }}
        </p>
        <ul
          v-else
          class="ci-report-paper__plan"
        >
          <li
            v-for="r in model.plan"
            :key="r.item.id"
          >
            <strong>{{ r.item.title }}</strong>
            <span class="ci-chip">{{ WORK_ITEM_STATUS_LABEL[r.item.status] }}</span>
            <span class="ci-note">{{ r.item.id }} · {{ WORK_PRIORITY_LABEL[r.item.priority] }} · {{ planTargetText(r) }}</span>
          </li>
        </ul>
      </template>
    </section>
    <section class="ci-report-paper__section">
      <h4 class="ci-report-paper__section-title--fixed">
        {{ REPORT_NOTE_TITLE }}
      </h4>
      <p class="ci-report-paper__note">
        {{ note.trim() === '' ? REPORT_NO_NOTE : note }}
      </p>
    </section>
    <section class="ci-report-paper__section">
      <h4 class="ci-report-paper__section-title--fixed">
        {{ REPORT_LIMITS_TITLE }}
      </h4>
      <p>{{ REPORT_LIMITS }}</p>
    </section>
  </article>
</template>
