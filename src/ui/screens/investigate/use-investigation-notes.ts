// WP-04 Task 13 (IN26-IN30; IP3, IP24): the Investigate screen's note state and handlers,
// kept out of InvestigateScreen.vue (its 400-line cap, with Tasks 14-15 still to add):
// the create dialog's open flag and inputs (the body rendered HERE, in the UI, through
// NOTE_VOCABULARY — the application layer holds no copy, IP3), the announcement and focus
// after a create, and the guarded Open of a linked note.
import { computed, nextTick, ref, watch, type ComputedRef, type Ref } from 'vue';
import { renderNoteBody, type NoteIdentity } from '../../../application/investigation/note-model';
import { noteBaseName } from '../../../application/investigation/note-path';
import type { InvestigationRow } from '../../read-models/investigation';
import { checklistFor, evidenceFactsFor, noteIdentityFor, type EvidenceBundle } from '../../read-models/investigation-evidence';
import { useCityStore } from '../../stores/city-store';
import { useInvestigationStore } from '../../stores/investigation-store';
import { reannounce } from '../../kit/reannounce';
import {
  FINDING_KIND_LABEL, NOTE_CREATED, NOTE_CREATED_EXCLUDED, NOTE_EXCLUSION_FAILED, NOTE_VOCABULARY,
} from '../../inspector-copy';

interface NotesInput {
  readonly row: ComputedRef<InvestigationRow | null>;
  readonly bundle: ComputedRef<EvidenceBundle | null>;
  readonly uncertainties: ComputedRef<readonly string[]>;
  readonly live: Ref<string>;
}

interface CreateInput {
  readonly defaultFolder: string; readonly defaultName: string; readonly rootPath: string | null;
  readonly identity: NoteIdentity; readonly body: string;
}

type Exclusion = 'added' | 'already' | 'not-requested' | 'failed';

function createdMessage(path: string, exclusion: Exclusion): string {
  if (exclusion === 'added') return NOTE_CREATED_EXCLUDED(path, path.slice(0, path.lastIndexOf('/')));
  return exclusion === 'failed' ? NOTE_EXCLUSION_FAILED(path) : NOTE_CREATED(path);
}

export function useInvestigationNotes(input: NotesInput) {
  const city = useCityStore();
  const investigation = useInvestigationStore();
  /** The screen's root element (its template's `ref="root"`), where the Open buttons live. */
  const root = ref<HTMLElement | null>(null);
  const creating = ref(false);
  const opening = ref(false);
  const openFailed = ref<string | null>(null);
  /** IP24: the created note's path until its Open button exists — the index hears of a new
   *  note through the metadata cache, which may land after the create resolves. */
  const focusPending = ref<string | null>(null);

  const createInput = computed<CreateInput | null>(() => {
    const row = input.row.value;
    const bundle = input.bundle.value;
    const snapshot = city.snapshot;
    if (row === null || bundle === null || snapshot === null) return null;
    return {
      defaultFolder: investigation.destination?.folder ?? '',
      defaultName: noteBaseName(row.id, FINDING_KIND_LABEL[row.kind], row.file.name),
      rootPath: snapshot.scope.rootPath,
      identity: noteIdentityFor(row, snapshot.repositoryId, snapshot.snapshotId),
      body: renderNoteBody(evidenceFactsFor(row, bundle, input.uncertainties.value), checklistFor(row.kind), NOTE_VOCABULARY),
    };
  });

  const focusOpen = (path: string): boolean => {
    const buttons = Array.from(root.value?.querySelectorAll<HTMLElement>('.ci-notes-panel__open') ?? []);
    const button = buttons.find((b) => b.dataset.path === path);
    button?.focus();
    return button !== undefined;
  };

  // A selection change (a gone finding, a codebase switch) closes the dialog for good — it
  // never reopens for another finding — and drops a pending focus and a stale Open failure.
  watch(() => investigation.selectedFingerprint, () => {
    creating.value = false;
    focusPending.value = null;
    openFailed.value = null;
  });
  watch(() => input.row.value?.notes, async () => {
    const path = focusPending.value;
    if (path === null) return;
    await nextTick();
    if (focusPending.value === path && focusOpen(path)) focusPending.value = null;
  });

  const openCreate = (): void => {
    if (createInput.value !== null) creating.value = true;
  };
  const closeCreate = (): void => {
    creating.value = false;
  };
  /** E17: announces only the real outcome; IP24: nothing is opened, focus goes to Open. */
  const onCreated = async (result: { readonly path: string; readonly exclusion: Exclusion }): Promise<void> => {
    creating.value = false;
    focusPending.value = result.path;
    await reannounce(input.live, createdMessage(result.path, result.exclusion));
    await nextTick();
    if (focusPending.value === result.path && focusOpen(result.path)) focusPending.value = null;
  };
  /** E40: the panel guards a press while opening; this is the second guard. A `false`
   *  result shows the panel's own role="alert" line under that note (never silent). */
  const openLinked = async (path: string): Promise<void> => {
    if (opening.value) return;
    opening.value = true;
    openFailed.value = null;
    const ok = await investigation.openNote(path);
    openFailed.value = ok ? null : path;
    opening.value = false;
  };

  return { root, creating, opening, openFailed, createInput, openCreate, closeCreate, onCreated, openLinked };
}
