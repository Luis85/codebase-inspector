// WP-04 Part 1: the Investigate screen, its dialogs, previews, entry points, settings rows
// and note vocabulary (spec §3, global constraints "Where strings go"). Re-exported by
// inspector-copy.ts. New names use the prefixes INVESTIGATE_, PREVIEW_, NOTE_, NOTES_,
// REFRESH_, UNCERTAINTY_, CHECKLIST_, CITY_FINDINGS_ (IP40); the pre-existing
// INVESTIGATE_HOTSPOT_TITLE/_DETAIL, INVESTIGATE_MODULE_DETAIL, INVESTIGATE_FILE_TITLE,
// INVESTIGATE_LARGEST_DETAIL (inspector-copy.ts) and INVESTIGATE_FILE_LABEL are untouched
// and never redefined here.
import type { FindingCategory } from '../../application/evidence/model';
import type { NoteVocabulary } from '../../application/investigation/note-model';
import type { LocationCheck } from '../../application/investigation/stale-location';
import { FINDING_RELATED_LABEL } from './quality';

export const INVESTIGATE_EYEBROW = 'Act / Investigate';
export const INVESTIGATE_TITLE = 'From a finding to a recorded decision.';
export const INVESTIGATE_SUBTITLE = 'Check the evidence, state what is uncertain, and keep the result in a note in your vault.';
/** IN4: shown when a re-import no longer reports the selected finding. Its notes stay
 *  listed under Notes for findings not in this report (IN34, added by a later task). */
export const INVESTIGATE_FINDING_GONE = 'The finding you were investigating is not in the current report. Its notes are listed under Notes for findings not in this report.';

/** IN22 (IP3): the note's headings, prompts and labels — the words the application layer
 *  (note-model.ts) renders through; the application layer itself holds no copy. `related`
 *  reuses FINDING_RELATED_LABEL (Quality's "Also involves") rather than a second copy of
 *  the same words. */
export const NOTE_VOCABULARY: NoteVocabulary = {
  headings: {
    context: 'Context',
    observed: 'Observed finding',
    source: 'Source, scope and time',
    uncertainties: 'Uncertainties',
    notes: 'Investigation notes',
    proposed: 'Proposed change',
    checklist: 'Verification checklist',
    decision: 'Decision',
  },
  prompts: {
    notes: 'What did you check, and what did you find?',
    proposed: 'What would you change, and what would it affect?',
    decision: 'What was decided, by whom, and why?',
  },
  labels: {
    finding: 'Finding',
    kind: 'Kind',
    rule: 'Rule',
    detail: 'Detail',
    severity: 'Severity',
    location: 'Location',
    related: FINDING_RELATED_LABEL,
    cyclePath: 'Cycle path',
    provider: 'Provider',
    analysed: 'Analysed at',
    snapshot: 'Snapshot',
    evidence: 'Evidence',
    // IN34: a refreshed note for a finding the current report no longer lists.
    notReported: 'Not reported by the current analysis',
    line: (line, endLine) => (line === null ? 'Line unknown' : endLine !== null && endLine !== line ? `Lines ${line}–${endLine}` : `Line ${line}`),
    more: (hidden) => `${hidden} more`,
  },
};

// WP-04 IN15/IN17: generated factual statements only — never a score, a percentage or an
// invented risk word (Z23).
export const UNCERTAINTY_STATIC = 'Static analysis only: this is not evidence from running the code.';
export const UNCERTAINTY_REPORT_STALE = 'The report was attached to an earlier scan, so paths and lines may have changed since.';
export const UNCERTAINTY_NOT_RATED = 'fallow gives this finding no severity.';
export const UNCERTAINTY_IMPORT_TIME = 'When fallow ran is not known for an imported report; the import time is used as the latest possible analysis time.';
export const UNCERTAINTY_LINE_NOT_CHECKED = 'The reported line has not been checked against the current file.';
export const UNCERTAINTY_NO_LINE = 'fallow reports no line for this finding.';
export const UNCERTAINTY_LINE_MATCHED = (line: number): string =>
  `Line ${line} matches the file as it was analysed: same size, same line count, not modified since.`;

/** IN10's `line` argument, or "the reported line" when the finding carries none. */
const lineTerm = (line: number | null): string => (line === null ? 'the reported line' : String(line));

/** IN10/IN15: the stale-location verdict's own words, naming the failed check and cause. */
export const UNCERTAINTY_LINE_STALE = (check: LocationCheck, cause: 'changed' | 'unknown', line: number | null): string => {
  const n = lineTerm(line);
  switch (check) {
    case 'report': return `The report is stale, so line ${n} may have moved.`;
    case 'size': return `The file size ${cause === 'changed' ? 'changed' : 'is not known'} since the scan. Line ${n} may have moved.`;
    case 'lines': return `The file line count ${cause === 'changed' ? 'changed' : 'is not known'} since the scan. Line ${n} may have moved.`;
    case 'modified': return `The file ${cause === 'changed' ? 'changed after the analysis' : 'modification time is not known'}. Line ${n} may have moved.`;
    case 'line-range': return `Line ${n} is past the end of the file now.`;
    default: {
      const never: never = check;
      throw new Error(`unhandled location check: ${JSON.stringify(never)}`);
    }
  }
};

export const UNCERTAINTY_BY_KIND: Readonly<Record<FindingCategory, string>> = {
  complexity: 'Complexity is a threshold on a metric, not a defect.',
  duplication: 'Duplication is textual similarity above fallow’s threshold; the copies may differ in meaning.',
  'unused-exports': 'An unused export may still be used dynamically, by a framework convention, or by a consumer outside the analysed folder.',
  cycle: 'Type-only imports are not reported, so the cycle at run time may differ.',
  boundary: 'A boundary violation depends on the zones in the analysed folder’s fallow configuration.',
  'unresolved-import': 'An unresolved import may be a path alias fallow did not resolve.',
};

/** IN16: 2-4 suggested checks per category, seeding the note's checklist at creation (the
 *  user's own text after that). */
export const CHECKLIST_BY_KIND: Readonly<Record<FindingCategory, readonly string[]>> = {
  complexity: [
    'Read the function and confirm the reported measure.',
    'Check which tests cover the branches you would change.',
    'Decide whether a split lowers the measure without moving it elsewhere.',
  ],
  duplication: [
    'Compare every reported copy and confirm they do the same thing.',
    'Check whether the copies are meant to change together.',
    'Confirm an extraction would not couple unrelated modules.',
  ],
  'unused-exports': [
    'Search the whole repository, including other packages, for the symbol.',
    'Check dynamic imports, reflection, framework conventions and public API consumers.',
    'Confirm the symbol is not an entry point named in configuration.',
  ],
  cycle: [
    'Confirm each import in the cycle path still exists.',
    'Check whether any of the imports is type-only.',
    'Decide which dependency direction is intended.',
  ],
  boundary: [
    'Confirm the import still exists at the reported line.',
    'Check the fallow boundary configuration for the intended rule.',
    'Decide whether the rule or the import should change.',
  ],
  'unresolved-import': [
    'Check path aliases in the TypeScript or bundler configuration fallow read.',
    'Confirm the target file exists in the analysed folder.',
    'Check whether the import is generated or conditional.',
  ],
};
