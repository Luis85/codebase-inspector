// WP-02 user-facing strings. Sourced from docs/concept/prototype (screen-map.json and the
// screen specification), NOT from the WP-01 microcopy catalogue — which is why they live
// here and not in copy.ts (bound to that catalogue by tests/contracts/microcopy.test.ts).
import { CANCEL } from './audit-copy/shared';
import { RELATIONS_SCOPE_NOTE } from './audit-copy/relations';
export const SAMPLE_DATA_NOTICE = 'Includes sample data';
export const SAMPLE_DATA_DETAIL = 'Values marked Sample are illustrative, not measured from this codebase.';
export const OVERVIEW_EYEBROW = 'Workspace / Overview';
export const OVERVIEW_TITLE = 'A clearer picture of your codebase.';
export const OVERVIEW_SUBTITLE = 'Understand the signals. Follow the evidence. Improve what matters.';
export const OVERVIEW_VERDICT_TITLE = 'A review is recommended, not a verdict.';
/** Final review item 6: the verdict sentence, the hotspot table's caption — relocated
 *  verbatim out of OverviewScreen.vue. */
export const OVERVIEW_VERDICT_BODY = (hotspots: string, files: number): string =>
  `${hotspots} change hotspots deserve investigation across ${files} files.`;
export const OVERVIEW_HOTSPOTS_TABLE_CAPTION = 'Top change hotspots';
export const OVERVIEW_NO_SNAPSHOT = 'No snapshot yet. Select a codebase and run a scan to see its overview.';

/** Task 9: the Overview screen's own inline button labels and panel titles/subtitles/
 *  footnotes (task-9-brief.md Step 3), centralised here rather than left as literals in
 *  OverviewScreen.vue — this file's own copy-centralisation constraint binds brief
 *  snippets too. Text is prototype-verbatim (unchanged from the brief), only relocated. */
export const OVERVIEW_COMPARE_LABEL = 'Compare';
export const OVERVIEW_AUDIT_REPORT_LABEL = 'Audit report';
export const OVERVIEW_VIEW_EVOLUTION_LABEL = 'View evolution';
export const OVERVIEW_ALL_HOTSPOTS_LABEL = 'All hotspots';
export const OVERVIEW_DATA_SOURCES_LABEL = 'Data sources';
export const OVERVIEW_SIGNALS_PANEL_TITLE = 'Signals over time';
export const OVERVIEW_SIGNALS_PANEL_SUBTITLE = 'Compare independent signals, not one opaque health score.';
export const OVERVIEW_SIGNALS_PANEL_FOOTNOTE = 'Sample trend · branch coverage and file count use different units.';
export const OVERVIEW_INVESTIGATIONS_PANEL_TITLE = 'Start investigating';
export const OVERVIEW_INVESTIGATIONS_PANEL_SUBTITLE = 'Three evidence-backed review paths.';
export const OVERVIEW_HOTSPOTS_PANEL_TITLE = 'Where change meets complexity';
export const OVERVIEW_HOTSPOTS_PANEL_SUBTITLE = 'Priority is a transparent investigation heuristic.';
export const OVERVIEW_COVERAGE_PANEL_TITLE = 'Evidence coverage';
export const OVERVIEW_COVERAGE_PANEL_SUBTITLE = 'Know what this inspector does — and does not — show.';
export const CITY_EYEBROW = 'Explore / Code city';
export const CITY_TITLE = 'Code city';
export const CITY_SUBTITLE = 'Find the places worth investigating. Every building is a file.';
/** Task 10: the City screen's own "View inventory" header action, centralised here
 *  rather than left as a literal in CityScreen.vue — this file's own copy-
 *  centralisation constraint binds brief snippets too. */
export const CITY_VIEW_INVENTORY_LABEL = 'View inventory';
export const NO_CODEBASE_LABEL = 'No codebase selected';
export const SEARCH_TRIGGER_LABEL = 'Search anything…';
export const COMMAND_PALETTE_LABEL = 'Command palette';
export const COMMAND_PALETTE_PLACEHOLDER = 'Go to a screen or file…';
export const COMMAND_PALETTE_EMPTY = 'No matching screens or files.';
export const ADD_TO_PLAN_LABEL = 'Add to refactor plan';
export const IN_PLAN_LABEL = 'In refactor plan';
/** Fix round 1 (Important): the FileInspector's polite-live-region message when
 *  `addToPlan` rejects (the review repository failed to persist the work item). */
export const ADD_TO_PLAN_FAILED = 'Could not add this file to the refactor plan.';
/** Fix round 1 (Minor 3): the work item's own title, centralised rather than built
 *  inline in FileInspector.vue. */
export const WORK_ITEM_TITLE = (name: string): string => `Investigate ${name}`;
export const OPEN_NAVIGATION_LABEL = 'Open navigation';
export const CLOSE_NAVIGATION_LABEL = 'Close navigation';
export const SNAPSHOT_LABEL = 'Snapshot';
export const NO_SNAPSHOT_LABEL = 'No snapshot';

/** Part 2 §4 (A13): reasons that used to be inline literals in the read models. */
export const NO_FILES_REASON = 'No files in this scan.';
export const PRIORITY_UNKNOWN_REASON = 'Priority needs complexity, commits and branch coverage.';
/** Part 2 P1: files at the root form one module, never shown as "(root)". */
export const ROOT_FILES_LABEL = 'Root files';
export const PROTECT_MODULE_TITLE = (label: string, isRoot: boolean): string =>
  (isRoot ? 'Protect the root files' : `Protect the ${label} module`);
/** WP-03 N26: `violations` is a pre-formatted clause — a count ("1 boundary violations")
 *  or ARCH_VIOLATIONS_NOT_CONFIGURED — built by overview.ts from the relation model. */
export const OVERVIEW_ARCH_CAPTION = (violations: string): string => `Import cycles · ${violations}`;

/** Final review F2: the Overview's investigation paths, relocated verbatim from overview.ts. */
export const INVESTIGATE_HOTSPOT_TITLE = (name: string): string => `Review ${name}`;
export const INVESTIGATE_HOTSPOT_DETAIL = (complexity: string, commits: string, coverage: string): string =>
  `Complexity ${complexity} · ${commits} commits in 90 days · ${coverage} branch coverage.`;
export const INVESTIGATE_MODULE_DETAIL = (coverage: string, files: number): string =>
  `${coverage} branch coverage across ${files} files.`;
export const INVESTIGATE_FILE_TITLE = (name: string): string => `Inspect ${name}`;
export const INVESTIGATE_LARGEST_DETAIL = (lines: string): string => `${lines} lines — the largest file in this scan.`;
export const INVESTIGATE_NO_LINES = 'Line count unavailable for this file.';

/** Final review F2: evidence.ts fallback reasons (evidence.ts imports these; this file
 *  imports nothing, so there is no cycle). */
export const AGGREGATE_EMPTY_REASON = 'Nothing to aggregate.';
export const AGGREGATE_NO_VALUE_REASON = 'No input has a value.';
export const AGGREGATE_MISSING_REASON = (missing: number, total: number): string => `${missing} of ${total} inputs missing.`;
export const RATIO_NUMERATOR_REASON = 'Numerator unavailable.';
export const RATIO_DENOMINATOR_REASON = 'Denominator unavailable.';
export const RATIO_ZERO_REASON = 'Nothing to divide by.';
/** The one "no value" mark, and the priority scale suffix shown after a priority value. */
export const NO_VALUE = '—';
export const PRIORITY_SCALE_SUFFIX = ' / 100';

/** Part 2 §2.1: Architecture cards and read-model reasons. */
export const ARCH_CARD_MODULES = 'Modules';
export const ARCH_CARD_VIOLATIONS = 'Boundary violations';
export const ARCH_MODULES_OMITTED_CAPTION = (shown: number): string => `The ${shown} largest are shown in the graph`;
export const ARCH_VIOLATIONS_CAPTION = (failing: number): string => `${failing} of your rules violated`;
/** WP-03 JF11: reworded — the module graph is evidenced imports now, never sample. */
export const RULE_NOT_EVALUATED_REASON = 'A module in this rule is not in the module graph.';

/** Part 2 §2.3: File detail cards, history and findings. */
export const NOT_MEASURED_REASON = 'Not measured in this scan.';
export const FILE_CARD_COMPLEXITY = 'Max. cognitive complexity';
export const FILE_CARD_COMPLEXITY_CAPTION = 'Highest function-level value, not a file sum';
export const FILE_CARD_COVERAGE = 'Branch coverage';
export const FILE_CARD_COVERAGE_CAPTION = (covered: string, total: string): string => `${covered} of ${total} instrumented branches`;
export const FILE_CARD_PRIORITY = 'Review priority';
export const FILE_CARD_PRIORITY_CAPTION = 'Heuristic, not a failure probability';
export const FILE_HISTORY_COMPLEXITY = 'Max. complexity';
export const FILE_HISTORY_COVERAGE = 'Branch coverage (%)';

/** Part 2 §2.1: Architecture screen. */
export const SCREEN_NO_SNAPSHOT = 'No snapshot yet. Select a codebase and run a scan to see this screen.';
export const ARCH_EYEBROW = 'Explore / Architecture';
export const ARCH_TITLE = 'Architecture, without the guesswork.';
export const ARCH_SUBTITLE = 'Explore module dependencies and compare them with your intended boundaries.';
export const ARCH_VIEWS_LABEL = 'Architecture views';
export const ARCH_TAB_MAP = 'Dependency map';
export const ARCH_TAB_MATRIX = 'Dependency matrix';
export const ARCH_VIOLATIONS_ONLY = 'Violations only';
/** WP-03 JF11: = RELATIONS_SCOPE_NOTE, so the footnote never disagrees with the rest of
 *  the app about what an edge here means. */
export const ARCH_MAP_FOOTNOTE = RELATIONS_SCOPE_NOTE;
export const ARCH_MAP_EYEBROW = 'Module graph · evidenced imports';
export const ARCH_NODE_LABEL = (label: string, files: number, outgoing: number, incoming: number): string =>
  `${label}, ${files} files, ${outgoing} outgoing, ${incoming} incoming, evidenced imports`;
export const ARCH_NODE_FILES = (files: number): string => `${files} files`;
export const ARCH_OMITTED_NOTE = (n: number): string => `${n} smaller modules are not shown in the graph.`;
export const ARCH_MATRIX_CAPTION = 'Evidenced imports from each row module to each column module';
export const ARCH_MATRIX_CORNER = 'From ↓ / To →';
export const ARCH_MATRIX_SELF = 'Same module';
export const ARCH_MATRIX_NO_EDGE = 'No evidenced imports';
export const ARCH_MATRIX_CELL_LABEL = (from: string, to: string, n: string): string => `${from} imports ${to}: ${n} evidenced import statements`;
export const ARCH_MODULE_INSPECTOR_TITLE = 'Selected module';
export const ARCH_MODULE_NONE = 'Select a module in the map.';
export const ARCH_FACT_FILES = 'Files';
export const ARCH_FACT_LINES = 'Lines';
export const ARCH_FACT_IMPORTS = 'Imports';
export const ARCH_FACT_IMPORTED_BY = 'Imported by';
/** WP-03 N5: the module inspector's neighbour lists hold only EVIDENCED imports, so an empty
 *  list is "none evidenced", never "no imports". */
export const ARCH_NONE = 'None evidenced';
export const ARCH_TOP_FILES = 'Highest review priority';

/** Part 2 §2.1: boundary rules (P5). */
export const ARCH_TAB_RULES = 'Boundary rules';
export const ARCH_ADD_RULE = 'Add boundary rule';
export const RULE_EDITOR_TITLE = 'Add boundary rule';
export const RULE_EDITOR_HINT = 'Record an intended boundary. It is evaluated against the evidenced imports.';
export const RULE_EDITOR_FROM = 'Module';
export const RULE_EDITOR_TO = 'must not import';
export const RULE_EDITOR_RATIONALE = 'Rationale';
export const RULE_EDITOR_SAVE = 'Save rule';
export const RULE_EDITOR_CANCEL = CANCEL;
export const RULE_EDITOR_SAME_MODULE = 'Choose two different modules.';
export const RULE_EDITOR_DUPLICATE = 'A rule for these two modules already exists.';
export const RULE_EDITOR_FAILED = 'Could not save this rule.';
export const RULES_EMPTY = 'No boundary rules yet. Add one to compare an intended boundary with fallow\'s evidenced imports.';
export const RULES_TABLE_CAPTION = 'Boundary rules';
export const RULE_COL_ID = 'Rule';
export const RULE_COL_RULE = 'Boundary';
export const RULE_COL_STATUS = 'Status';
export const RULE_COL_IMPORTS = 'Violating imports';
export const RULE_COL_ACTIONS = 'Actions';
export const RULE_SENTENCE = (from: string, to: string): string => `${from} must not import ${to}`;
export const RULE_STATUS_LABEL: Readonly<Record<'violation' | 'not-evaluated', string>> = {
  violation: 'Violation', 'not-evaluated': 'Not evaluated',
};
export const RULE_REMOVE = 'Remove';
export const RULE_REMOVE_LABEL = (id: string): string => `Remove rule ${id}`;
export const RULE_SHOW = 'Show';
export const RULE_SHOW_LABEL = (id: string): string => `Show rule ${id}`;
export const RULE_REMOVE_FAILED = 'Could not remove this rule.';
export const BOUNDARY_INSPECTOR_TITLE = 'Boundary inspector';
export const BOUNDARY_INSPECTOR_SUBTITLE = 'Intended rule vs. evidenced imports.';
export const BOUNDARY_VIOLATING_IMPORTS = 'Violating imports';
export const BOUNDARY_EDGE_IMPORTS = (n: string): string => `${n} evidenced import statements`;
export const BOUNDARY_EDGE_VIOLATES = 'This edge breaks a boundary rule.';
export const BOUNDARY_EDGE_NO_RULE = 'No boundary rule covers this edge.';
export const BOUNDARY_NONE = 'Select a rule or a matrix cell to inspect it.';

/** Part 2 §2.2: Hotspots screen. */
export const HOTSPOTS_EYEBROW = 'Explore / Hotspots';
export const HOTSPOTS_TITLE = 'Focus effort where it can matter.';
export const HOTSPOTS_SUBTITLE = 'Review files that combine difficult logic, repeated change and weak safety nets.';
export const HOTSPOTS_HOW_PRIORITY = 'How priority works';
export const HOTSPOTS_EXPORT = 'Export shortlist';
export const HOTSPOTS_CSV_FILENAME = 'codebase-hotspots.csv';
export const HOTSPOTS_SCATTER_TITLE = 'Complexity × change frequency';
export const HOTSPOTS_SCATTER_SUBTITLE = 'Each dot is one file. Select a dot to inspect its evidence.';
export const HOTSPOTS_SCATTER_FOOTNOTE = 'Size: source lines (ring: unknown) · Colour: branch coverage · Window: 90 days · Sample signals';
export const HOTSPOTS_SCATTER_LABEL = 'Sample signals: files by complexity and commits in the last 90 days';
export const HOTSPOTS_X_AXIS = 'Commits in the last 90 days →';
export const HOTSPOTS_Y_AXIS = 'Max. function cognitive complexity →';
export const HOTSPOTS_QUADRANT_LABEL = 'Complex + frequently changed';
export const HOTSPOTS_DOT_LABEL = (name: string, complexity: string, commits: string, coverage: string): string =>
  `${name}: complexity ${complexity}, ${commits} commits, ${coverage} branch coverage`;
export const HOTSPOTS_BAND_LABEL: Readonly<Record<'low' | 'mid' | 'high' | 'unknown', string>> = {
  low: '< 60% branch coverage', mid: '60–79%', high: '≥ 80%', unknown: 'Coverage unknown',
};
export const HOTSPOTS_MODULE_FILTER = 'Module';
export const HOTSPOTS_ALL_MODULES = 'All modules';
export const HOTSPOTS_SHOWING = (n: number, total: number): string => `Showing the ${n} highest-priority of ${total} files.`;
export const HOTSPOTS_UNPLOTTABLE = (n: number): string => `${n} files lack complexity or commit data and are not plotted.`;
export const HOTSPOTS_SELECTED = (name: string): string => `Selected: ${name}`;
export const HOTSPOTS_OPEN_DETAIL = 'Open detail';
export const HOTSPOTS_SHORTLIST_TITLE = 'Highest review priorities';
export const HOTSPOTS_SHORTLIST_SUBTITLE = 'Use this as an investigation queue, not an automatic verdict.';
export const HOTSPOTS_SHORTLIST_DETAIL = (complexity: string, commits: string, coverage: string): string =>
  `${complexity} complexity · ${commits} commits · ${coverage} covered`;
export const HOTSPOTS_TABLE_TITLE = 'Hotspot inventory';
export const HOTSPOTS_TABLE_SUBTITLE = (n: number): string => `${n} files in the selected module scope.`;
export const HOTSPOTS_FILTER_PLACEHOLDER = 'Filter files…';
export const HOTSPOTS_SORT_NOTE = 'Sorted by review priority, descending';
export const HOTSPOTS_NO_RESULTS = 'No files match this filter.';
export const HOTSPOTS_SHOW_MORE = (n: number): string => `Show ${n} more`;
export const HOTSPOTS_COL_FILE = 'File';
export const HOTSPOTS_COL_PRIORITY = 'Priority';
export const HOTSPOTS_COL_COMPLEXITY = 'Complexity';
export const HOTSPOTS_COL_COMMITS = 'Commits / 90d';
export const HOTSPOTS_COL_COVERAGE = 'Branch coverage';
export const PRIORITY_DIALOG_TITLE = 'How priority works';
export const PRIORITY_FORMULA = 'min(100, round(100 × (0.42 × complexity/48 + 0.35 × commits90d/44 + 0.23 × (1 − covered/total))))';
export const PRIORITY_TERMS: readonly { term: string; meaning: string }[] = [
  { term: 'complexity', meaning: 'Maximum cognitive complexity of any function in the file.' },
  { term: 'commits90d', meaning: 'Commits that touched the file in the last 90 days.' },
  { term: 'covered/total', meaning: 'Instrumented branches covered by tests.' },
];
export const PRIORITY_CAVEAT = 'A transparent sample heuristic for ordering an investigation. It is not a defect probability, a maintainability index, an industry benchmark or a team-performance score.';
export const PRIORITY_UNKNOWN_RULE = 'A file missing any of these inputs has an unknown priority. It is never scored as 0.';
export const DIALOG_CLOSE = 'Close';

/** Part 2 §2.3: File detail screen. */
export const FILE_EYEBROW = 'File / Evidence & impact';
export const FILE_NO_SELECTION_TITLE = 'No file selected';
export const FILE_NO_SELECTION = 'Select a file in the city, a hotspot table or the command palette to see its evidence here.';
export const FILE_BROWSE_HOTSPOTS = 'Browse hotspots';
export const FILE_SHOW_IN_CITY = 'Show in city';
export const FILE_INSPECT_ARCHITECTURE = 'Inspect architecture';
export const FILE_ADD_WORK_ITEM = 'Add work item';
export const FILE_COMMITS_CHIP = (n: string): string => `${n} commits / 90d`;
export const FILE_SAMPLE_CHIP = 'Sample signals';
export const FILE_SOURCE_TITLE = 'Source context';
export const FILE_SOURCE_SUBTITLE = 'Inventory facts for this file. File content is not read.';
export const FILE_SOURCE_PREVIEW_LATER = 'Source preview arrives with the source provider.';
export const FILE_COPY_PATH = 'Copy path';
export const FILE_COPY_FAILED = 'Could not copy the path. Select it and copy it manually.';
export const FILE_FACT_PATH = 'Path';
export const FILE_FACT_MODULE = 'Module';
export const FILE_FACT_CATEGORY = 'Category';
export const FILE_FACT_LINES = 'Lines';
export const FILE_FACT_BYTES = 'Bytes';
export const FILE_FINDINGS_TITLE = 'Evidence & decisions';
export const FILE_FINDINGS_SUBTITLE = (n: string): string => `${n} reported findings for this file.`;
export const FILE_FINDINGS_CAVEAT_TITLE = 'No findings does not imply no defects.';
export const FILE_FINDINGS_CAVEAT = 'Dynamic imports, reflection, configuration and runtime behaviour may need additional review.';
export const FILE_HISTORY_TITLE = 'Change & test history';
export const FILE_HISTORY_SUBTITLE = 'Sample per-file trends.';
export const FILE_HISTORY_FOOTNOTE = 'Complexity and branch coverage use different units.';
export const FILE_HISTORY_NONE = 'No history for this file.';
export const FILE_WORK_ITEMS_TITLE = 'Planned work';
export const FILE_WORK_ITEMS_SUBTITLE = 'Work items record intent; they never change the source.';
export const FILE_NO_WORK_ITEMS = 'No work items for this file yet.';
export const WORK_ITEM_STATUS_LABEL: Readonly<Record<'investigate' | 'planned' | 'in-progress' | 'verified', string>> = {
  investigate: 'Investigate', planned: 'Planned', 'in-progress': 'In progress', verified: 'Verified',
};
export const INVESTIGATE_FILE_LABEL = 'Investigate file';

/** Part 2 §5: shell strings that were hard-coded in TopBar.vue (unchanged text). */
export const BREADCRUMB_LABEL = 'Breadcrumb';
export const BREADCRUMB_ROOT = 'Workspace';
export const PALETTE_SHORTCUT_HINT = 'Ctrl K';

/** Part 3: Audit screens. Each file is re-exported here, so screens import only from inspector-copy. */
export * from './audit-copy/shared';
export * from './audit-copy/evolution';
export * from './audit-copy/quality';
export * from './audit-copy/tests';
export * from './audit-copy/dependencies';
export * from './audit-copy/security';
export * from './audit-copy/ownership';

/** Part 4: Act and Configure screens. */
export * from './audit-copy/workbench';
export * from './audit-copy/report';
export * from './audit-copy/sources';
export * from './audit-copy/settings';

/** Part 6: the city's cancelling state. */
export * from './audit-copy/city';
/** Part 6: durable review state. */
export * from './audit-copy/storage';
/** Part 6: fallow report import. */
export * from './audit-copy/fallow';
export * from './audit-copy/fallow-run';
/** WP-03 Part 1: dependency evidence (Architecture, File detail and city Relations). */
export * from './audit-copy/relations';
