// WP-04 Task 14 prep (IN7-IN13; IP39, E19, E20, E40): the Investigate screen's source-preview
// wiring, moved out of InvestigateScreen.vue (its 400-line cap, with Tasks 14-15 still to
// add) with no behaviour change: the highlight verdict, the one read trigger, Reload, and
// Open in Obsidian with its own busy/failed state. The panel only reflects these.
import { computed, ref, watch, type ComputedRef } from 'vue';
import { locationVerdict, type LocationVerdict } from '../../../application/investigation/stale-location';
import type { InvestigationModel, InvestigationRow } from '../../read-models/investigation';
import { locationInputsFor, previewRequestFor } from '../../read-models/investigation-evidence';
import { useCityStore } from '../../stores/city-store';
import { useInvestigationStore } from '../../stores/investigation-store';

interface PreviewInput {
  readonly row: ComputedRef<InvestigationRow | null>;
  readonly model: ComputedRef<InvestigationModel>;
}

export function useInvestigationPreview(input: PreviewInput) {
  const store = useCityStore();
  const investigationStore = useInvestigationStore();
  /** Fix round 1 (review Important 2, E40): Open in Obsidian's own busy/failed state — the
   *  panel only reflects these, the async open and its guard live here. */
  const opening = ref(false);
  const openFailed = ref(false);

  /** IN10: the highlight verdict, only once the CURRENT selection's preview has read ok —
   *  a stale or in-flight result for another row (mid-switch) never lends its verdict here.
   *  Fix round 1 (review Important 1, ruling E19): a fingerprint never includes its line, so
   *  a re-run can move the finding's line while keeping the same fingerprint AND the same
   *  (now old) window. `state.line` is the line the WINDOW was read for; when it differs
   *  from the row's CURRENT line, the read is not "for" this line at all, so the verdict is
   *  null ("not checked") rather than computed against a window that may not even contain
   *  it — Reload (which re-reads for the current line) is what recovers it. */
  const verdict = computed<LocationVerdict | null>(() => {
    const row = input.row.value;
    const snapshot = store.snapshot;
    const state = investigationStore.preview;
    if (row === null || snapshot === null) return null;
    if (state.status !== 'ready' || state.fingerprint !== row.fingerprint || state.result.status !== 'ok') return null;
    if (state.line !== row.line) return null;
    return locationVerdict(locationInputsFor(row, snapshot, input.model.value.evidence, state.result.text));
  });
  /** IN12: offered only when the anchor is a `.md` file the vault itself holds — the port's
   *  own check (host/investigation-notes.ts); this screen only asks and shows what it says. */
  const notePath = computed(() => {
    const row = input.row.value;
    const snapshot = store.snapshot;
    if (row === null || snapshot === null) return null;
    return investigationStore.sourceNotePath(snapshot.scope.rootPath, row.anchorPath);
  });

  /** Fix round 1 (review item 12): the one place that reads the CURRENT selection's anchor —
   *  shared by the read-trigger watch below and Reload, so the two can never drift apart on
   *  what "read the selection" means. */
  const readSelected = (row: InvestigationRow | null): void => {
    const snapshot = store.snapshot;
    if (row !== null && snapshot !== null) void investigationStore.readPreview(row.fingerprint, previewRequestFor(row, snapshot));
  };

  /** IN7/IN13 (IP39): the ONLY trigger for a preview read besides Reload — a selection
   *  change, never a list render or a re-import. `immediate` so a fingerprint opened before
   *  this screen mounted (a real entry point) still reads on first render. Fix round 1
   *  (review Important 13, ruling E20): a REMOUNT re-runs this `immediate` watch from a
   *  fresh component instance even though `selectedFingerprint` never changed — `firstRun`
   *  (THIS instance's own flag, reset on every mount) gates the guard to only that first,
   *  remount-shaped invocation: when the store already holds a ready or loading read for the
   *  SAME fingerprint, nothing more is read. A later, genuine re-entry (an actual selection
   *  change) is never gated by it — IN13 always reads a real change. */
  let firstRun = true;
  watch(() => investigationStore.selectedFingerprint, (fp) => {
    const row = fp === null ? null : input.model.value.byFingerprint.get(fp) ?? null;
    const current = investigationStore.preview;
    const remounted = firstRun && row !== null && current.status !== 'idle' && current.fingerprint === row.fingerprint;
    firstRun = false;
    if (!remounted) readSelected(row);
  }, { immediate: true });

  /** Fix round 1 (review Important 2): a stale Open in Obsidian failure never lingers onto
   *  a later selection. */
  watch(() => investigationStore.selectedFingerprint, () => { openFailed.value = false; });

  /** IN11: Reload re-reads the CURRENT selection's anchor file (the panel itself guards a
   *  press while already loading, E40). Always reads, even on a remount's stale window
   *  (E20 only skips the automatic trigger, never an explicit Reload). */
  const reloadPreview = (): void => {
    readSelected(input.row.value);
  };

  /** Fix round 1 (review Important 2, E40): the panel's own guard (aria-disabled +
   *  `opening`) stops a double press reaching here at all; this is the second guard for a
   *  press that somehow still does (a race, a programmatic call). `openFailed` shows the
   *  panel's own role="alert" line on a `false` result; a `true` result announces nothing
   *  (E17: only a real outcome, and opening a note is not itself news). */
  const openInObsidian = async (): Promise<void> => {
    const path = notePath.value;
    if (path === null || opening.value) return;
    opening.value = true;
    openFailed.value = false;
    const ok = await investigationStore.openNote(path);
    openFailed.value = !ok;
    opening.value = false;
  };

  return { verdict, notePath, opening, openFailed, reloadPreview, openInObsidian };
}
