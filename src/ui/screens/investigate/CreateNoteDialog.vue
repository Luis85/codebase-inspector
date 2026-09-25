<!--
  WP-04 IN26-IN29 (O4, O7; IP9, IP24, IP26): the create dialog. The folder and the base
  name (`.md` shown as a suffix) are both editable and re-planned through the port's
  synchronous, write-free `plan()` on every edit; the final vault path, a rename, and the
  in-root overlap (with its exclusion checkbox, checked) show BEFORE confirm. Nothing is
  written until Create. Create is aria-disabled with a guarded handler while the plan is not
  ok or a write is in flight (E40), and the busy/error scaffold is use-busy-action (IPF9).
  Task 9's carry: `create` re-plans and refuses a name other than the one it plans, so the
  request carries the PLANNED folder and file name (without `.md`), never the typed text.
  A refusal stays in this dialog's own role="alert" line and re-plans, so a name taken
  meanwhile shows its next free name (IN27: nothing is retried silently).
-->
<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import type { NoteIdentity } from '../../../application/investigation/note-model';
import type { CreateNoteResult, DestinationPlan } from '../../../application/ports/investigation-notes-port';
import { useInvestigationStore } from '../../stores/investigation-store';
import { useBusyAction } from '../../kit/use-busy-action';
import { useUniqueId } from '../../unique-id';
import {
  NOTE_CREATE_CANCEL, NOTE_CREATE_CONFIRM, NOTE_CREATE_EXCLUDE, NOTE_CREATE_FOLDER, NOTE_CREATE_FOLDER_IS_FILE, NOTE_CREATE_NAME,
  NOTE_CREATE_NO_FREE_NAME, NOTE_CREATE_OVERLAP, NOTE_CREATE_PATH, NOTE_CREATE_REFUSED, NOTE_CREATE_RENAMED, NOTE_CREATE_ROOT_IS_FOLDER,
  NOTE_CREATE_SUFFIX, NOTE_CREATE_TITLE, NOTE_NAME_PROBLEM, NOTES_FOLDER_PROBLEM, NOTES_FOLDER_ROW_FAILED,
} from '../../audit-copy/investigation';
import CiDialog from '../../kit/Dialog.vue';

type CreatedNote = Extract<CreateNoteResult, { status: 'created' }>;
type ReadyPlan = Extract<DestinationPlan, { status: 'ok' }>;

const props = defineProps<{ defaultFolder: string; defaultName: string; rootPath: string | null; identity: NoteIdentity; body: string }>();
const emit = defineEmits<{ close: []; created: [result: CreatedNote] }>();
const investigation = useInvestigationStore();
const { busy, error, requestClose: requestCloseWith, run } = useBusyAction();
const folderId = useUniqueId('ci-create-note-folder');
const nameId = useUniqueId('ci-create-note-name');
const planId = useUniqueId('ci-create-note-plan');

const folder = ref(props.defaultFolder);
const name = ref(props.defaultName);
const exclude = ref(true);
/** True once the user typed a folder: a destination re-read never overwrites their text. */
const folderEdited = ref(false);
/** Bumped after a refusal so the plan is read again (the vault changed under it). */
const revision = ref(0);

const plan = computed<DestinationPlan | null>(() => {
  void revision.value;
  return investigation.plan(folder.value, name.value, props.rootPath);
});
const ready = computed<ReadyPlan | null>(() => {
  const p = plan.value;
  return p !== null && p.status === 'ok' ? p : null;
});
const problem = computed<string | null>(() => {
  const p = plan.value;
  if (p === null) return null;
  switch (p.status) {
    case 'ok': return null;
    case 'invalid-folder': return NOTES_FOLDER_PROBLEM[p.problem];
    case 'invalid-name': return NOTE_NAME_PROBLEM[p.problem];
    case 'folder-is-file': return NOTE_CREATE_FOLDER_IS_FILE;
    case 'no-free-name': return NOTE_CREATE_NO_FREE_NAME;
    default: {
      const never: never = p;
      throw new Error(`unhandled plan: ${JSON.stringify(never)}`);
    }
  }
});
/** IP26: the checkbox only for a folder strictly inside the root; the root itself gets none. */
const showExclude = computed(() => ready.value !== null && ready.value.overlapsRoot && ready.value.rootRelativeFolder !== null);
const rootIsFolder = computed(() => ready.value !== null && ready.value.overlapsRoot && ready.value.rootRelativeFolder === null);
const blocked = computed(() => busy.value || ready.value === null);

// IN26: the checkbox is checked whenever it (re)appears.
watch(showExclude, (shown) => { if (shown) exclude.value = true; });
// A stale refusal never lingers onto edited input.
watch([folder, name], () => { error.value = ''; });
// Task 10's carry: the folder setting may have changed in Obsidian's settings since bind.
watch(() => props.defaultFolder, (next) => { if (!folderEdited.value) folder.value = next; });
onMounted(() => { void investigation.loadDestination(); });

function requestClose(): void {
  requestCloseWith(() => emit('close'));
}

function confirm(): Promise<void> {
  const p = ready.value;
  if (blocked.value || p === null) return Promise.resolve();
  return run(async () => {
    const result = await investigation.create({
      identity: props.identity, folder: p.folder, baseName: p.fileName.slice(0, -NOTE_CREATE_SUFFIX.length), body: props.body,
      excludeFolder: showExclude.value && exclude.value, rootPath: props.rootPath,
    });
    if (result !== null && result.status === 'created') {
      emit('created', result);
      return;
    }
    error.value = NOTE_CREATE_REFUSED[result === null ? 'write-failed' : result.reason];
    revision.value += 1;
  }, NOTE_CREATE_REFUSED['write-failed']);
}
</script>

<template>
  <CiDialog
    :label="NOTE_CREATE_TITLE"
    @close="requestClose"
  >
    <div class="ci-create-note">
      <h3>{{ NOTE_CREATE_TITLE }}</h3>
      <p
        v-if="investigation.destinationFailed"
        class="ci-create-note__destination-failed"
      >
        {{ NOTES_FOLDER_ROW_FAILED }}
      </p>
      <label
        :for="folderId"
        class="ci-create-note__label"
      >{{ NOTE_CREATE_FOLDER }}</label>
      <input
        :id="folderId"
        v-model="folder"
        class="ci-create-note__folder"
        type="text"
        :aria-invalid="plan?.status === 'invalid-folder' || plan?.status === 'folder-is-file' ? 'true' : undefined"
        :aria-describedby="planId"
        @input="folderEdited = true"
      >
      <label
        :for="nameId"
        class="ci-create-note__label"
      >{{ NOTE_CREATE_NAME }}</label>
      <div class="ci-create-note__name-row">
        <input
          :id="nameId"
          v-model="name"
          class="ci-create-note__name"
          type="text"
          :aria-invalid="plan?.status === 'invalid-name' || plan?.status === 'no-free-name' ? 'true' : undefined"
          :aria-describedby="planId"
        >
        <span class="ci-create-note__suffix">{{ NOTE_CREATE_SUFFIX }}</span>
      </div>
      <div
        :id="planId"
        class="ci-create-note__plan"
      >
        <p
          v-if="problem"
          class="ci-create-note__problem"
        >
          {{ problem }}
        </p>
        <template v-else-if="ready">
          <p class="ci-create-note__path-label">
            {{ NOTE_CREATE_PATH }}
          </p>
          <p class="ci-create-note__path">
            <code>{{ ready.path }}</code>
          </p>
          <p
            v-if="ready.renamed"
            class="ci-create-note__renamed"
          >
            {{ NOTE_CREATE_RENAMED(ready.fileName) }}
          </p>
          <p
            v-if="showExclude"
            class="ci-create-note__overlap"
          >
            {{ NOTE_CREATE_OVERLAP }}
          </p>
          <p
            v-if="rootIsFolder"
            class="ci-create-note__root"
          >
            {{ NOTE_CREATE_ROOT_IS_FOLDER }}
          </p>
        </template>
      </div>
      <label
        v-if="showExclude"
        class="ci-create-note__exclude"
      >
        <input
          v-model="exclude"
          type="checkbox"
        >
        {{ NOTE_CREATE_EXCLUDE }}
      </label>
      <p
        v-if="error"
        class="ci-create-note__error"
        role="alert"
      >
        {{ error }}
      </p>
      <div class="ci-create-note__actions">
        <button
          type="button"
          class="ci-create-note__cancel"
          :aria-disabled="busy ? 'true' : undefined"
          @click="requestClose"
        >
          {{ NOTE_CREATE_CANCEL }}
        </button>
        <button
          type="button"
          class="mod-cta ci-create-note__confirm"
          :aria-disabled="blocked ? 'true' : undefined"
          @click="confirm"
        >
          {{ NOTE_CREATE_CONFIRM }}
        </button>
      </div>
    </div>
  </CiDialog>
</template>
