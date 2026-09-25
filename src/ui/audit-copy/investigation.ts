// WP-04 Part 1: the Investigate screen, its dialogs, previews, entry points, settings rows
// and note vocabulary (spec §3, global constraints "Where strings go"). Re-exported by
// inspector-copy.ts. New names use the prefixes INVESTIGATE_, PREVIEW_, NOTE_, NOTES_,
// REFRESH_, UNCERTAINTY_, CHECKLIST_, CITY_FINDINGS_ (IP40); the pre-existing
// INVESTIGATE_HOTSPOT_TITLE/_DETAIL, INVESTIGATE_MODULE_DETAIL, INVESTIGATE_FILE_TITLE,
// INVESTIGATE_LARGEST_DETAIL (inspector-copy.ts) and INVESTIGATE_FILE_LABEL are untouched
// and never redefined here.
export const INVESTIGATE_EYEBROW = 'Act / Investigate';
export const INVESTIGATE_TITLE = 'From a finding to a recorded decision.';
export const INVESTIGATE_SUBTITLE = 'Check the evidence, state what is uncertain, and keep the result in a note in your vault.';
/** IN4: shown when a re-import no longer reports the selected finding. Its notes stay
 *  listed under Notes for findings not in this report (IN34, added by a later task). */
export const INVESTIGATE_FINDING_GONE = 'The finding you were investigating is not in the current report. Its notes are listed under Notes for findings not in this report.';
