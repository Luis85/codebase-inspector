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
