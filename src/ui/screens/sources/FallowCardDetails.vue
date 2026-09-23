<script setup lang="ts">
// Part 6 Y31/Y37: the fallow card's state, diagnostics and actions. The card runs nothing:
// Import opens the S14 dialog, and Remove asks SourcesScreen to confirm first. Both stay
// focusable when blocked (aria-disabled plus a guarded handler, E40).
import { computed } from 'vue';
import { formatAbsoluteTime } from '../../copy';
import { evidenceBadgeOf, staleCauseOf, type EvidenceIndex } from '../../read-models/evidence-index';
import { unmatchedOf } from '../../read-models/fallow-candidate';
import { useUniqueId } from '../../unique-id';
import { FALLOW_CARD_NONE, FALLOW_IMPORT_ACTION, FALLOW_IMPORT_HINT, FALLOW_REMOVE, FALLOW_STALE_NOTICE } from '../../inspector-copy';
import EvidenceBadge from '../../kit/EvidenceBadge.vue';
import FallowReportFacts from './FallowReportFacts.vue';

const props = defineProps<{ index: EvidenceIndex; hasSnapshot: boolean }>();
const emit = defineEmits<{ import: []; remove: [] }>();
const hintId = useUniqueId('ci-fallow-card-hint');
const report = computed(() => props.index.report);
const stale = computed(() => props.index.state === 'stale');
const unmatched = computed(() => (report.value ? unmatchedOf(props.index.unmatchedPaths, report.value) : []));
const staleNotice = computed(() => (report.value && stale.value
  ? FALLOW_STALE_NOTICE(formatAbsoluteTime(report.value.importedAt, Intl), staleCauseOf(report.value)) : ''));

/** Blocked without a snapshot: report paths are matched to the codebase on screen. */
function importReport(): void {
  if (props.hasSnapshot) emit('import');
}
/** Y31: aria-disabled while there is nothing to remove, and the press is refused then. */
function remove(): void {
  if (report.value) emit('remove');
}
</script>

<template>
  <div class="ci-fallow-card">
    <template v-if="report">
      <EvidenceBadge v-bind="evidenceBadgeOf(report, stale)" />
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
    <div class="ci-fallow-card__actions">
      <button
        type="button"
        class="ci-fallow-card__import"
        :aria-disabled="hasSnapshot ? undefined : 'true'"
        :aria-describedby="hasSnapshot ? undefined : hintId"
        @click="importReport"
      >
        {{ FALLOW_IMPORT_ACTION }}
      </button>
      <button
        type="button"
        class="ci-fallow-card__remove"
        :aria-disabled="report ? undefined : 'true'"
        @click="remove"
      >
        {{ FALLOW_REMOVE }}
      </button>
    </div>
  </div>
</template>
