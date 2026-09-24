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
