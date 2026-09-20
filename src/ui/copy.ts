// Every user-facing string this task ships, taken CHARACTER-FOR-CHARACTER from
// docs/concept/design/interactions/04-microcopy.md (spec §0 rank 4, authoritative for
// behaviour) — task-9-context.md defect D25. Where the catalogue uses a typographic
// quote (COPY-11), that quote is reproduced exactly; a straight-quote transcription
// would fail a character-for-character comparison.
//
// TASK 12 UPDATE. Two of the four strings this comment used to forbid now SHIP, and
// the reason is recorded rather than assumed: "Read-only source access" and "Source
// remains unchanged." were factual claims made on the product's behalf, gated on the
// G2 evidence in docs/superpowers/notes/2026-09-17-wp01-gate-evidence.md. That
// evidence now exists -- a whole-tree hash diff over a 1,000-file vault with this
// plugin installed showing zero differences, and a read-log proof that excluded paths
// (including the ACTUAL vault.configDir) are never opened -- so the claims are true
// and they are exported below as CLAIM_*.
//
// If the G2 record ever ceases to hold, these two exports come back out. They are
// named CLAIM_, not COPY_, precisely because they are not catalogue microcopy: they
// are assertions about what this software does to someone's files.
//
// Still forbidden, and absent below: COPY-20 ("Unused candidate") is WP-02+, and S01's
// "Analysis reports can be added later" is dropped.
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

/** The two factual claims (spec 5.2 and 10). Evidence:
 *  docs/superpowers/notes/2026-09-17-wp01-gate-evidence.md, section G2 -- the boundary
 *  matrix, the whole-tree hash diff (content, size AND mtime) at 1,000 files with the
 *  plugin installed showing ZERO differences, and the read-log proof that excluded
 *  paths, including the actual `vault.configDir`, are never opened.
 *
 *  Defined here, once, so the consent screen and the status line cannot drift into
 *  making slightly different promises. The trailing full stop on the second is
 *  deliberate: it is a sentence, where the first is a label. */
export const CLAIM_READ_ONLY_ACCESS = 'Read-only source access';
export const CLAIM_SOURCE_UNCHANGED = 'Source remains unchanged.';

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

/** Task 6 (F9): C07's file list had no name and no count of its own in the DOM -- a
 *  sighted user could infer both from the panel's position and its scrollbar, but
 *  nothing said so. Not in the microcopy catalogue under any COPY id (the catalogue
 *  covers states and outcomes, not a panel's own heading); authored fresh, in the
 *  catalogue's factual voice -- a label plus a count, nothing more. */
export function formatFileListHeader(fileCount: number): string {
  return `Codebase files (${fileCount})`;
}

/** Task 6: one district group's heading, appended after its name. Not catalogued --
 *  see `formatFileListHeader`. Pluralised because `formatFileListGroup(1)` is a real
 *  case (a district that ends up holding exactly one file). */
export function formatFileListGroup(fileCount: number): string {
  return `${fileCount} file${fileCount === 1 ? '' : 's'}`;
}

/** Task 6: the accessible name for a group's own focus control. Visible text on the
 *  button stays the short "Focus" (styles.css keeps it compact); every one of these
 *  buttons needs a DISTINCT accessible name or a screen-reader user tabbing through
 *  the list hears "Focus, Focus, Focus..." with nothing to tell them apart -- this is
 *  the aria-label that names which district each one frames. */
export function formatDirectoryFocusLabel(directoryName: string): string {
  return `Focus ${directoryName} in the 3D view`;
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

/** Task 7 (F8, ruling P3): the S05 mockup composes the canvas with a header -- an
 *  eyebrow, a title, a subtitle naming the counts, and a badge -- and the spec's
 *  rank-6 precedence grants a mockup authority over WHAT IS PRESENT even where no
 *  prose repeats it. `Codebase city` and `Read-only snapshot` are reproduced from
 *  that mockup (docs/concept/design/mockups/s05-city.png) verbatim; grepped against
 *  interactions/04-microcopy.md and NEITHER has a COPY id there -- the catalogue
 *  covers states and outcomes, not a panel's own heading or a status badge. Task 12
 *  pins these two by test; they are catalogue-absent but mockup-sourced, which is a
 *  different provenance from the two exports directly below. */
export const COPY_CITY_HEADER_TITLE = 'Codebase city';
export const COPY_CITY_HEADER_BADGE = 'Read-only snapshot';

/** Same grep, same absence of a COPY id, but a DIFFERENT provenance from the two
 *  exports above: neither the eyebrow nor the subtitle is quoted anywhere in prose,
 *  mockup included, as literal required copy -- S05's own screenshot shows one
 *  example of each ("STRUCTURE · PHYSICAL INVENTORY" over "144 files grouped into 6
 *  directory districts") but foundations/03 is explicit that the mockup's own visual
 *  presentation (case, size) is not binding. Authored fresh here, in the catalogue's
 *  factual, action-oriented voice: the eyebrow mirrors the mockup's own wording
 *  case-normalised (styles.css applies the visual capitalisation via
 *  `text-transform`, so a screen reader hears words, not a shout -- foundations/03
 *  also asks that all-caps be reserved for short, low-frequency category labels,
 *  which this is). Task 12 must NOT try to pin these two the same way it pins the
 *  pair above -- they carry no catalogue id and no mockup-verbatim obligation either. */
export const COPY_CITY_HEADER_EYEBROW = 'Structure · Physical inventory';

/** Both counts are the caller's own `store.layout.lots.length` /
 *  `store.layout.districts.length` -- never re-derived or re-counted here. The
 *  footer (task 8, next) states the same two numbers; a single formatter reading a
 *  single source (the layout) is what keeps them from being able to disagree. */
export function formatCityHeaderSubtitle(fileCount: number, districtCount: number): string {
  return `${fileCount} file${fileCount === 1 ? '' : 's'} grouped into ${districtCount} directory district${districtCount === 1 ? '' : 's'}`;
}

/** Task 9 fix round 2, item 4 (Minor fold): `city-view.ts` emitted this exact
 *  string from two separate call sites (`publishLayout`'s two catch blocks),
 *  neither with a COPY id and neither named by round 1's item 9. Not in the
 *  microcopy catalogue under any id — `computeLayout`/`setLayout` failing is
 *  a genuinely unusual, hard-to-catalogue failure mode, not one of the
 *  ordinary scan/search/inspector states the catalogue enumerates. Given one
 *  definition here so both call sites stay identical by construction, not by
 *  copy-paste. */
export const CITY_RENDER_FAILURE_NOTICE = 'The city could not be rendered from the latest scan.';
