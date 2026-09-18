// Every user-facing string this task ships, taken CHARACTER-FOR-CHARACTER from
// docs/concept/design/interactions/04-microcopy.md (spec §0 rank 4, authoritative for
// behaviour) — task-9-context.md defect D25. Where the catalogue uses a typographic
// quote (COPY-11), that quote is reproduced exactly; a straight-quote transcription
// would fail a character-for-character comparison.
//
// Two strings must NEVER appear anywhere this plugin ships (task-9-context.md §5,
// D25): "Read-only source access" and "Source remains unchanged" are factual claims
// gated on task 12's G2 evidence. COPY-20 ("Unused candidate") is WP-02+. S01's
// "Analysis reports can be added later" is dropped. None of the four appear below.
//
// Centralised here (not one file's own `<script>` block) because several components
// share the exact same approved sentence and the 400-line src/** budget cannot afford
// a second copy of any of these in every consumer.
export const COPY_01 = 'Understand your codebase. Start with its structure.';
export const COPY_02 = 'Select a codebase';
export const COPY_03 = 'Read a local codebase outside this vault.';
export const COPY_04 = 'Review scope and read access';
export const COPY_05 = 'Source text and file metadata are read. No project scripts, dependency installation, or source writes are performed.';
export const COPY_06 = 'I approve read access to this directory for this scan.';
export const COPY_07 = 'Scan codebase';
export const COPY_09 = 'Cancel scan';
export const COPY_10 = 'Scan cancelled. The incomplete result was discarded. Your complete snapshot from {time} is unchanged.';
export const COPY_12 = 'No files are included in this scope. Review the selected directory and exclusions.';
export const COPY_14 = 'The 3D view is unavailable. File inspection still works.';
export const COPY_27 = 'Relative path copied.';
export const COPY_28 = 'The saved source directory is unavailable on this machine. The stored snapshot can still be inspected.';
export const COPY_30 = 'The selected file is outside these filters. Reveal file or clear selection.';

/** COPY-08, formatted. `run-state.ts`'s own `formatProgressMessage` (task 8) is the
 *  identical string, kept in sync by construction — both read the same catalogue
 *  entry, not one copying the other. */
export function formatCopy08(count: number): string {
  return `Reading included files. ${count} files read so far.`;
}

/** COPY-11, verbatim — including the catalogue's typographic quotes around
 *  `{query}` (defect D25). `toContain` checks in tests only need the fixed prefix; the
 *  query is interpolated so the message still names what was searched for. */
export function formatCopy11(matchingFileCount: number, query: string): string {
  return `No matching files. The snapshot still contains ${matchingFileCount} files. No paths match “${query}”.`;
}

/** COPY-13, formatted. */
export function formatCopy13(measured: number, included: number): string {
  return `Some files could not be read. Measurements cover ${measured} of ${included} included files.`;
}

/** COPY-18's pattern ("Not measured. {reason}"). COPY-18 itself is catalogued under
 *  a provider/analysis context (out of WP-01 scope per plan-global-constraints.md's
 *  own curated table), but `Observation.status === 'unavailable'` — a core §4.1
 *  type, not a provider concept — always carries a required, non-null `reason`, and
 *  the inspector must show it (task-9-brief.md's own "surfaces the REASON"
 *  requirement). The pattern is reused verbatim rather than inventing a second one. */
export function formatUnavailableReason(reason: string): string {
  return `Not measured. ${reason}`;
}

/** Task 9 fix round 1, item 9: NOT COPY-04. COPY-04 ("Review scope and read
 *  access") is the PERMISSION MODAL's own heading/button label (source-modal.ts /
 *  scope-modal.ts, task 7) — a call to action for a control that is currently on
 *  screen, not a description of a STATE where that control is not. Reusing it as
 *  a state-surface banner was wrong: "a button label is not a state description"
 *  (task-9-fix-1.md, item 9). This names the state and points at the same next
 *  action COPY-04 itself is the label for, without claiming to BE it. Not in the
 *  microcopy catalogue under any COPY id — authored fresh, in the catalogue's own
 *  factual, action-oriented voice. */
export const COPY_READ_NOT_APPROVED = 'Read access has not been approved for this scan yet. Review scope and read access to continue.';

/** Task 9 fix round 1, item 9: not in the microcopy catalogue under any COPY id.
 *  A bare scan-completion announcement has no catalogue entry — COPY-08 covers
 *  only the IN-PROGRESS count, and every other scan-outcome id (COPY-10, the
 *  failure banner) is about a non-success outcome. Authored fresh, factual and
 *  brief, matching the catalogue's own tone; listed here (not left inline) so
 *  every invented string in this task lives in one place. */
export const ANNOUNCE_SCAN_COMPLETE = 'Scan complete.';

/** Task 9 fix round 1, item 9: not in the microcopy catalogue. Selection itself
 *  (as opposed to what a selected file's measurements ARE, which IS catalogued)
 *  has no COPY id — this is the polite, control-initiated-selection announcement
 *  spec 5.2 asks for, naming the file so a screen-reader user hears what changed. */
export function formatAnnounceSelected(name: string): string {
  return `Selected ${name}.`;
}

/** Not in the microcopy catalogue: WebGL context loss (spec §4.2's "no self-healing —
 *  the VIEW disposes and reconstructs") has no COPY id. Authored fresh, in the
 *  catalogue's own factual, action-oriented voice, naming the mechanism spec §4.2
 *  actually performs so this state does not read as a dead end. */
export const CONTEXT_LOST_NOTICE = 'The 3D view stopped responding and will reconstruct. File inspection still works.';

/** A failed refresh (spec §7) has no COPY id either: task-9-context.md finding 3
 *  requires the surface to say the previous snapshot is retained, which
 *  run-state.ts's own `Scan failed: {message}` does not. */
export function formatFailedRefreshNotice(message: string): string {
  return `Scan failed: ${message} The previous snapshot is unchanged and still shown.`;
}
