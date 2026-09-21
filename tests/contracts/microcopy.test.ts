// interactions/04-microcopy.md is the catalogue; src/ui/copy.ts is what ships. Nothing
// bound them, so a string could drift from its own source with nothing able to notice.
//
// Fix round 1: the first pass filtered exports by `typeof === 'string'`, which silently
// dropped every formatter — including three (formatCopy08/11/13, and formatUnavailableReason,
// which reuses COPY-18's pattern) whose FIXED text is catalogued wording around an
// interpolated placeholder. A formatter is pinned by deriving the expected text from its
// own catalogue row (substituting the row's `{placeholder}` tokens with the same values
// passed to the formatter) rather than retyping the sentence a second time in this file —
// the catalogue stays the single source, exactly as it does for the plain-string pins.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import * as copy from '../../src/ui/copy';

const catalogue = readFileSync('docs/concept/design/interactions/04-microcopy.md', 'utf8');

// Only the strings that HAVE a catalogue id (a `| COPY-nn |` table row). Strings
// authored fresh, or mockup-verbatim but catalogue-absent, are listed in
// AUTHORED_FRESH instead, so the difference stays visible rather than being hidden by
// an incomplete map. Each PINNED entry is checked against ITS OWN table row (not just
// the catalogue file as a whole) so a short or generic string cannot pass by matching
// some unrelated row.
const PINNED: ReadonlyArray<readonly [string, string]> = [
  ['COPY_01', copy.COPY_01],
  ['COPY_02', copy.COPY_02],
  ['COPY_03', copy.COPY_03],
  ['COPY_04', copy.COPY_04],
  ['COPY_05', copy.COPY_05],
  ['COPY_06', copy.COPY_06],
  ['COPY_07', copy.COPY_07],
  ['COPY_09', copy.COPY_09],
  ['COPY_10', copy.COPY_10],
  ['COPY_12', copy.COPY_12],
  ['COPY_14', copy.COPY_14],
  ['COPY_27', copy.COPY_27],
  ['COPY_28', copy.COPY_28],
  // COPY-30: the catalogue's own row is the full sentence, including the tail that
  // Task 9 turned into two real buttons ("Reveal file" / "Clear selection").
  // `store.banner` (city-store.ts) still returns this exact, unchanged string for
  // whatever else reads it — this pins THAT export, not any one rendered DOM node.
  ['COPY_30', copy.COPY_30],
];

// Row anchors: the literal `| COPY-nn |` prefix each pinned id's table row starts
// with, so a match must land in the row that actually claims that id — not merely
// anywhere in a ~50-row markdown table. Shared by the plain-string pins above and the
// formatter pins below.
const ROW_ANCHORS = new Map<string, string>([
  ['COPY_01', '| COPY-01 |'],
  ['COPY_02', '| COPY-02 |'],
  ['COPY_03', '| COPY-03 |'],
  ['COPY_04', '| COPY-04 |'],
  ['COPY_05', '| COPY-05 |'],
  ['COPY_06', '| COPY-06 |'],
  ['COPY_07', '| COPY-07 |'],
  ['COPY_09', '| COPY-09 |'],
  ['COPY_10', '| COPY-10 |'],
  ['COPY_12', '| COPY-12 |'],
  ['COPY_14', '| COPY-14 |'],
  ['COPY_27', '| COPY-27 |'],
  ['COPY_28', '| COPY-28 |'],
  ['COPY_30', '| COPY-30 |'],
  ['formatCopy08', '| COPY-08 |'],
  ['formatCopy11', '| COPY-11 |'],
  ['formatCopy13', '| COPY-13 |'],
  ['formatUnavailableReason', '| COPY-18 |'],
]);

const catalogueRows = new Map(
  catalogue
    .split('\n')
    .filter((line) => line.startsWith('| COPY-'))
    .map((line) => [line.slice(0, line.indexOf('|', 2) + 1), line] as const),
);

function ownRow(id: string): string {
  const anchor = ROW_ANCHORS.get(id);
  if (anchor === undefined) {
    throw new Error(`${id}: no row anchor configured in this test`);
  }
  const row = catalogueRows.get(anchor);
  if (row === undefined) {
    throw new Error(`${id}: no catalogue row found for anchor "${anchor}"`);
  }
  return row;
}

// Formatters whose FIXED text (the part around the `{placeholder}` tokens) is
// catalogued wording. `actual` is the formatter's real return value for the sample
// arguments; `substitutions` maps each of the row's own placeholder tokens to the same
// values used to produce `actual`, so `expected` is derived from the row, never
// retyped. formatUnavailableReason reuses COPY-18's exact pattern ("Not measured.
// {reason}") for a core §4.1 unavailable-Observation reason (task-9-brief.md's own
// "surfaces the REASON" requirement) even though COPY-18's own CONTEXT column
// ("Unknown metric") names a provider concept out of WP-01 scope per
// plan-global-constraints.md's curated table — the TEXT PATTERN is reused verbatim
// rather than the feature, and pinning it is what would catch that pattern drifting.
const FORMATTER_PINNED: ReadonlyArray<{
  readonly id: string;
  readonly actual: string;
  readonly substitutions: ReadonlyArray<readonly [token: string, value: string]>;
}> = [
  {
    id: 'formatCopy08',
    actual: copy.formatCopy08(5),
    substitutions: [['{count}', '5']],
  },
  {
    id: 'formatCopy11',
    actual: copy.formatCopy11(5, 'auth'),
    substitutions: [['{count}', '5'], ['{query}', 'auth']],
  },
  {
    id: 'formatCopy13',
    actual: copy.formatCopy13(3, 7),
    substitutions: [['{measured}', '3'], ['{included}', '7']],
  },
  {
    id: 'formatUnavailableReason',
    actual: copy.formatUnavailableReason('metric requires a provider that is not installed'),
    substitutions: [['{reason}', 'metric requires a provider that is not installed']],
  },
];

// Every exported string written for this plugin that does NOT carry a catalogue id,
// each with a one-line reason. A string here must NOT also appear in PINNED, and vice
// versa — the completeness test below enforces that every export lands in exactly the
// union of the two lists.
const AUTHORED_FRESH: readonly string[] = [
  // Task 9 (F13): COPY-30's own lead sentence, sliced from COPY_30 itself (never
  // retyped) so it cannot drift from the catalogued sentence it is a fragment of. It
  // carries no catalogue id of its own — COPY-30 is pinned above as the full string.
  'COPY_30_EXPLANATION',
  // Spec 5.2 / 10 factual claims, gated on G2 evidence (gate-evidence.md section G2).
  // Not microcopy-catalogue entries: they are assertions about product behaviour, not
  // a cataloged state/outcome message.
  'CLAIM_READ_ONLY_ACCESS',
  'CLAIM_SOURCE_UNCHANGED',
  // Task 9 fix round 1 item 9: deliberately NOT COPY-04 (that's the permission
  // modal's own call-to-action label); this names a STATE where that control has not
  // yet been used. Authored fresh, no catalogue id.
  'COPY_READ_NOT_APPROVED',
  // Task 9 fix round 1 item 9: a bare scan-completion announcement has no catalogue
  // id (COPY-08 covers only in-progress; the others cover non-success outcomes).
  'ANNOUNCE_SCAN_COMPLETE',
  // Spec §4.2 WebGL context loss has no COPY id; authored fresh.
  'CONTEXT_LOST_NOTICE',
  // S05 mockup-verbatim (docs/concept/design/mockups/s05-city.png), grepped against
  // the catalogue and absent from it — the catalogue covers states/outcomes, not a
  // panel's own heading or status badge.
  'COPY_CITY_HEADER_TITLE',
  'COPY_CITY_HEADER_BADGE',
  // Canvas header eyebrow: authored fresh, mirrors the mockup's wording
  // case-normalised, but not quoted anywhere as literal required copy.
  'COPY_CITY_HEADER_EYEBROW',
  // Task 9 fix round 2 item 4: computeLayout/setLayout failing has no COPY id — an
  // unusual, hard-to-catalogue failure mode, not one of the ordinary scan/search/
  // inspector states the catalogue enumerates.
  'CITY_RENDER_FAILURE_NOTICE',
  // Task 8 (F6): the equal-lot meaning was never explained anywhere; no catalogue id.
  'LEGEND_EQUAL_LOT',
  // C11: selection-as-outline explanation; no catalogue id.
  'LEGEND_SELECTION_OUTLINE',
  // C11 + interactions/03: the unknown-metric marker explanation; no catalogue id.
  'LEGEND_UNKNOWN_MARKER',
];

// Formatter exports whose fixed text is NOT catalogued wording, each with a one-line
// reason. Grepped individually against the catalogue (none matched any row).
const AUTHORED_FRESH_FORMATTERS: readonly string[] = [
  // Not catalogued: selection itself has no COPY id (spec 5.2's control-initiated
  // announcement; what a selected file's measurements ARE is catalogued, selecting it
  // is not).
  'formatAnnounceSelected',
  // Not catalogued: a panel's own heading/count, not a state or outcome.
  'formatFileListHeader',
  'formatFileListGroup',
  // Not catalogued: a control's accessible name, not a state or outcome.
  'formatDirectoryFocusLabel',
  // Not catalogued: task-9-context.md finding 3's own retained-snapshot requirement,
  // layered onto run-state.ts's `Scan failed: {message}` which itself is not a COPY id.
  'formatFailedRefreshNotice',
  // Not catalogued: the canvas header's subtitle formatter (task 7); see
  // COPY_CITY_HEADER_EYEBROW's reason above for the same provenance.
  'formatCityHeaderSubtitle',
  // Not catalogued: task 8 (C12) scope-and-count line; reads the same two counts as
  // formatCityHeaderSubtitle from a single source, but is its own authored sentence.
  'formatSnapshotScopeCounts',
  // Not catalogued: implements the catalogue's PROSE RULE ("redact local absolute
  // paths by default") rather than restating a catalogued sentence — a rule is not a
  // pinnable template.
  'formatSnapshotScopeRoot',
  // Not catalogued: implements the "Units and dates" section's PROSE RULE (date, time
  // zone, snapshot identity in evidence details), not a templated COPY row.
  'formatAbsoluteTime',
];

describe('microcopy catalogue binding', () => {
  it('ships every catalogued string exactly as the catalogue writes it', () => {
    for (const [id, value] of PINNED) {
      const row = ownRow(id);
      expect(row, `${id} is not in its own catalogue row as shipped`).toContain(value);
    }
  });

  it('ships every catalogued formatter\'s fixed text exactly as the catalogue writes it', () => {
    for (const { id, actual, substitutions } of FORMATTER_PINNED) {
      const row = ownRow(id);
      let expectedFragment = row;
      for (const [token, value] of substitutions) {
        expectedFragment = expectedFragment.split(token).join(value);
      }
      expect(
        expectedFragment,
        `${id}'s own catalogue row, with its placeholders substituted the same way ${id} was called, does not contain what ${id} actually returned`,
      ).toContain(actual);
    }
  });

  it('accounts for every exported string and formatter, so none is uncatalogued by accident', () => {
    const exportedStrings = Object.entries(copy).filter(([, v]) => typeof v === 'string').map(([k]) => k);
    const exportedFunctions = Object.entries(copy).filter(([, v]) => typeof v === 'function').map(([k]) => k);

    const pinnedStringNames = PINNED.map(([id]) => id);
    const pinnedFormatterNames = FORMATTER_PINNED.map(({ id }) => id);

    // No export may be claimed by both lists in its own domain — that would hide a
    // real ambiguity about which provenance actually applies.
    expect(
      pinnedStringNames.filter((id) => AUTHORED_FRESH.includes(id)),
      'exported strings claimed by both PINNED and AUTHORED_FRESH',
    ).toEqual([]);
    expect(
      pinnedFormatterNames.filter((id) => AUTHORED_FRESH_FORMATTERS.includes(id)),
      'exported formatters claimed by both FORMATTER_PINNED and AUTHORED_FRESH_FORMATTERS',
    ).toEqual([]);

    const accountedStrings = new Set([...pinnedStringNames, ...AUTHORED_FRESH]);
    const accountedFunctions = new Set([...pinnedFormatterNames, ...AUTHORED_FRESH_FORMATTERS]);

    expect(exportedStrings.filter((name) => !accountedStrings.has(name))).toEqual([]);
    expect(exportedFunctions.filter((name) => !accountedFunctions.has(name))).toEqual([]);
  });
});
