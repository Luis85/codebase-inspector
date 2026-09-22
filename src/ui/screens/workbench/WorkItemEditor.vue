<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';
import type { FileSummary } from '../../read-models/file-summaries';
import { useReadModels } from '../../read-models/use-read-models';
import { filesById, workTargetLabel, WORK_STATUSES, type TargetLabel } from '../../read-models/work-items';
import { useReviewStore } from '../../stores/review-store';
import {
  WORK_NOTES_MAX, WORK_TITLE_MAX, workItemProblem,
  type WorkChecks, type WorkIntent, type WorkItemStatus, type WorkPriority,
} from '../../stores/ports/review-repository';
import { useUniqueId } from '../../unique-id';
import {
  WORK_CANCEL, WORK_CHECKLIST_HINT, WORK_CREATE, WORK_CREATED, WORK_DELETE,
  WORK_DELETE_CONFIRM, WORK_DELETE_CONFIRM_TEXT, WORK_DELETE_FAILED, WORK_DELETE_KEEP, WORK_DELETED, WORK_DUPLICATE,
  WORK_EDITOR_SUBTITLE, WORK_EDITOR_TITLE_EDIT, WORK_EDITOR_TITLE_NEW, WORK_FIELD_INTENT, WORK_FIELD_NOTES, WORK_FIELD_PRIORITY,
  WORK_FIELD_STATUS, WORK_FIELD_TARGET, WORK_FIELD_TITLE, WORK_INTENT_LABEL, WORK_ITEM_STATUS_LABEL, WORK_ITEM_TITLE,
  WORK_NOTES_TOO_LONG, WORK_PRIORITY_LABEL, WORK_SAVE, WORK_SAVE_FAILED, WORK_TARGET_MISSING, WORK_TITLE_REQUIRED,
  WORK_TITLE_TOO_LONG, WORK_UPDATED, WORK_VERIFIED_NEEDS_CHECKS,
} from '../../inspector-copy';
import CiDialog from '../../kit/Dialog.vue';
import WorkChecklist from './WorkChecklist.vue';

const props = defineProps<{ itemId: string | null; newFile: FileSummary | null }>();
const emit = defineEmits<{ close: []; done: [message: string] }>();

const PRIORITIES: readonly WorkPriority[] = ['high', 'medium', 'low'];
/** W11: a file can be planned for these intents here; review and pairing come from Dependencies, Security and Ownership. */
const FILE_INTENTS: readonly WorkIntent[] = ['refactor', 'tests', 'documentation'];
const PROBLEM_TEXT: Readonly<Record<NonNullable<ReturnType<typeof workItemProblem>>, string>> = {
  'title-empty': WORK_TITLE_REQUIRED,
  'title-long': WORK_TITLE_TOO_LONG(WORK_TITLE_MAX),
  'notes-long': WORK_NOTES_TOO_LONG(WORK_NOTES_MAX),
  unverified: WORK_VERIFIED_NEEDS_CHECKS,
};

const review = useReviewStore();
const { files } = useReadModels();
const base = useUniqueId('ci-work-editor');
const existing = computed(() => (props.itemId === null ? null : review.workItems.find((w) => w.id === props.itemId) ?? null));
const start = existing.value;

const title = ref(start?.title ?? (props.newFile ? WORK_ITEM_TITLE(props.newFile.name) : ''));
const priority = ref<WorkPriority>(start?.priority ?? 'medium');
const status = ref<WorkItemStatus>(start?.status ?? 'investigate');
const intent = ref<WorkIntent>('refactor');
const notes = ref(start?.notes ?? '');
const checks = ref<[boolean, boolean, boolean]>(start ? [start.checks[0], start.checks[1], start.checks[2]] : [false, false, false]);
const error = ref('');
const confirming = ref(false);
const deleteButton = ref<HTMLButtonElement | null>(null);
const confirmButton = ref<HTMLButtonElement | null>(null);
/** X6: `removeWorkItem` clears `existing` out from under the "item vanished" watcher
 *  below. Without this flag, that watcher would emit `close` while `confirmDelete` is
 *  still awaiting the removal, so `done(WORK_DELETED(id))` would be emitted on an
 *  already-unmounted component and dropped. Set true before the await; the watcher
 *  skips while it is set, and `confirmDelete` still emits `done` itself afterwards. */
const removing = ref(false);

// Final fix wave: create mode also tracks the pinned file's own pending save, so a
// double submit hits `save()`'s early `if (busy) return` instead of flashing WORK_DUPLICATE.
const busy = computed(() => (existing.value
  ? review.isItemPending(existing.value.id)
  : props.newFile !== null && review.isPending({ kind: 'file', entityId: props.newFile.id }, intent.value)));
const heading = computed(() => (existing.value ? WORK_EDITOR_TITLE_EDIT(existing.value.id) : WORK_EDITOR_TITLE_NEW));
const target = computed<TargetLabel | null>(() => {
  if (existing.value) return workTargetLabel(existing.value.target, filesById(files.value));
  return props.newFile ? { name: props.newFile.name, detail: props.newFile.path, present: true } : null;
});

// An item removed elsewhere while its editor is open: nothing is left to edit. Skipped
// while THIS editor is the one removing it (X6) — `confirmDelete` closes it itself.
watch(existing, (now) => { if (props.itemId !== null && now === null && !removing.value) emit('close'); });

function draftChecks(): WorkChecks {
  return [checks.value[0], checks.value[1], checks.value[2]];
}

/** Fix round 1 (Minor 5): clears the error THEN sets it after a tick, so a second,
 *  identical refusal (e.g. submitting `verified` with the same unchecked boxes twice)
 *  still passes through an empty state — the `role="alert"` paragraph unmounts and
 *  remounts (`v-if="error"`) rather than silently keeping the same text, so it is
 *  re-announced rather than treated as unchanged. */
async function setError(message: string): Promise<void> {
  error.value = '';
  await nextTick();
  error.value = message;
}

/** W9: the same rule the store enforces, explained inline. E17: only a non-null result
 *  is announced; the screen announces it once the dialog has closed. */
async function save(): Promise<void> {
  if (busy.value) return;
  error.value = '';
  const draft = { title: title.value, notes: notes.value, status: status.value, checks: draftChecks() };
  const problem = workItemProblem(draft);
  if (problem) { await setError(PROBLEM_TEXT[problem]); return; }
  try {
    if (existing.value) {
      // Fix round 1 (Minor 3): a refused update (unknown/pending id — see review-store's
      // updateWorkItem) must not stay silent; workItemProblem already ruled the draft valid.
      const saved = await review.updateWorkItem(existing.value.id, { ...draft, priority: priority.value }, new Date());
      if (saved) { emit('done', WORK_UPDATED(saved.id)); return; }
      await setError(WORK_SAVE_FAILED);
      return;
    }
    if (!props.newFile) return;
    const fileTarget = { kind: 'file' as const, entityId: props.newFile.id };
    // A save merely in flight is `busy`, above; WORK_DUPLICATE names one that already exists.
    if (review.hasWorkItem(fileTarget, intent.value)) { await setError(WORK_DUPLICATE); return; }
    const created = await review.addWorkItem(fileTarget, intent.value, draft.title, new Date(), {
      priority: priority.value, notes: draft.notes, status: draft.status, checks: draft.checks,
    });
    if (created) { emit('done', WORK_CREATED(created.id)); return; }
    // Fix round 1 (Minor 6): `addWorkItem` also returns null when `workItemProblem`
    // refuses the item it built (title/notes length) — that is not a duplicate.
    await setError(review.hasWorkItem(fileTarget, intent.value) ? WORK_DUPLICATE : WORK_SAVE_FAILED);
  } catch {
    await setError(WORK_SAVE_FAILED);
  }
}

function askDelete(): void { confirming.value = true; void nextTick(() => confirmButton.value?.focus()); }
function keep(): void { confirming.value = false; void nextTick(() => deleteButton.value?.focus()); }
async function confirmDelete(): Promise<void> {
  const item = existing.value;
  if (!item || busy.value) return;
  removing.value = true;
  try {
    if (await review.removeWorkItem(item.id)) emit('done', WORK_DELETED(item.id));
  } catch {
    error.value = WORK_DELETE_FAILED;
  } finally {
    removing.value = false;
  }
}
</script>

<template>
  <CiDialog
    :label="heading"
    @close="emit('close')"
  >
    <form
      class="ci-work-editor"
      novalidate
      @submit.prevent="save"
    >
      <header class="ci-work-editor__header">
        <h3>{{ heading }}</h3>
        <p class="ci-note">
          {{ WORK_EDITOR_SUBTITLE }}
        </p>
      </header>
      <label :for="`${base}-title`">{{ WORK_FIELD_TITLE }}</label>
      <input
        :id="`${base}-title`"
        v-model="title"
        class="ci-work-editor__title"
        type="text"
        aria-required="true"
        :maxlength="WORK_TITLE_MAX"
      >
      <div class="ci-work-editor__grid">
        <div class="ci-work-editor__field">
          <label :for="`${base}-priority`">{{ WORK_FIELD_PRIORITY }}</label>
          <select
            :id="`${base}-priority`"
            v-model="priority"
            class="dropdown ci-work-editor__priority"
          >
            <option
              v-for="p in PRIORITIES"
              :key="p"
              :value="p"
            >
              {{ WORK_PRIORITY_LABEL[p] }}
            </option>
          </select>
        </div>
        <div class="ci-work-editor__field">
          <label :for="`${base}-status`">{{ WORK_FIELD_STATUS }}</label>
          <select
            :id="`${base}-status`"
            v-model="status"
            class="dropdown ci-work-editor__status"
          >
            <option
              v-for="s in WORK_STATUSES"
              :key="s"
              :value="s"
            >
              {{ WORK_ITEM_STATUS_LABEL[s] }}
            </option>
          </select>
        </div>
        <div
          v-if="!existing"
          class="ci-work-editor__field"
        >
          <label :for="`${base}-intent`">{{ WORK_FIELD_INTENT }}</label>
          <select
            :id="`${base}-intent`"
            v-model="intent"
            class="dropdown ci-work-editor__intent"
          >
            <option
              v-for="i in FILE_INTENTS"
              :key="i"
              :value="i"
            >
              {{ WORK_INTENT_LABEL[i] }}
            </option>
          </select>
        </div>
        <div class="ci-work-editor__field">
          <span class="ci-work-editor__label">{{ WORK_FIELD_TARGET }}</span>
          <span
            v-if="target"
            class="ci-work-editor__target"
          >
            {{ target.name }} <code>{{ target.detail }}</code>
            <span
              v-if="!target.present"
              class="ci-note"
            >{{ WORK_TARGET_MISSING }}</span>
          </span>
        </div>
      </div>
      <label :for="`${base}-notes`">{{ WORK_FIELD_NOTES }}</label>
      <textarea
        :id="`${base}-notes`"
        v-model="notes"
        class="ci-work-editor__notes"
        :maxlength="WORK_NOTES_MAX"
      />
      <WorkChecklist v-model="checks" />
      <p class="ci-note">
        {{ WORK_CHECKLIST_HINT }}
      </p>
      <p
        v-if="error"
        class="ci-work-editor__error"
        role="alert"
      >
        {{ error }}
      </p>
      <footer class="ci-work-editor__actions">
        <template v-if="confirming">
          <span
            :id="`${base}-confirm`"
            class="ci-work-editor__confirm-text"
          >{{ WORK_DELETE_CONFIRM_TEXT }}</span>
          <button
            ref="confirmButton"
            type="button"
            class="mod-warning ci-work-editor__confirm-delete"
            :aria-disabled="busy ? 'true' : undefined"
            :aria-describedby="`${base}-confirm`"
            @click="confirmDelete"
          >
            {{ WORK_DELETE_CONFIRM }}
          </button>
          <button
            type="button"
            class="ci-work-editor__keep"
            @click="keep"
          >
            {{ WORK_DELETE_KEEP }}
          </button>
        </template>
        <template v-else>
          <button
            v-if="existing"
            ref="deleteButton"
            type="button"
            class="mod-warning ci-work-editor__delete"
            @click="askDelete"
          >
            {{ WORK_DELETE }}
          </button>
          <span class="ci-work-editor__spacer" />
          <button
            type="button"
            class="ci-work-editor__cancel"
            @click="emit('close')"
          >
            {{ WORK_CANCEL }}
          </button>
          <button
            type="submit"
            class="mod-cta ci-work-editor__save"
            :aria-disabled="busy ? 'true' : undefined"
          >
            {{ existing ? WORK_SAVE : WORK_CREATE }}
          </button>
        </template>
      </footer>
    </form>
  </CiDialog>
</template>
