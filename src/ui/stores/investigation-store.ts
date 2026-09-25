// WP-04 IN4: the Investigate selection, one per leaf (each CityView has its own Pinia), a
// setup store like relations-store.ts. Session state only: nothing here reaches
// CityViewState, getState() or data.json. The fingerprint is the finding's own
// (findingFingerprint), so a re-import that keeps the finding keeps the selection.
// WP-04 Task 10 (IN7, IN13, IN33; IP37, IP39): the plugin's notes port and source preview,
// handed over by wireDataPorts before mount. PF-C9/IP37: ONE watch on the evidence store's
// repositoryId resets the selection, gone notice, preview, notes and destination
// synchronously, and rebinds the one note subscription to the new codebase. A setup store:
// `onScopeDispose` (unwireDataPorts' `$dispose`) drops that subscription, because the port
// outlives the leaf.
import { defineStore } from 'pinia';
import { onScopeDispose, ref, shallowRef, watch } from 'vue';
import { EMPTY_NOTE_INDEX, type NoteIndex } from '../../application/investigation/note-index';
import type { PreviewRequest, PreviewResult, SourcePreview } from '../../application/investigation/source-preview';
import type {
  CreateNoteRequest, CreateNoteResult, DestinationPlan, InvestigationNotesPort, NoteDestination, RefreshNoteRequest,
  RefreshNoteResult,
} from '../../application/ports/investigation-notes-port';
import { useEvidenceStore } from './evidence-store';

export type PreviewState =
  | { readonly status: 'idle' }
  | { readonly status: 'loading'; readonly fingerprint: string }
  | { readonly status: 'ready'; readonly fingerprint: string; readonly result: PreviewResult };

const IDLE: PreviewState = { status: 'idle' };
// Module scope (oxlint consistent-function-scoping): captures nothing.
const readFailed = (): PreviewResult => ({ status: 'unavailable', reason: 'read-error' });

/** Total (Task 10 review, item 4): a service that throws synchronously, or rejects, gives a
 *  read-error result. The read itself still starts synchronously, in the caller's tick. */
function readSafely(service: SourcePreview, request: PreviewRequest): Promise<PreviewResult> {
  try {
    return service.read(request).catch(readFailed);
  } catch {
    return Promise.resolve(readFailed());
  }
}

export const useInvestigationStore = defineStore('investigation', () => {
  const evidence = useEvidenceStore();
  const selectedFingerprint = ref<string | null>(null);
  const findingGone = ref(false);
  /** IN33: the BOUND codebase's note index (`list(repositoryId)`), never another codebase's:
   *  a portable key shared by two codebases attaches only to its own codebase's rows. */
  const notes = shallowRef<NoteIndex>(EMPTY_NOTE_INDEX);
  /** IN18: the bound codebase's notes folder; null while unbound, not yet read, or failed. */
  const destination = ref<NoteDestination | null>(null);
  /** Task 10 review, item 2: a SEPARATE flag (so `destination` keeps its shape): true when
   *  the last read of the folder setting failed, cleared by a bind or a good read. */
  const destinationFailed = ref(false);
  const preview = shallowRef<PreviewState>(IDLE);
  let notesPort: InvestigationNotesPort | null = null;
  let sourcePreview: SourcePreview | null = null;
  let unsubscribe: (() => void) | null = null;
  // IP39: each read takes a token; a result for an older token is dropped.
  let previewToken = 0;
  // Task 10 review, item 1: the same for destination reads. Every bind and every read bumps
  // it, so only the LATEST read lands — A→B→A cannot let A's first read overwrite its second.
  let destinationToken = 0;

  const resetPreview = (): void => {
    previewToken += 1;
    preview.value = IDLE;
  };

  /** IN18: (re-)reads the bound codebase's folder. Called on bind, by the Settings row on
   *  mount and by the create dialog on open: the settings tab that changes the folder has no
   *  change signal. The shown folder stays until the new read lands. */
  const loadDestination = async (): Promise<void> => {
    const port = notesPort;
    const id = evidence.repositoryId;
    if (port === null || id === '') return;
    destinationToken += 1;
    const token = destinationToken;
    try {
      const next = await port.destination(id);
      if (token !== destinationToken) return;
      destination.value = next;
      destinationFailed.value = false;
    } catch {
      if (token !== destinationToken) return;
      destination.value = null;
      destinationFailed.value = true;
    }
  };

  /** Drops the old subscription, then lists, subscribes and reads the destination for the
   *  bound codebase. */
  const bindNotes = (): void => {
    unsubscribe?.();
    unsubscribe = null;
    notes.value = EMPTY_NOTE_INDEX;
    destinationToken += 1;
    destination.value = null;
    destinationFailed.value = false;
    const port = notesPort;
    const id = evidence.repositoryId;
    if (port === null || id === '') return;
    notes.value = port.list(id);
    unsubscribe = port.subscribe(() => { notes.value = port.list(id); });
    void loadDestination();
  };

  // PF14: arrow-function members.
  /** Opening another finding drops its preview; opening the selected one again keeps it (the
   *  screen reads on a selection CHANGE, so a reset here would never be read again). */
  const open = (fingerprint: string): void => {
    if (fingerprint !== selectedFingerprint.value) resetPreview();
    selectedFingerprint.value = fingerprint;
    findingGone.value = false;
  };
  const markGone = (): void => {
    if (selectedFingerprint.value === null) return;
    selectedFingerprint.value = null;
    findingGone.value = true;
    resetPreview();
  };
  const setPorts = (nextNotes: InvestigationNotesPort, nextPreview: SourcePreview): void => {
    notesPort = nextNotes;
    sourcePreview = nextPreview;
    resetPreview();
    bindNotes();
  };
  /** IN13 (IP39): the ONLY place a preview is read. A newer call wins. A request for any
   *  codebase but the bound one is refused (Task 10 review, item 3), and so is every request
   *  while none is bound. */
  const readPreview = async (fingerprint: string, request: PreviewRequest): Promise<void> => {
    const service = sourcePreview;
    if (service === null || evidence.repositoryId === '' || request.codebaseId !== evidence.repositoryId) return;
    previewToken += 1;
    const token = previewToken;
    preview.value = { status: 'loading', fingerprint };
    const result = await readSafely(service, request);
    if (token === previewToken) preview.value = { status: 'ready', fingerprint, result };
  };
  const plan = (folder: string, baseName: string, rootPath: string | null): DestinationPlan | null =>
    (notesPort === null ? null : notesPort.plan(folder, baseName, rootPath));
  const create = (request: CreateNoteRequest): Promise<CreateNoteResult | null> =>
    (notesPort === null ? Promise.resolve(null) : notesPort.create(request));
  /** E15/E17: the port's result, `'partial'` included, passes through untouched. */
  const refresh = (request: RefreshNoteRequest): Promise<RefreshNoteResult | null> =>
    (notesPort === null ? Promise.resolve(null) : notesPort.refresh(request));
  const openNote = (path: string): Promise<boolean> => (notesPort === null ? Promise.resolve(false) : notesPort.open(path));
  const sourceNotePath = (rootPath: string, relativePath: string): string | null =>
    (notesPort === null ? null : notesPort.sourceNotePath(rootPath, relativePath));

  watch(() => evidence.repositoryId, () => {
    selectedFingerprint.value = null;
    findingGone.value = false;
    resetPreview();
    bindNotes();
  }, { immediate: true, flush: 'sync' });
  onScopeDispose(() => {
    unsubscribe?.();
    unsubscribe = null;
  });

  return {
    selectedFingerprint, findingGone, notes, destination, destinationFailed, preview, open, markGone, setPorts, loadDestination,
    readPreview, plan, create, refresh, openNote, sourceNotePath,
  };
});
