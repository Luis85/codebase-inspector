// WP-02 user-facing strings. Sourced from docs/concept/prototype (screen-map.json and the
// screen specification), NOT from the WP-01 microcopy catalogue — which is why they live
// here and not in copy.ts (bound to that catalogue by tests/contracts/microcopy.test.ts).
export const SAMPLE_DATA_NOTICE = 'Includes sample data';
export const SAMPLE_DATA_DETAIL = 'Values marked Sample are illustrative, not measured from this codebase.';
export const PLACEHOLDER_ARRIVES = (part: number): string => `This screen arrives in Part ${part} of the inspector UI.`;
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
export const IMPORT_GRAPH_UNKNOWN_REASON = 'Import graph not collected yet.';
export const PRIORITY_UNKNOWN_REASON = 'Priority needs complexity, commits and branch coverage.';
/** Part 2 P1: files at the root form one module, never shown as "(root)". */
export const ROOT_FILES_LABEL = 'Root files';
export const PROTECT_MODULE_TITLE = (label: string, isRoot: boolean): string =>
  (isRoot ? 'Protect the root files' : `Protect the ${label} module`);
export const OVERVIEW_ARCH_CAPTION = 'Cyclic module groups · sample edges';

/** Part 2 §2.1: Architecture cards and read-model reasons. */
export const ARCH_CARD_MODULES = 'Modules';
export const ARCH_CARD_EDGES = 'Sample module edges';
export const ARCH_CARD_CYCLES = 'Cyclic components';
export const ARCH_CARD_VIOLATIONS = 'Boundary violations';
export const ARCH_MODULES_OMITTED_CAPTION = (shown: number): string => `The ${shown} largest are shown in the graph`;
export const ARCH_EDGES_CAPTION = (imports: string): string => `${imports} import statements · sample edges`;
export const ARCH_NO_CYCLES_CAPTION = 'No cyclic module groups';
export const ARCH_NO_RULES_REASON = 'No boundary rules defined.';
export const ARCH_VIOLATIONS_CAPTION = (failing: number): string => `${failing} failing rule(s) · sample graph`;
export const RULE_NOT_EVALUATED_REASON = 'A module in this rule is not in the sample graph.';
