// Part 6 Y6–Y9: the durable review store's refusals (the ReviewStoreError messages; the
// review store's existing failure paths announce their own *_FAILED copy, spec §4, and R9
// leaves the codes unmapped by screens in Part 6) and Y7's Settings › Privacy & storage
// line. Re-exported by inspector-copy.ts.
function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}
/** Y9: a save that would take one codebase's saved review state over 1 MB. */
export const REVIEW_STORE_FULL = 'The saved review state for this codebase has reached its 1 MB limit, so this change was not saved. Remove work items or decisions, or export the review state and clear it.';
/** Y7: a saved set in a format this version cannot change. It is never overwritten. */
export const REVIEW_STORE_UNSUPPORTED = 'The saved review state for this codebase is in a format this version cannot change, so this change was not saved.';
/** Y6: a record whose file or finding cannot be saved as a path inside this codebase. */
export const REVIEW_SAVE_UNREPRESENTABLE = 'This change refers to something that cannot be saved as a path inside this codebase, so it was not saved.';
/** Y7: Settings › Privacy & storage, while n saved records could not be read. */
export const REVIEW_RECORDS_SKIPPED = (n: number): string =>
  `${plural(n, 'saved review record', 'saved review records')} could not be read, so ${n === 1 ? 'it is' : 'they are'} not shown. ${n === 1 ? 'It stays' : 'They stay'} in the plugin’s data file, unchanged.`;
/** Y7: Settings › Privacy & storage, while the saved set is read-only. */
export const REVIEW_STORE_UNSUPPORTED_NOTE = 'The saved review state for this codebase was written in a format this version cannot read. It is kept unchanged, the lists start empty, and changes to them cannot be saved.';
/** Part 6 R1/R3: Settings › Privacy & storage, while the bound codebase's last load failed. */
export const REVIEW_STORE_READ_FAILED = 'The saved review state for this codebase could not be read, so its lists start empty here. Nothing on disk was changed; close and reopen this tab to try again.';
/** Part 6 Y17/E29: the plugin settings Notice when a profile was removed but its purge failed. */
export const PROFILE_REVIEW_PURGE_FAILED = (reason: string): string =>
  `The profile was removed, but its saved review decisions could not be deleted: ${reason}`;
