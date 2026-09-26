// WP-04 Task 14 (IN31-IN34; IP25, E15, E17, E22, E23, E24): refreshing a note's evidence block from the
// Investigate screen — a linked note of the selected finding, or a note whose finding the
// current report no longer lists (IN34). The block is rendered HERE, in the UI, through
// NOTE_VOCABULARY (the application layer holds no copy, IP3). As with create (Task 13, E22),
// this composable owns the write's outcome: the announcement and the dialog's close, so a
// refresh that lands after the dialog closed is still announced, a refusal included (E24) —
// but only while the same codebase is bound. The dialog reads the CURRENT index entry for
// the note's path, never the link captured at open (E23).
import { computed, ref, watch, type ComputedRef, type Ref } from 'vue';
import type { NoteIndex, NoteLink } from '../../../application/investigation/note-index';
import { renderEvidenceBlock } from '../../../application/investigation/note-model';
import type { RefreshNoteRequest, RefreshNoteResult } from '../../../application/ports/investigation-notes-port';
import type { InvestigationModel, InvestigationRow } from '../../read-models/investigation';
import {
  evidenceFactsFor, goneFactsFor, refreshChangesFor, type EvidenceBundle, type RefreshChanges,
} from '../../read-models/investigation-evidence';
import { useCityStore } from '../../stores/city-store';
import { useEvidenceStore } from '../../stores/evidence-store';
import { useInvestigationStore } from '../../stores/investigation-store';
import { reannounce } from '../../kit/reannounce';
import { NOTE_VOCABULARY, REFRESH_DONE, REFRESH_FAILED, REFRESH_MARKERS_EDITED, REFRESH_PARTIAL } from '../../inspector-copy';

interface RefreshSources {
  readonly row: ComputedRef<InvestigationRow | null>;
  readonly bundle: ComputedRef<EvidenceBundle | null>;
  readonly uncertainties: ComputedRef<readonly string[]>;
  readonly model: ComputedRef<InvestigationModel>;
  readonly live: Ref<string>;
}

/** The note being refreshed: its path, the link as it was at open (only a fallback, E23),
 *  and the selected finding it is linked to, or null for a note whose finding is not in
 *  this report. */
interface RefreshTarget { readonly path: string; readonly opened: NoteLink; readonly fingerprint: string | null }

interface RefreshInput { readonly link: NoteLink; readonly changes: RefreshChanges; readonly request: RefreshNoteRequest }

/** `relinked`: the note is now indexed under another finding (E23), refused without a write. */
interface Resolved { readonly input: RefreshInput; readonly relinked: boolean }

/** The refresh dialog's `submit` prop. */
export type SubmitRefresh = (request: RefreshNoteRequest) => Promise<RefreshNoteResult | null>;

/** Every refresh outcome's words: the live region's for a change (and, E24, for a refusal
 *  whose dialog has closed), the dialog's alert line for a refusal. */
export function refreshWords(result: RefreshNoteResult | null, path: string): string {
  switch (result) {
    case 'refreshed': return REFRESH_DONE(path);
    case 'partial': return REFRESH_PARTIAL(path);
    case 'markers-edited': return REFRESH_MARKERS_EDITED;
    case null: return REFRESH_FAILED['write-failed'];
    default: return REFRESH_FAILED[result];
  }
}

function indexes(notes: NoteIndex, path: string): boolean {
  return Array.from(notes.byFingerprint.values()).some((links) => links.some((l) => l.path === path));
}

export function useNoteRefresh(input: RefreshSources) {
  const city = useCityStore();
  const evidence = useEvidenceStore();   // its repositoryId is the bound codebase (investigation-store.ts)
  const investigation = useInvestigationStore();
  const refreshing = ref<RefreshTarget | null>(null);

  /** IN31/IN34 (E23): the dialog's inputs from the CURRENT index entry for the note's path,
   *  never the link captured at open — or null once they no longer hold: the selection moved
   *  off the note's finding, another codebase is bound, or a note listed as not reported is
   *  not listed there any more (reported again, re-linked or gone). A linked note gone from
   *  the index keeps its last link, so the host decides (`missing`, `not-linked`). */
  const resolved = computed<Resolved | null>(() => {
    const target = refreshing.value;
    const snapshot = city.snapshot;
    if (target === null || snapshot === null) return null;
    const model = input.model.value;
    let row: InvestigationRow | null = null;
    let link: NoteLink;
    let relinked = false;
    let block: string;
    if (target.fingerprint !== null) {
      row = input.row.value;
      const bundle = input.bundle.value;
      if (row === null || row.fingerprint !== target.fingerprint || bundle === null) return null;
      const current = row.notes.find((n) => n.path === target.path);
      relinked = current === undefined && indexes(investigation.notes, target.path);
      link = current ?? target.opened;
      block = renderEvidenceBlock(evidenceFactsFor(row, bundle, input.uncertainties.value), NOTE_VOCABULARY);
    } else {
      const current = model.orphanNotes.find((n) => n.path === target.path);
      if (current === undefined) return null;
      link = current;
      block = renderEvidenceBlock(goneFactsFor(link, model.evidence, snapshot.snapshotId), NOTE_VOCABULARY);
    }
    if (link.codebaseId !== snapshot.repositoryId) return null;
    return {
      relinked,
      input: {
        link,
        changes: refreshChangesFor(link, row, model.evidence, snapshot.snapshotId),
        request: {
          path: link.path, codebaseId: snapshot.repositoryId, block, snapshotId: snapshot.snapshotId, sourcePath: row?.anchorPath ?? link.sourcePath,
        },
      },
    };
  });
  const refreshInput = computed<RefreshInput | null>(() => resolved.value?.input ?? null);

  // Inputs that no longer hold close the dialog for good: it never reopens on its own.
  watch(resolved, (next) => { if (next === null) refreshing.value = null; });

  /** A note of the selected finding is refreshed against its row; any other note (listed
   *  under Notes for findings not in this report) as not reported. */
  const openRefresh = (link: NoteLink): void => {
    const row = input.row.value;
    const fingerprint = row !== null && row.portable === link.fingerprint ? row.fingerprint : null;
    refreshing.value = { path: link.path, opened: link, fingerprint };
  };
  const closeRefresh = (): void => {
    refreshing.value = null;
  };
  /** E15/E17: 'refreshed' and 'partial' both changed the note, so both close the dialog and
   *  are announced; every other result changed nothing and is returned for the dialog's own
   *  alert line — or, when that dialog has closed meanwhile (the selection moved), announced
   *  (E24: the user is always told). E22: a codebase switch mid-write announces nothing.
   *  E23: a note re-linked to another finding is refused before any write. */
  const submitRefresh: SubmitRefresh = async (request) => {
    const target = refreshing.value;
    if (resolved.value?.relinked === true) return 'not-linked';
    const codebase = evidence.repositoryId;
    let result: RefreshNoteResult | null;
    try {
      result = await investigation.refresh(request);
    } catch {
      result = 'write-failed';
    }
    if (evidence.repositoryId !== codebase) return result;
    const open = target !== null && refreshing.value === target;
    if (open && result !== 'refreshed' && result !== 'partial') return result;
    if (open) refreshing.value = null;
    await reannounce(input.live, refreshWords(result, request.path));
    return result;
  };

  return { refreshInput, openRefresh, closeRefresh, submitRefresh };
}
