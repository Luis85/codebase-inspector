<!--
  WP-04 IN14/IN17: the selected finding's evidence bundle, laid out as a definition list —
  never a score, a percentage or an invented risk word. "Also involves" and the cycle path
  reuse Quality's own FindingRelatedRow, so the two screens read a cycle the same way.
  Add work item is aria-disabled with a guarded handler (E40) once the file already has a
  refactor item (Q4's one-item-per-file rule).
-->
<script setup lang="ts">
import { computed } from 'vue';
import type { EvidenceBundle } from '../../read-models/investigation-evidence';
import type { InvestigationRow } from '../../read-models/investigation';
import { STRUCTURE_CATEGORIES } from '../../read-models/findings';
import { useReadModels } from '../../read-models/use-read-models';
import { useReviewStore } from '../../stores/review-store';
import { formatAbsoluteTime } from '../../copy';
import {
  FINDING_ADD_WORK_ITEM, FINDING_DIALOG_LOCATION, FINDING_DIALOG_PROVIDER, FINDING_DIALOG_REASON, FINDING_IN_PLAN,
  FINDING_OPEN_FILE, FINDING_STATUS_LABEL, FINDING_DIALOG_TITLE, RELATIONS_SCOPE_NOTE, WORK_ITEM_STATUS_LABEL,
} from '../../inspector-copy';
import {
  INVESTIGATE_EVIDENCE_TITLE, INVESTIGATE_ORIGIN_TEXT, INVESTIGATE_PROVIDER_TEXT, INVESTIGATE_ROW_ANALYSED, INVESTIGATE_ROW_DISPOSITION,
  INVESTIGATE_ROW_ORIGIN, INVESTIGATE_ROW_SNAPSHOT, INVESTIGATE_ROW_STATE, INVESTIGATE_ROW_WORK_ITEMS, INVESTIGATE_WORK_ITEM_LINE,
  NOTE_EVIDENCE_STATE_TEXT, NOTE_VOCABULARY,
} from '../../audit-copy/investigation';
import Panel from '../../kit/Panel.vue';
import ProvenanceBadge from '../../kit/ProvenanceBadge.vue';
import FindingRelatedRow from '../quality/FindingRelatedRow.vue';

const props = defineProps<{ row: InvestigationRow; bundle: EvidenceBundle }>();
const emit = defineEmits<{ review: []; openFile: []; addWorkItem: [] }>();

const labels = NOTE_VOCABULARY.labels;
const { investigation } = useReadModels();
const review = useReviewStore();

const isStructure = computed(() => STRUCTURE_CATEGORIES.includes(props.row.kind));
const providerText = computed(() => INVESTIGATE_PROVIDER_TEXT(props.bundle.provider, investigation.value.evidence.report?.providerVersion ?? ''));
const workItems = computed(() => review.workItemsForFile(props.row.file.id));
const workBlocked = computed(() => review.hasWorkItemFor(props.row.file.id));

function guardedAddWorkItem(): void {
  if (!workBlocked.value) emit('addWorkItem');
}
</script>

<template>
  <Panel :title="INVESTIGATE_EVIDENCE_TITLE">
    <p
      v-if="bundle.state === 'stale'"
      class="ci-evidence-panel__chips"
    >
      <ProvenanceBadge state="stale" />
    </p>
    <p class="ci-evidence-panel__summary">
      {{ row.title }}
    </p>
    <dl class="ci-evidence-panel__meta">
      <dt>{{ labels.finding }}</dt>
      <dd><code class="ci-ref-id">{{ row.id }}</code></dd>
      <dt>{{ labels.kind }}</dt>
      <dd>{{ bundle.kindLabel }}</dd>
      <dt>{{ labels.rule }}</dt>
      <dd>{{ bundle.ruleText }}</dd>
      <dt>{{ labels.detail }}</dt>
      <dd>{{ bundle.ruleDetail }}</dd>
      <dt>{{ labels.severity }}</dt>
      <dd>{{ bundle.severityText }}</dd>
      <dt>{{ FINDING_DIALOG_LOCATION }}</dt>
      <dd>{{ bundle.location }}</dd>
      <dt>{{ FINDING_DIALOG_PROVIDER }}</dt>
      <dd>{{ providerText }}</dd>
      <dt>{{ INVESTIGATE_ROW_ORIGIN }}</dt>
      <dd>{{ INVESTIGATE_ORIGIN_TEXT[bundle.origin] }}</dd>
      <dt>{{ INVESTIGATE_ROW_ANALYSED }}</dt>
      <dd>{{ formatAbsoluteTime(bundle.analysedAt, Intl) }}</dd>
      <dt>{{ INVESTIGATE_ROW_SNAPSHOT }}</dt>
      <dd>{{ bundle.snapshotId }}</dd>
      <dt>{{ INVESTIGATE_ROW_STATE }}</dt>
      <dd>{{ NOTE_EVIDENCE_STATE_TEXT[bundle.state] }}</dd>
      <dt>{{ INVESTIGATE_ROW_DISPOSITION }}</dt>
      <dd>{{ FINDING_STATUS_LABEL[row.status] }}</dd>
      <template v-if="row.reason">
        <dt>{{ FINDING_DIALOG_REASON }}</dt>
        <dd>{{ row.reason }}</dd>
      </template>
      <template v-if="workItems.length > 0">
        <dt>{{ INVESTIGATE_ROW_WORK_ITEMS }}</dt>
        <dd>
          <ul class="ci-evidence-panel__work-items">
            <li
              v-for="item in workItems"
              :key="item.id"
            >
              {{ INVESTIGATE_WORK_ITEM_LINE(item.title, WORK_ITEM_STATUS_LABEL[item.status]) }}
            </li>
          </ul>
        </dd>
      </template>
    </dl>
    <FindingRelatedRow
      :related="bundle.related"
      :unmatched="bundle.unmatchedRelated"
      :path-text="bundle.cyclePath"
    />
    <p
      v-if="isStructure"
      class="ci-note ci-evidence-panel__scope-note"
    >
      {{ RELATIONS_SCOPE_NOTE }}
    </p>
    <div class="ci-evidence-panel__actions">
      <button
        type="button"
        class="ci-evidence-panel__review"
        @click="emit('review')"
      >
        {{ FINDING_DIALOG_TITLE }}
      </button>
      <button
        type="button"
        class="ci-evidence-panel__open-file"
        @click="emit('openFile')"
      >
        {{ FINDING_OPEN_FILE }}
      </button>
      <button
        type="button"
        class="ci-evidence-panel__add-work-item"
        :aria-disabled="workBlocked ? 'true' : undefined"
        @click="guardedAddWorkItem"
      >
        {{ workBlocked ? FINDING_IN_PLAN : FINDING_ADD_WORK_ITEM }}
      </button>
    </div>
  </Panel>
</template>
