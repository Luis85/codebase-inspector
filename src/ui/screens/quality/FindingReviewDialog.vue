<script setup lang="ts">
import { computed, nextTick, ref } from 'vue';
import type { EntityId } from '../../../domain/entity-id';
import { formatAbsoluteTime } from '../../copy';
import { useReadModels } from '../../read-models/use-read-models';
import { evidenceBadgeFor } from '../../read-models/evidence-index';
import { originOf } from '../../read-models/fallow-candidate';
import { severityTone } from '../../read-models/findings';
import { reviewFailureText } from '../../read-models/review-failure';
import { useReviewStore } from '../../stores/review-store';
import { DISMISS_REASON_MAX } from '../../stores/ports/review-repository';
import { useUniqueId } from '../../unique-id';
import {
  DIALOG_CLOSE, FINDING_ACKNOWLEDGE, FINDING_ACKNOWLEDGED, FINDING_ADD_WORK_ITEM, FINDING_DECISION_FAILED,
  FINDING_DIALOG_LOCATION, FINDING_DIALOG_PROVIDER, FINDING_DIALOG_PROVIDER_VALUE, FINDING_DIALOG_REASON,
  FINDING_DIALOG_RULE, FINDING_DIALOG_RULE_VALUE, FINDING_DIALOG_TITLE, FINDING_DISMISS, FINDING_DISMISS_CANCEL, FINDING_DISMISS_HINT,
  FINDING_DISMISS_PLACEHOLDER, FINDING_DISMISS_REASON, FINDING_DISMISS_REQUIRED, FINDING_DISMISS_SAVE, FINDING_DISMISS_TITLE,
  FINDING_DISMISS_TOO_LONG, FINDING_DISMISSED, FINDING_IN_PLAN, FINDING_OPEN_FILE, FINDING_REOPEN, FINDING_REOPENED,
  FINDING_REVIEW_LOADING, FINDING_STATUS_LABEL, QUALITY_LOCATION, REVIEW_STORE_READ_FAILED, SEVERITY_TEXT, WORK_ITEM_TITLE,
} from '../../inspector-copy';
import CiDialog from '../../kit/Dialog.vue';
import EvidenceBadge from '../../kit/EvidenceBadge.vue';

const props = defineProps<{ fingerprint: string }>();
const emit = defineEmits<{ close: []; openFile: [id: EntityId] }>();
const { quality } = useReadModels();
/** Part 6 Y35: who reported the finding, and when. The badge says the source match is unverified. */
const provider = computed(() => {
  const r = quality.value.evidence.report;
  return r ? FINDING_DIALOG_PROVIDER_VALUE(r.providerVersion, formatAbsoluteTime(r.importedAt, Intl), originOf(r)) : '';
});
const review = useReviewStore();
const base = useUniqueId('ci-finding-dialog');
/** Looked up live, so the status chip follows every decision while the dialog is open. */
const finding = computed(() => quality.value.byFingerprint.get(props.fingerprint) ?? null);
const dismissing = ref(false);
const reason = ref('');
const error = ref('');
const status = ref('');
const reasonField = ref<HTMLTextAreaElement | null>(null);
const toggleButton = ref<HTMLButtonElement | null>(null);
const busy = computed(() => review.isDispositionPending(props.fingerprint));
/** Polish C-5a-M2 (Task 5b): until the bound codebase's review state is read, the store refuses
 *  every decision and add (E3, Y10). The controls say so instead of doing nothing: blocked
 *  (aria-disabled plus a guard, E40) and described by this hint. */
const notReady = computed(() => !review.ready);
const notReadyId = `${base}-not-ready`;
const notReadyText = computed(() => (review.loadFailed ? REVIEW_STORE_READ_FAILED : FINDING_REVIEW_LOADING));
const decisionBlocked = computed(() => busy.value || notReady.value);

/** Records a decision only; no repository suppression is ever written (Q3). E17: the
 *  outcome is announced only when the store actually did something — a refusal
 *  (`null`, or `false` from reopen) announces nothing and is not an error either.
 *  Resolves true when the action took effect. The outcome is announced INSIDE the
 *  dialog (E55): a region outside an aria-modal dialog is hidden from assistive
 *  technology while the dialog is open. */
async function run(action: () => Promise<unknown>, done: string): Promise<boolean> {
  error.value = '';
  status.value = '';
  try {
    const result = await action();
    if (result === null || result === false) return false;
    status.value = done;
    return true;
  } catch (e) {
    error.value = reviewFailureText(e, FINDING_DECISION_FAILED);
    return false;
  }
}
/** Fix round 1: ONE button, patched in place as the status changes, so the focus a
 *  keyboard user put on it survives the decision (a v-if/v-else pair destroyed it and
 *  focus fell to <body>, outside CiDialog's Tab trap and Escape handler). It is never
 *  `disabled` while a save is pending either — disabling the focused element drops
 *  focus too — so it is `aria-disabled` and the handler ignores the press instead. */
async function toggleDecision(): Promise<void> {
  const f = finding.value;
  if (!f || decisionBlocked.value) return;
  if (f.status === 'open') await run(() => review.acknowledge(props.fingerprint, new Date()), FINDING_ACKNOWLEDGED);
  else await run(() => review.reopen(props.fingerprint), FINDING_REOPENED);
}

/** The dismissal form is about to go, taking the focused control with it: land on the
 *  decision toggle, which is always there once the form closes. */
async function closeDismissal(): Promise<void> {
  dismissing.value = false;
  reason.value = '';
  await nextTick();
  toggleButton.value?.focus();
}

async function startDismissal(): Promise<void> {
  error.value = '';
  dismissing.value = true;
  await nextTick();
  reasonField.value?.focus();
}
function cancelDismissal(): Promise<void> {
  error.value = '';
  return closeDismissal();
}
async function saveDismissal(): Promise<void> {
  if (decisionBlocked.value) return;
  const trimmed = reason.value.trim();
  if (trimmed === '') { error.value = FINDING_DISMISS_REQUIRED; return; }
  if (trimmed.length > DISMISS_REASON_MAX) { error.value = FINDING_DISMISS_TOO_LONG(DISMISS_REASON_MAX); return; }
  if (await run(() => review.dismiss(props.fingerprint, trimmed, new Date()), FINDING_DISMISSED)) await closeDismissal();
}
/** Final review I2 (E40): pressed while focused, so `aria-disabled` + this guard, never
 *  `disabled`, which would drop focus out of the modal. */
const workItemBlocked = computed(() => {
  const f = finding.value;
  return !f || notReady.value || review.hasWorkItemFor(f.file.id) || review.isPendingFor(f.file.id);
});
async function addWorkItem(): Promise<void> {
  const f = finding.value;
  if (f && !workItemBlocked.value) await run(() => review.addWorkItemForFile(f.file.id, WORK_ITEM_TITLE(f.file.name), new Date()), FINDING_IN_PLAN);
}
</script>

<template>
  <CiDialog
    v-if="finding"
    :label="FINDING_DIALOG_TITLE"
    :status="status"
    @close="emit('close')"
  >
    <div class="ci-finding-dialog">
      <h3 class="ci-finding-dialog__title">
        {{ FINDING_DIALOG_TITLE }}
        <code class="ci-ref-id">{{ finding.id }}</code>
      </h3>
      <p class="ci-finding-dialog__chips">
        <span
          class="ci-severity"
          :class="`ci-severity--${severityTone(finding.severity)}`"
        >{{ SEVERITY_TEXT(finding.severity) }}</span>
        <span
          class="ci-chip"
          :class="`ci-chip--status-${finding.status}`"
        >{{ FINDING_STATUS_LABEL[finding.status] }}</span>
        <EvidenceBadge
          v-if="quality.evidence.report"
          v-bind="evidenceBadgeFor(quality.evidence)!"
        />
      </p>
      <p class="ci-finding-dialog__summary">
        {{ finding.title }}
      </p>
      <dl class="ci-finding-dialog__meta">
        <dt>{{ FINDING_DIALOG_LOCATION }}</dt>
        <dd>{{ finding.file.path }} · {{ QUALITY_LOCATION(finding.line, finding.moduleLabel) }}</dd>
        <dt>{{ FINDING_DIALOG_PROVIDER }}</dt>
        <dd>{{ provider }}</dd>
        <dt>{{ FINDING_DIALOG_RULE }}</dt>
        <dd>{{ FINDING_DIALOG_RULE_VALUE(finding.rule, finding.detail) }}</dd>
        <template v-if="finding.reason">
          <dt>{{ FINDING_DIALOG_REASON }}</dt>
          <dd>{{ finding.reason }}</dd>
        </template>
      </dl>
      <div class="ci-finding-dialog__links">
        <button
          type="button"
          class="ci-finding-dialog__open-file"
          @click="emit('openFile', finding.file.id)"
        >
          {{ FINDING_OPEN_FILE }}
        </button>
        <button
          type="button"
          class="ci-finding-dialog__work-item"
          :aria-disabled="workItemBlocked"
          :aria-describedby="notReady ? notReadyId : undefined"
          @click="addWorkItem"
        >
          {{ review.hasWorkItemFor(finding.file.id) ? FINDING_IN_PLAN : FINDING_ADD_WORK_ITEM }}
        </button>
      </div>
      <p
        v-if="notReady"
        :id="notReadyId"
        class="ci-note ci-finding-dialog__not-ready"
      >
        {{ notReadyText }}
      </p>
      <form
        v-if="dismissing"
        class="ci-finding-dialog__dismissal"
        @submit.prevent="saveDismissal"
      >
        <h4 class="ci-finding-dialog__dismiss-title">
          {{ FINDING_DISMISS_TITLE }}
        </h4>
        <p class="ci-note">
          {{ FINDING_DISMISS_HINT }}
        </p>
        <label :for="`${base}-reason`">{{ FINDING_DISMISS_REASON }}</label>
        <textarea
          :id="`${base}-reason`"
          ref="reasonField"
          v-model="reason"
          rows="3"
          :maxlength="DISMISS_REASON_MAX"
          :placeholder="FINDING_DISMISS_PLACEHOLDER"
        />
        <div class="ci-finding-dialog__actions">
          <button
            type="button"
            class="ci-finding-dialog__cancel"
            :disabled="busy"
            @click="cancelDismissal"
          >
            {{ FINDING_DISMISS_CANCEL }}
          </button>
          <button
            type="submit"
            class="mod-cta ci-finding-dialog__save-dismissal"
            :aria-disabled="decisionBlocked"
            :aria-describedby="notReady ? notReadyId : undefined"
          >
            {{ FINDING_DISMISS_SAVE }}
          </button>
        </div>
      </form>
      <div
        v-else
        class="ci-finding-dialog__actions"
      >
        <button
          v-if="finding.status !== 'dismissed'"
          type="button"
          class="ci-finding-dialog__dismiss"
          :disabled="busy"
          @click="startDismissal"
        >
          {{ FINDING_DISMISS }}
        </button>
        <button
          ref="toggleButton"
          type="button"
          :class="finding.status === 'open' ? 'ci-finding-dialog__acknowledge' : 'ci-finding-dialog__reopen'"
          :aria-disabled="decisionBlocked"
          :aria-describedby="notReady ? notReadyId : undefined"
          @click="toggleDecision"
        >
          {{ finding.status === 'open' ? FINDING_ACKNOWLEDGE : FINDING_REOPEN }}
        </button>
        <button
          type="button"
          class="ci-finding-dialog__close"
          :disabled="busy"
          @click="emit('close')"
        >
          {{ DIALOG_CLOSE }}
        </button>
      </div>
      <p
        v-if="error"
        class="ci-finding-dialog__error"
        role="alert"
      >
        {{ error }}
      </p>
    </div>
  </CiDialog>
</template>
