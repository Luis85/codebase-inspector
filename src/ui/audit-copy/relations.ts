// WP-03 N5-N8, N25: Architecture, File detail and city Relations strings (spec §2). Every
// surface that shows an evidenced edge, an edge count, a neighbourhood or an arc shows
// RELATIONS_SCOPE_NOTE; every edge's type reads RELATION_TYPE_UNKNOWN. Re-exported by
// inspector-copy.ts. Later tasks add the rest of spec §2 here.
export const RELATIONS_SCOPE_NOTE = 'Only imports fallow reports in cycles and boundary violations. This is not the full import graph.';
export const RELATIONS_SCOPE_SHORT = 'Cycle and boundary imports only';
export const RELATIONS_STATIC_NOTE = 'A static import. It does not show that code runs or that a change will break.';
export const RELATION_TYPE_UNKNOWN = 'Type-only: not reported by fallow';
export const RELATION_MEMBER_UNMATCHED = 'not in this snapshot';
export const RELATION_FAN_NOT_SCORED = 'fallow did not score this file';

/** N25: the File detail "Imported by" card. */
export const FILE_CARD_IMPORTED_BY = 'Imported by';
export const FILE_CARD_IMPORTED_BY_CAPTION = 'Modules importing this file · fallow';

/** WP-03 Task 10 (N17, N25): the File detail Relations panel. */
export const RELATIONS_TITLE = 'Relations';
export const RELATIONS_NONE_FOR_FILE = 'No evidenced imports for this file.';
export const RELATION_HIDDEN = (n: number): string => `${n} more not shown`;
export const RELATIONS_CYCLES_TITLE = 'Cycles through this file';
export const RELATIONS_FAN_OUT = 'Imports (fallow)';

/** WP-03 Task 7 (N18, N20, N23, N26): Architecture cards, rules and the Overview's
 *  Import relations row — all built from the relation model, never sample data. */
export const ARCH_CARD_EVIDENCED = 'Evidenced imports';
export const RELATION_CARD_CYCLES = 'Import cycles reported by fallow';
export const RELATION_CYCLES_CAPTION = (files: number, groups: number, reExports: number): string =>
  `${files} files · ${groups} groups · ${reExports} re-export cycles`;
export const ARCH_NOT_ANALYSED_NOTE = 'No fallow report is attached, so no imports are shown. Attach or run one in Data & scans.';
export const ARCH_EDGES_OMITTED_NOTE = (n: number): string => `${n} evidenced imports go to modules not shown`;
export const RULE_NOT_EVALUATED_PARTIAL = 'No complete import graph: fallow reports only cycle and boundary imports';
/** The Overview Architecture-exceptions caption's own alternative to a formatted count. */
export const ARCH_VIOLATIONS_NOT_CONFIGURED = 'boundaries not configured';
export const OVERVIEW_IMPORTS_ROW = 'Import relations';

/** WP-03 Task 9 (N21, N24): the Architecture Cycles and Edges tabs and "Configured in
 *  fallow". The source and direction words are spec §2's shared Relations strings (the
 *  city Relations section, Tasks 10 and 12, reuses them). */
export const ARCH_TAB_CYCLES = 'Cycles';
export const ARCH_TAB_EDGES = 'Edges';
export const RELATION_SOURCE_CYCLE = 'Cycle';
export const RELATION_SOURCE_BOUNDARY = 'Boundary';
export const RELATIONS_DIRECTION_OUT = 'Outgoing';
export const RELATIONS_DIRECTION_IN = 'Incoming';
/** WP-03 Task 12 (N30): the city Relations section's controls. */
export const RELATIONS_DIRECTION_LABEL = 'Direction';
export const RELATIONS_DIRECTION_BOTH = 'Both';
export const RELATIONS_HOPS_LABEL = 'Hops';
export const RELATIONS_SHOW_ARCS = 'Show arcs in the city';
export const RELATIONS_HIGHLIGHT_CYCLE = 'Highlight cycle';
/** Spec §2's CYCLE_KIND_IMPORT / CYCLE_KIND_RE_EXPORT, keyed by CycleView.kind. */
export const CYCLE_KIND_LABEL: Readonly<Record<'import' | 're-export', string>> = { import: 'Import cycle', 're-export': 'Re-export cycle' };
export const CYCLE_REVIEW = 'Review finding';
export const CYCLE_SHOW_IN_CITY = 'Show in city';
/** The Review finding button's label on a cycle row and on a fallow boundary row. */
export const FINDING_REVIEW_LABEL = (findingId: string): string => `Review finding ${findingId}`;
export const CYCLE_SHOW_IN_CITY_LABEL = (findingId: string): string => `Show cycle ${findingId} in the city`;
export const CYCLES_NONE = 'fallow reported no cycles.';
export const ARCH_CYCLE_INSPECTOR_TITLE = 'Selected cycle';
export const EDGE_LIST_HIDDEN = (n: number): string => `${n} more imports not shown`;
export const EDGE_TABLE_CAPTION = 'Evidenced file imports';
export const EDGE_COL_FROM = 'From';
export const EDGE_COL_TO = 'To';
export const EDGE_COL_SOURCE = 'Source';
export const EDGE_COL_LINE = 'Line';
export const EDGE_COL_TYPE = 'Type';
export const EDGE_FILTER_DIRECTION = 'Direction';
export const EDGE_FILTER_SOURCE = 'Source';
export const EDGE_FILTER_ALL = 'All';
export const EDGE_DIRECTION_RELATIVE = (module: string): string => `Outgoing and Incoming are relative to ${module}.`;
export const EDGE_DIRECTION_NO_MODULE = 'No module is selected, so Direction does not filter.';
export const EDGES_NONE = 'No evidenced imports to show.';
export const UNRESOLVED_TITLE = 'Unresolved imports';
export const ARCH_FALLOW_ZONES_TITLE = 'Configured in fallow';
export const ARCH_FALLOW_ZONES_COL = 'Zones';
export const ARCH_FALLOW_ZONES_NONE = 'fallow reported no boundary violations.';
export const ARCH_FALLOW_ZONES_UNMATCHED = (n: number): string =>
  `${n} reported boundary violations involve files not in this snapshot:`;
/** N5: a Map node's label without a report — no edge counts, which would read as 0. */
export const ARCH_NODE_LABEL_NOT_ANALYSED = (label: string, files: number): string =>
  `${label}, ${files} files, imports not analysed`;
