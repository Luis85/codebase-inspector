<script setup lang="ts">
// Part 6 Y37/Y38: one report's facts, shared by the fallow card and the S14 review step.
// Every value from the report (file name, paths, section keys, warnings) is interpolated
// as text, never rendered as HTML (spec §4, Part 6 E34).
import { computed } from 'vue';
import { formatAbsoluteTime } from '../../copy';
import {
  FALLOW_CATEGORY_LINE, FALLOW_MATCHED, FALLOW_NONE, FALLOW_NOT_SHOWN_ITEM, FALLOW_REPORT_VALUE, FALLOW_ROW_CATEGORIES,
  FALLOW_ROW_FILE, FALLOW_ROW_IMPORTED, FALLOW_ROW_MATCHED, FALLOW_ROW_NOT_SHOWN, FALLOW_ROW_REPORT, FALLOW_ROW_UNMATCHED,
  FALLOW_ROW_WARNINGS, FALLOW_UNMATCHED_SUMMARY, FINDING_KIND_LABEL, fallowNotShownLabel,
} from '../../inspector-copy';
import { FINDING_CATEGORIES, UNMATCHED_SHOWN, type EvidenceReport } from '../../read-models/fallow-candidate';

const props = defineProps<{
  report: EvidenceReport; matchedFindings: number; matchedFiles: number; unmatchedPaths: readonly string[]; showImportedAt?: boolean;
  /** E46: labels beside values, for the wide S14 review step. The ~200px card stacks them. */
  wide?: boolean;
}>();
const importedAt = computed(() => formatAbsoluteTime(props.report.importedAt, Intl));
const categories = computed(() => FINDING_CATEGORIES.map((c) => FALLOW_CATEGORY_LINE(FINDING_KIND_LABEL[c], props.report.normalized.categories[c])));
const listed = computed(() => props.unmatchedPaths.slice(0, UNMATCHED_SHOWN));
/** Y25 (R4): fallow's own key, labelled here; an unknown key reads verbatim. */
const notShown = computed(() => props.report.normalized.notShown.map((s) => FALLOW_NOT_SHOWN_ITEM(fallowNotShownLabel(s.key), s.count)));
</script>

<template>
  <dl
    class="ci-fallow-facts"
    :class="{ 'ci-fallow-facts--wide': wide }"
  >
    <dt>{{ FALLOW_ROW_REPORT }}</dt>
    <dd>{{ FALLOW_REPORT_VALUE(report.providerVersion, report.reportKind, report.schemaVersion) }}</dd>
    <dt>{{ FALLOW_ROW_FILE }}</dt>
    <dd class="ci-fallow-facts__file">
      {{ report.fileName }}
    </dd>
    <template v-if="showImportedAt">
      <dt>{{ FALLOW_ROW_IMPORTED }}</dt>
      <dd>{{ importedAt }}</dd>
    </template>
    <dt>{{ FALLOW_ROW_CATEGORIES }}</dt>
    <dd class="ci-fallow-facts__categories">
      <ul class="ci-fallow-facts__list">
        <li
          v-for="line in categories"
          :key="line"
        >
          {{ line }}
        </li>
      </ul>
    </dd>
    <dt>{{ FALLOW_ROW_MATCHED }}</dt>
    <dd class="ci-fallow-facts__matched">
      {{ FALLOW_MATCHED(matchedFindings, matchedFiles) }}
    </dd>
    <dt>{{ FALLOW_ROW_UNMATCHED }}</dt>
    <dd class="ci-fallow-facts__unmatched">
      <template v-if="unmatchedPaths.length === 0">
        {{ FALLOW_NONE }}
      </template>
      <details v-else>
        <summary>{{ FALLOW_UNMATCHED_SUMMARY(unmatchedPaths.length, listed.length) }}</summary>
        <ul class="ci-fallow-facts__list">
          <li
            v-for="path in listed"
            :key="path"
          >
            <code>{{ path }}</code>
          </li>
        </ul>
      </details>
    </dd>
    <dt>{{ FALLOW_ROW_NOT_SHOWN }}</dt>
    <dd class="ci-fallow-facts__not-shown">
      <template v-if="notShown.length === 0">
        {{ FALLOW_NONE }}
      </template>
      <ul
        v-else
        class="ci-fallow-facts__list"
      >
        <li
          v-for="line in notShown"
          :key="line"
        >
          {{ line }}
        </li>
      </ul>
    </dd>
    <dt>{{ FALLOW_ROW_WARNINGS }}</dt>
    <dd class="ci-fallow-facts__warnings">
      <template v-if="report.normalized.warnings.length === 0">
        {{ FALLOW_NONE }}
      </template>
      <ul
        v-else
        class="ci-fallow-facts__list"
      >
        <li
          v-for="(warning, i) in report.normalized.warnings"
          :key="i"
        >
          {{ warning }}
        </li>
      </ul>
    </dd>
  </dl>
</template>
