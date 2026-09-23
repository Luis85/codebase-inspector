// Part 6: fallow report import. Re-exported by inspector-copy.ts. Tasks 7-11 add the
// dialog, card, badge and lens strings to this file.
import { FALLOW_REPORT_MAX_BYTES, FALLOW_SUPPORTED, type FallowImportErrorCode, type FallowReportKind } from '../../application/evidence/raw-fallow';

/** Fix round 1 (E31, minor 5): "16 MB", derived instead of hard-coded, so the copy and
 *  the limit it describes cannot drift apart. */
const FALLOW_MAX_SIZE_TEXT = `${FALLOW_REPORT_MAX_BYTES / (1024 * 1024)} MB`;

function supportedText(): string {
  const byKind = new Map<FallowReportKind, number[]>();
  for (const s of FALLOW_SUPPORTED) byKind.set(s.kind, [...(byKind.get(s.kind) ?? []), s.schema]);
  const parts = [...byKind].map(([kind, schemas]) => `${kind} (schema ${schemas.join(' or ')})`);
  return `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1] ?? ''}`;
}

/** Y20: "combined (schema 11 or 12), dead-code (schema 9), health (schema 11) and dupes (schema 10)". */
export const FALLOW_SUPPORTED_TEXT = supportedText();

/** Y20: names what the file is and what this version reads. `kind` and `schema` come
 *  from the file and are shown as text only. */
export const FALLOW_UNSUPPORTED = (kind: string, schema: string): string =>
  `That file is a fallow “${kind}” report at schema ${schema}, which this version cannot read. Supported: ${FALLOW_SUPPORTED_TEXT}. Nothing was imported.`;

/** Y31: one message per refusal. `detail` is `<kind>@<schema>` (or '') for
 *  `unsupported` and the first issue's path for `invalid`; the other codes ignore it.
 *  A refusal never touches evidence that is already attached. */
export const FALLOW_IMPORT_ERROR: Readonly<Record<FallowImportErrorCode, (detail: string) => string>> = {
  'too-large': () => `That file is larger than ${FALLOW_MAX_SIZE_TEXT}, so it was not read. Nothing was imported.`,
  'not-json': () => 'That file is not valid JSON. Nothing was imported.',
  unsupported: (found) => {
    const at = found.lastIndexOf('@');
    return at < 0
      ? `That file is not a fallow report this version can read. Supported: ${FALLOW_SUPPORTED_TEXT}. Nothing was imported.`
      : FALLOW_UNSUPPORTED(found.slice(0, at), found.slice(at + 1));
  },
  invalid: (at) => (at === '' ? 'That fallow report is not valid. Nothing was imported.' : `That fallow report is not valid at ${at}. Nothing was imported.`),
  // COPY-17, adapted: a fallow report names no revision, so the match is by file path.
  'source-mismatch': () => 'This report does not match the selected source: none of its findings names a file in the current snapshot, even with the offered folder mapping. Nothing was imported.',
  'read-failed': () => 'Could not read that file. Nothing was imported.',
};

/** Y25: labels for the check.summary counts Part 6 reports but does not show. */
const NOT_SHOWN_LABEL: Readonly<Record<string, string>> = {
  unused_files: 'Unused files',
  private_type_leaks: 'Private type leaks',
  unused_dependencies: 'Unused dependencies',
  unused_enum_members: 'Unused enum members',
  unused_class_members: 'Unused class members',
  unused_store_members: 'Unused store members',
  unprovided_injects: 'Unprovided injects',
  unrendered_components: 'Unrendered components',
  unused_component_props: 'Unused component props',
  unused_component_emits: 'Unused component emits',
  unused_component_inputs: 'Unused component inputs',
  unused_component_outputs: 'Unused component outputs',
  unused_svelte_events: 'Unused Svelte events',
  unused_server_actions: 'Unused server actions',
  unused_load_data_keys: 'Unused load data keys',
  unresolved_imports: 'Unresolved imports',
  unlisted_dependencies: 'Unlisted dependencies',
  duplicate_exports: 'Duplicate exports',
  type_only_dependencies: 'Type-only dependencies',
  test_only_dependencies: 'Test-only dependencies',
  dev_dependencies_in_production: 'Dev dependencies used in production',
  circular_dependencies: 'Circular dependencies',
  re_export_cycles: 'Re-export cycles',
  boundary_violations: 'Boundary violations',
  boundary_coverage_violations: 'Boundary coverage violations',
  boundary_call_violations: 'Boundary call violations',
  policy_violations: 'Policy violations',
  stale_suppressions: 'Stale suppressions',
  unused_catalog_entries: 'Unused catalog entries',
  empty_catalog_groups: 'Empty catalog groups',
  unresolved_catalog_references: 'Unresolved catalog references',
  unused_dependency_overrides: 'Unused dependency overrides',
  misconfigured_dependency_overrides: 'Misconfigured dependency overrides',
  invalid_client_exports: 'Invalid client exports',
  mixed_client_server_barrels: 'Mixed client/server barrels',
  misplaced_directives: 'Misplaced directives',
  route_collisions: 'Route collisions',
  dynamic_segment_name_conflicts: 'Dynamic segment name conflicts',
  clone_groups_omitted: 'Clone groups left out of the report',
};

/** Y25: a key missing from the map is shown by its raw key. Own keys only, so a key such
 *  as "constructor" from the file never reaches Object.prototype. */
export const fallowNotShownLabel = (key: string): string =>
  (Object.prototype.hasOwnProperty.call(NOT_SHOWN_LABEL, key) ? NOT_SHOWN_LABEL[key] : undefined) ?? key;

// Part 6 Y39: the command palette entry.
export const FALLOW_COMMAND_IMPORT = 'Import analysis report';

// Part 6 Y30/Y33/Y34 (Task 8): imported evidence in the read models.
export const FALLOW_NOT_ANALYSED = 'Not analysed. No imported fallow report covers this.';
export const FALLOW_SOME_NOT_ANALYSED = 'Some finding categories were not analysed in the imported report.';
/** MetricValue provenance detail for an imported value (Y33). */
export const FALLOW_PROVENANCE_DETAIL = (version: string): string => `imported report ${version}`;
/** Overview findings card caption; `high` is already formatted (a count, or the no-value mark). */
export const OVERVIEW_FINDINGS_CAPTION = (high: string): string => `${high} critical or high severity`;
/** Overview evidence-coverage row (R6: replaces the sample "Static signals" row). */
export const OVERVIEW_FALLOW_ROW = 'Static findings (fallow)';
export const OVERVIEW_FALLOW_SOURCE = (version: string): string => `Imported fallow ${version} report`;
/** S22 / COPY-16 (Y30): the stale-evidence notice. Tasks 9 and 11 show it. */
export const COPY_16 = (absoluteDate: string): string => `Showing evidence from ${absoluteDate}. It is not current for this snapshot.`;

/* Part 6 Task 9 (Y32, Y35, Y36): the evidence badge and the Not-analysed state. COPY_16 is Task 8's (R4). */
/** C13 (R8): provider, version, freshness and source match, in words. A fallow report carries
 *  no root or revision, so the match is always unverified (Y27). */
export const EVIDENCE_BADGE = (version: string, state: 'imported' | 'stale'): string =>
  `fallow ${version} · ${state === 'stale' ? 'Stale' : 'Imported'} · Unverified source match`;
export const FALLOW_NOT_ANALYSED_TITLE = 'Not analysed';
export const FALLOW_NOT_ANALYSED_BODY = 'No fallow report is attached to this codebase, so its findings are unknown, not zero. Import a report to see them. Imported reports are kept for this session only.';
export const FALLOW_IMPORT_ACTION = 'Import report…';

/* Part 6 Task 10 (Y31, Y37, Y38): the fallow card on Data & scans and the S14 dialog. */
/** Exported for Task 11's lens copy (E17), which counts the same way. */
export const nounCount = (n: number, one: string, many: string): string => `${n.toLocaleString('en-US')} ${n === 1 ? one : many}`;
export const FALLOW_SOURCE = (version: string): string => `Imported report · fallow ${version}`;
export const FALLOW_CARD_NONE = 'No report attached. An imported report is kept for this session only, so after a restart it is imported again.';
export const FALLOW_IMPORT_HINT = 'Open a codebase first: report paths are matched to the codebase on screen.';
export const FALLOW_REMOVE = 'Remove report';
export const FALLOW_REMOVE_TITLE = 'Remove the fallow report?';
export const FALLOW_REMOVE_TEXT = 'Its findings leave every screen and read Not analysed. Your finding decisions are kept, and you can import the report again.';
export const FALLOW_REMOVE_CANCEL = 'Cancel';
export const FALLOW_REMOVED = 'fallow report removed. Findings read Not analysed.';
export const FALLOW_DIALOG_EYEBROW = 'Add evidence';
export const FALLOW_DIALOG_TITLE = 'Connect fallow';
export const FALLOW_DIALOG_INTRO = 'Keep exploring the structural city while you add analysis. Import a fallow JSON report: it is checked and matched to this snapshot, and no analyser is run.';
export const FALLOW_DISCLOSURE = 'The plugin does not download or install fallow. Imported reports cannot authorize commands or source access.';
export const FALLOW_SNAPSHOT_FILES = (n: number): string => `Current structural snapshot: ${nounCount(n, 'file', 'files')}`;
export const FALLOW_CHOOSE = 'Choose report…';
export const FALLOW_CANCEL = 'Cancel';
export const FALLOW_REVIEW_TITLE = 'Review the report';
export const FALLOW_ATTACH = 'Attach report';
export const FALLOW_MATCHED = (findings: number, files: number): string =>
  `${nounCount(findings, 'finding', 'findings')} in ${nounCount(files, 'file', 'files')}`;
export const FALLOW_ATTACHED = (findings: number, files: number): string => `fallow report attached: ${FALLOW_MATCHED(findings, files)}.`;
export const FALLOW_ATTACH_REFUSED = 'The report was not attached. Open the codebase again, then import the report.';
/** Y26: offered unchecked; nothing is mapped without the user's choice. */
export const FALLOW_MAPPING_OFFER = (prefix: string): string => `Match paths by removing the leading folder “${prefix}”`;
export const FALLOW_REPLACE_NOTE = (date: string): string => `Attaching replaces the report imported ${date}.`;
export const FALLOW_ROW_REPORT = 'Report';
export const FALLOW_ROW_FILE = 'File';
export const FALLOW_ROW_IMPORTED = 'Imported';
export const FALLOW_ROW_CATEGORIES = 'Categories';
export const FALLOW_ROW_MATCHED = 'Matched';
export const FALLOW_ROW_UNMATCHED = 'Unmatched paths';
export const FALLOW_ROW_NOT_SHOWN = 'Reported, not shown in this version';
export const FALLOW_ROW_WARNINGS = 'Warnings';
export const FALLOW_REPORT_VALUE = (version: string, kind: string, schema: number): string => `fallow ${version} · ${kind} report · schema ${schema}`;
export const FALLOW_CATEGORY_LINE = (label: string, state: 'analysed' | 'not-analysed'): string =>
  `${label}: ${state === 'analysed' ? 'Analysed' : 'Not analysed'}`;
export const FALLOW_UNMATCHED_SUMMARY = (total: number, shown: number): string =>
  `${nounCount(total, 'path', 'paths')} not in this snapshot${shown < total ? ` · the first ${shown} are listed` : ''}`;
/** Y25 (R4): `label` is fallowNotShownLabel(key). */
export const FALLOW_NOT_SHOWN_ITEM = (label: string, count: number): string => `${label}: ${count.toLocaleString('en-US')}`;
export const FALLOW_NONE = 'None';

// Part 6 Task 11 (Y40): the findings lens. Counts go through nounCount, so the lens and the
// fallow card format them the same way (E17).
export const LENS_LABEL = 'Colour';
export const LENS_OPTION_CATEGORY = 'Category';
export const LENS_OPTION_FINDINGS = 'Reported findings';
export const LENS_EYEBROW = 'fallow lens';
export const LENS_TITLE = 'Reported findings';
export const LENS_SUBTITLE = (findings: number, files: number): string =>
  `${nounCount(findings, 'finding', 'findings')} · ${nounCount(files, 'file', 'files')} · imported evidence`;
export const LENS_LEGEND_REPORTED = 'Reported finding';
export const LENS_LEGEND_NONE = 'No finding reported · metric unavailable';
export const LENS_LIST_COLUMN = 'Reported';
export const LENS_LIST_NONE = '—';
/** Screen-reader text after a row's path, so the name reads "…/file-4.ts, 3 reported findings". */
export const LENS_LIST_CELL = (count: number): string =>
  (count === 0 ? ', no finding reported' : `, ${nounCount(count, 'reported finding', 'reported findings')}`);
