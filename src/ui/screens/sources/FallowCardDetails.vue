<script setup lang="ts">
// Part 6 Y31/Y37, Part 7 Z32: the fallow card's state, diagnostics and actions, and its run
// half (FallowRunPanel). The card runs nothing: every press is reported to SourcesScreen.
// While a run is in flight, Import and Remove are blocked too: changing the evidence mid-run
// would supersede it (Z20). Blocked controls stay focusable (aria-disabled plus a guard, E40).
import { computed } from 'vue';
import { formatAbsoluteTime } from '../../copy';
import type { EvidenceIndex } from '../../read-models/evidence-index';
import { evidenceBadgeFor, staleCauseOf } from '../../read-models/evidence-index';
import { unmatchedOf } from '../../read-models/fallow-candidate';
import type { FallowRunErrorCode } from '../../read-models/fallow-run';
import { useAnalysisStore } from '../../stores/analysis-store';
import { useUniqueId } from '../../unique-id';
import {
  FALLOW_CARD_NONE, FALLOW_IMPORT_ACTION, FALLOW_IMPORT_HINT, FALLOW_REMOVE, FALLOW_RUN_BUSY_HINT, FALLOW_STALE_NOTICE,
} from '../../inspector-copy';
import EvidenceBadge from '../../kit/EvidenceBadge.vue';
import FallowReportFacts from './FallowReportFacts.vue';
import FallowRunPanel from './FallowRunPanel.vue';

const props = defineProps<{
  index: EvidenceIndex; hasSnapshot: boolean; refusal: { code: FallowRunErrorCode; detail: string } | null; failure: string;
}>();
const emit = defineEmits<{ import: []; remove: []; run: []; cancel: []; choose: []; forget: [] }>();
const analysis = useAnalysisStore();
const hintId = useUniqueId('ci-fallow-card-hint');
const busyId = useUniqueId('ci-fallow-card-busy');
const report = computed(() => props.index.report);
const stale = computed(() => props.index.state === 'stale');
const unmatched = computed(() => (report.value ? unmatchedOf(props.index.unmatchedPaths, report.value) : []));
const staleNotice = computed(() => (report.value && stale.value
  ? FALLOW_STALE_NOTICE(formatAbsoluteTime(report.value.importedAt, Intl), staleCauseOf(report.value)) : ''));
const importBlocked = computed(() => !props.hasSnapshot || analysis.active);
const removeBlocked = computed(() => report.value === null || analysis.active);

/** Blocked without a snapshot (paths are matched to the codebase on screen) or mid-run. */
function importReport(): void {
  if (!importBlocked.value) emit('import');
}
/** Y31: aria-disabled while there is nothing to remove, or mid-run. */
function remove(): void {
  if (!removeBlocked.value) emit('remove');
}
</script>

<template>
  <div class="ci-fallow-card">
    <template v-if="report">
      <EvidenceBadge v-bind="evidenceBadgeFor(index)!" />
      <p
        v-if="staleNotice"
        class="ci-note ci-fallow-card__stale"
      >
        {{ staleNotice }}
      </p>
      <FallowReportFacts
        :report="report"
        :matched-findings="index.matchedFindings"
        :matched-files="index.matchedFiles"
        :unmatched-paths="unmatched"
        show-imported-at
      />
    </template>
    <p
      v-else
      class="ci-note ci-fallow-card__none"
    >
      {{ FALLOW_CARD_NONE }}
    </p>
    <p
      v-if="!hasSnapshot"
      :id="hintId"
      class="ci-note ci-fallow-card__hint"
    >
      {{ FALLOW_IMPORT_HINT }}
    </p>
    <p
      v-if="analysis.active"
      :id="busyId"
      class="ci-note ci-fallow-card__busy"
    >
      {{ FALLOW_RUN_BUSY_HINT }}
    </p>
    <div class="ci-fallow-card__actions">
      <button
        type="button"
        class="ci-fallow-card__import"
        :aria-disabled="importBlocked ? 'true' : undefined"
        :aria-describedby="!hasSnapshot ? hintId : analysis.active ? busyId : undefined"
        @click="importReport"
      >
        {{ FALLOW_IMPORT_ACTION }}
      </button>
      <button
        type="button"
        class="ci-fallow-card__remove"
        :aria-disabled="removeBlocked ? 'true' : undefined"
        :aria-describedby="analysis.active ? busyId : undefined"
        @click="remove"
      >
        {{ FALLOW_REMOVE }}
      </button>
    </div>
    <FallowRunPanel
      :has-snapshot="hasSnapshot"
      :has-evidence="report !== null"
      :evidence-marked-failed="report?.staleReason === 'failed-run'"
      :busy-hint-id="busyId"
      :refusal="refusal"
      :failure="failure"
      @run="emit('run')"
      @cancel="emit('cancel')"
      @choose="emit('choose')"
      @forget="emit('forget')"
    />
  </div>
</template>
