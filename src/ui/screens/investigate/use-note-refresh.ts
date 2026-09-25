// WP-04 Task 14 (IN31-IN34; IP25, E15, E17, E22): refreshing a note's evidence block from the
// Investigate screen — a linked note of the selected finding, or a note whose finding the
// current report no longer lists (IN34). The block is rendered HERE, in the UI, through
// NOTE_VOCABULARY (the application layer holds no copy, IP3). As with create (Task 13, E22),
// this composable owns the write's outcome: the announcement and the dialog's close, so a
// refresh that lands after the dialog closed is still announced — but only while the same
// codebase is bound.
import { computed, ref, watch, type ComputedRef, type Ref } from 'vue';
import type { NoteLink } from '../../../application/investigation/note-index';
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
import { NOTE_VOCABULARY, REFRESH_DONE, REFRESH_PARTIAL } from '../../inspector-copy';

interface RefreshSources {
  readonly row: ComputedRef<InvestigationRow | null>;
  readonly bundle: ComputedRef<EvidenceBundle | null>;
  readonly uncertainties: ComputedRef<readonly string[]>;
  readonly model: ComputedRef<InvestigationModel>;
  readonly live: Ref<string>;
}

/** The note being refreshed; `fingerprint` is the selected finding it is linked to, or null
 *  for a note whose finding is not in this report. */
interface RefreshTarget { readonly link: NoteLink; readonly fingerprint: string | null }

interface RefreshInput { readonly link: NoteLink; readonly changes: RefreshChanges; readonly request: RefreshNoteRequest }

/** The refresh dialog's `submit` prop. */
export type SubmitRefresh = (request: RefreshNoteRequest) => Promise<RefreshNoteResult | null>;

export function useNoteRefresh(input: RefreshSources) {
  const city = useCityStore();
  const evidence = useEvidenceStore();   // its repositoryId is the bound codebase (investigation-store.ts)
  const investigation = useInvestigationStore();
  const refreshing = ref<RefreshTarget | null>(null);

  /** IN31/IN34: the dialog's inputs, or null once they no longer hold — the selection moved
   *  off the note's finding, or a note listed as not reported is reported again. */
  const refreshInput = computed<RefreshInput | null>(() => {
    const target = refreshing.value;
    const snapshot = city.snapshot;
    if (target === null || snapshot === null) return null;
    const { link } = target;
    const model = input.model.value;
    let row: InvestigationRow | null = null;
    let block: string;
    if (target.fingerprint !== null) {
      row = input.row.value;
      const bundle = input.bundle.value;
      if (row === null || row.fingerprint !== target.fingerprint || bundle === null) return null;
      block = renderEvidenceBlock(evidenceFactsFor(row, bundle, input.uncertainties.value), NOTE_VOCABULARY);
    } else {
      if (model.rows.some((r) => r.portable === link.fingerprint)) return null;
      block = renderEvidenceBlock(goneFactsFor(link, model.evidence, snapshot.snapshotId), NOTE_VOCABULARY);
    }
    return {
      link,
      changes: refreshChangesFor(link, row, model.evidence, snapshot.snapshotId),
      request: {
        path: link.path, codebaseId: snapshot.repositoryId, block, snapshotId: snapshot.snapshotId, sourcePath: row?.anchorPath ?? link.sourcePath,
      },
    };
  });

  // Inputs that no longer hold close the dialog for good: it never reopens on its own.
  watch(refreshInput, (next) => { if (next === null) refreshing.value = null; });

  /** A note of the selected finding is refreshed against its row; any other note (listed
   *  under Notes for findings not in this report) as not reported. */
  const openRefresh = (link: NoteLink): void => {
    const row = input.row.value;
    refreshing.value = { link, fingerprint: row !== null && row.portable === link.fingerprint ? row.fingerprint : null };
  };
  const closeRefresh = (): void => {
    refreshing.value = null;
  };
  /** E15/E17: 'refreshed' and 'partial' both changed the note, so both close the dialog and
   *  are announced; every other result changed nothing and is returned for the dialog's own
   *  alert line. E22: a codebase switch mid-write announces nothing. */
  const submitRefresh: SubmitRefresh = async (request) => {
    const target = refreshing.value;
    const codebase = evidence.repositoryId;
    const result = await investigation.refresh(request);
    if (result !== 'refreshed' && result !== 'partial') return result;
    if (evidence.repositoryId !== codebase) return result;
    if (refreshing.value === target) refreshing.value = null;
    await reannounce(input.live, result === 'refreshed' ? REFRESH_DONE(request.path) : REFRESH_PARTIAL(request.path));
    return result;
  };

  return { refreshInput, openRefresh, closeRefresh, submitRefresh };
}
