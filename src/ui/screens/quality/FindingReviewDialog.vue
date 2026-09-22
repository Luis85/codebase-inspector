<script setup lang="ts">
import { computed, nextTick, ref } from 'vue';
import type { EntityId } from '../../../domain/entity-id';
import { useReadModels } from '../../read-models/use-read-models';
import { useReviewStore } from '../../stores/review-store';
import { DISMISS_REASON_MAX } from '../../stores/ports/review-repository';
import { useUniqueId } from '../../unique-id';
import {
  DIALOG_CLOSE, FINDING_ACKNOWLEDGE, FINDING_ACKNOWLEDGED, FINDING_ADD_WORK_ITEM, FINDING_DECISION_FAILED, FINDING_DIALOG_CONFIDENCE,
  FINDING_DIALOG_CONFIDENCE_VALUE, FINDING_DIALOG_LOCATION, FINDING_DIALOG_PROVIDER, FINDING_DIALOG_PROVIDER_VALUE,
  FINDING_DIALOG_REASON, FINDING_DIALOG_TITLE, FINDING_DISMISS, FINDING_DISMISS_CANCEL, FINDING_DISMISS_HINT,
  FINDING_DISMISS_PLACEHOLDER, FINDING_DISMISS_REASON, FINDING_DISMISS_REQUIRED, FINDING_DISMISS_SAVE, FINDING_DISMISS_TITLE,
  FINDING_DISMISS_TOO_LONG, FINDING_DISMISSED, FINDING_IN_PLAN, FINDING_OPEN_FILE, FINDING_REOPEN, FINDING_REOPENED,
  FINDING_STATUS_LABEL, QUALITY_LOCATION, SEVERITY_LABEL, WORK_ITEM_TITLE,
} from '../../inspector-copy';
import CiDialog from '../../kit/Dialog.vue';
import ProvenanceBadge from '../../kit/ProvenanceBadge.vue';

const props = defineProps<{ fingerprint: string }>();
const emit = defineEmits<{ close: []; openFile: [id: EntityId]; announce: [message: string] }>();
const { quality } = useReadModels();
const review = useReviewStore();
const base = useUniqueId('ci-finding-dialog');
/** Looked up live, so the status chip follows every decision while the dialog is open. */
const finding = computed(() => quality.value.byFingerprint.get(props.fingerprint) ?? null);
const dismissing = ref(false);
const reason = ref('');
const error = ref('');
const reasonField = ref<HTMLTextAreaElement | null>(null);
const toggleButton = ref<HTMLButtonElement | null>(null);
const busy = computed(() => review.isDispositionPending(props.fingerprint));

/** Records a decision only; no repository suppression is ever written (Q3). E17: the
 *  outcome is announced only when the store actually did something — a refusal
 *  (`null`, or `false` from reopen) announces nothing and is not an error either.
 *  Resolves true when the action took effect. */
async function run(action: () => Promise<unknown>, done: string): Promise<boolean> {
  error.value = '';
  try {
    const result = await action();
    if (result === null || result === false) return false;
    emit('announce', done);
    return true;
  } catch {
    error.value = FINDING_DECISION_FAILED;
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
  if (!f || busy.value) return;
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
  if (busy.value) return;
  const trimmed = reason.value.trim();
  if (trimmed === '') { error.value = FINDING_DISMISS_REQUIRED; return; }
  if (trimmed.length > DISMISS_REASON_MAX) { error.value = FINDING_DISMISS_TOO_LONG(DISMISS_REASON_MAX); return; }
  if (await run(() => review.dismiss(props.fingerprint, trimmed, new Date()), FINDING_DISMISSED)) await closeDismissal();
}
/** Final review I2 (E40): pressed while focused, so `aria-disabled` + this guard, never
 *  `disabled`, which would drop focus out of the modal. */
const workItemBlocked = computed(() => {
  const f = finding.value;
  return !f || review.hasWorkItemFor(f.file.id) || review.isPendingFor(f.file.id);
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
    @close="emit('close')"
  >
    <div class="ci-finding-dialog">
      <h3 class="ci-finding-dialog__title">
        {{ FINDING_DIALOG_TITLE }}
        <code class="ci-finding__id">{{ finding.id }}</code>
      </h3>
      <p class="ci-finding-dialog__chips">
        <span
          class="ci-finding__severity"
          :class="`ci-finding__severity--${finding.severity}`"
        >{{ SEVERITY_LABEL[finding.severity] }}</span>
        <span
          class="ci-chip"
          :class="`ci-chip--status-${finding.status}`"
        >{{ FINDING_STATUS_LABEL[finding.status] }}</span>
        <ProvenanceBadge state="sample" />
      </p>
      <p class="ci-finding-dialog__summary">
        {{ finding.title }}
      </p>
      <dl class="ci-finding-dialog__meta">
        <dt>{{ FINDING_DIALOG_LOCATION }}</dt>
        <dd>{{ finding.file.path }} · {{ QUALITY_LOCATION(finding.line, finding.moduleLabel) }}</dd>
        <dt>{{ FINDING_DIALOG_PROVIDER }}</dt>
        <dd>{{ FINDING_DIALOG_PROVIDER_VALUE }}</dd>
        <dt>{{ FINDING_DIALOG_CONFIDENCE }}</dt>
        <dd>{{ FINDING_DIALOG_CONFIDENCE_VALUE }}</dd>
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
          @click="addWorkItem"
        >
          {{ review.hasWorkItemFor(finding.file.id) ? FINDING_IN_PLAN : FINDING_ADD_WORK_ITEM }}
        </button>
      </div>
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
            :aria-disabled="busy"
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
          :aria-disabled="busy"
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
