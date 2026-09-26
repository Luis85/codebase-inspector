// WP-04 IN1-IN3, IP19: the Investigate list's read model — exactly Quality's findings
// (IN1), in a total sort order (IN3: severity rank, then category, path, line — no line
// last — then id, every tiebreak by code unit, J3), filtered by free-text query, Type,
// Rule, Severity, Status and Note (IN2/IP19; Quality's Module filter is not carried). A
// row also carries its notes, found by the portable fingerprint (IP4) the note index
// groups by; a note whose finding no row claims is orphaned (IN34/IN36), listed by path,
// never dropped.
import { FINDING_CATEGORIES, type FindingCategory } from '../../application/evidence/model';
import type { NoteIndex, NoteLink } from '../../application/investigation/note-index';
import type { EvidenceIndex } from './evidence-index';
import { matchesFindingQuery, severityRank, type FindingStatus, type QualityFinding, type QualityModel } from './findings';
import { findingRef } from './review-state';

export type NoteFilter = 'all' | 'with-note' | 'without-note';
export interface InvestigationFilter {
  query: string; kind: FindingCategory | null; rule: string | null; severity: string | null;
  status: FindingStatus | 'all'; note: NoteFilter;
}
/** IP19: status defaults to 'all' (Quality's own default is 'open'), and note to 'all'. */
export const DEFAULT_INVESTIGATION_FILTER: Readonly<InvestigationFilter> = {
  query: '', kind: null, rule: null, severity: null, status: 'all', note: 'all',
};
export interface InvestigationRow extends QualityFinding { readonly portable: string | null; readonly notes: readonly NoteLink[] }
export interface InvestigationModel {
  readonly rows: readonly InvestigationRow[];
  readonly byFingerprint: ReadonlyMap<string, InvestigationRow>;
  readonly rules: readonly string[];
  readonly severities: readonly string[];
  readonly orphanNotes: readonly NoteLink[];
  readonly withNotes: number;
  readonly malformedNotes: number;
  readonly evidence: EvidenceIndex;
}

const CATEGORY_ORDER = new Map<FindingCategory, number>(FINDING_CATEGORIES.map((c, i) => [c, i]));
const byUnit = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);
const lineKey = (line: number | null): number => (line === null ? Number.MAX_SAFE_INTEGER : line);

/** IN3: fallow's severity rank, then category order, path, line (no line last), then id —
 *  every tiebreak by code unit (J3, never localeCompare): a total order, so the list never
 *  reshuffles between renders. `byUnit(a.severity, b.severity)` only separates two words of
 *  the same rank, which is rank 3 ("any other string alphabetically"). */
function investigationOrder(a: QualityFinding, b: QualityFinding): number {
  return severityRank(a.severity) - severityRank(b.severity)
    || byUnit(a.severity, b.severity)
    || (CATEGORY_ORDER.get(a.kind) ?? FINDING_CATEGORIES.length) - (CATEGORY_ORDER.get(b.kind) ?? FINDING_CATEGORIES.length)
    || byUnit(a.file.path, b.file.path)
    || lineKey(a.line) - lineKey(b.line)
    || byUnit(a.id, b.id);
}

function notesFor(portable: string | null, notes: NoteIndex): readonly NoteLink[] {
  return portable === null ? [] : notes.byFingerprint.get(portable) ?? [];
}

function buildRows(quality: QualityModel, notes: NoteIndex): readonly InvestigationRow[] {
  return [...quality.findings].sort(investigationOrder).map((f) => {
    const portable = findingRef(f.fingerprint);
    return { ...f, portable, notes: notesFor(portable, notes) };
  });
}

function presentRules(rows: readonly InvestigationRow[]): readonly string[] {
  return Array.from(new Set(rows.map((r) => r.rule))).sort(byUnit);
}

/** IN34/IN36: a note whose fingerprint no row claims (its finding is not in this report),
 *  by path (J3) — counted, never dropped. */
function orphanNotesOf(rows: readonly InvestigationRow[], notes: NoteIndex): readonly NoteLink[] {
  const claimed = new Set(rows.map((r) => r.portable).filter((p): p is string => p !== null));
  const out: NoteLink[] = [];
  for (const [fingerprint, links] of notes.byFingerprint) {
    if (!claimed.has(fingerprint)) out.push(...links);
  }
  return out.sort((a, b) => byUnit(a.path, b.path));
}

// Part 6's baseCache (findings.ts) shape: one WeakMap per quality model, keyed by the note
// index object, so a model is built once per (quality, notes) pair.
const modelCache = new WeakMap<QualityModel, WeakMap<NoteIndex, InvestigationModel>>();

export function buildInvestigationModel(quality: QualityModel, notes: NoteIndex): InvestigationModel {
  let byNotes = modelCache.get(quality);
  if (!byNotes) { byNotes = new WeakMap(); modelCache.set(quality, byNotes); }
  const hit = byNotes.get(notes);
  if (hit) return hit;
  const rows = buildRows(quality, notes);
  const model: InvestigationModel = {
    rows,
    byFingerprint: new Map(rows.map((r) => [r.fingerprint, r])),
    rules: presentRules(rows),
    severities: quality.severities,
    orphanNotes: orphanNotesOf(rows, notes),
    withNotes: rows.filter((r) => r.notes.length > 0).length,
    malformedNotes: notes.malformed,
    evidence: quality.evidence,
  };
  byNotes.set(notes, model);
  return model;
}

/** IN2/IP19: free-text query, Type, Rule, Severity, Status and Note narrow the rows.
 *  Quality's Module filter is not carried. The query predicate is `matchesFindingQuery`
 *  (findings.ts), shared with Quality's own `filterFindings` so the two never drift apart
 *  (WP-04 Task 6 fix round 1, review item 3). */
export function filterInvestigation(rows: readonly InvestigationRow[], filter: InvestigationFilter): readonly InvestigationRow[] {
  const q = filter.query.trim().toLowerCase();
  return rows.filter((r) => (filter.status === 'all' || r.status === filter.status)
    && (filter.kind === null || r.kind === filter.kind)
    && (filter.rule === null || r.rule === filter.rule)
    && (filter.severity === null || r.severity === filter.severity)
    && (filter.note === 'all' || (filter.note === 'with-note' ? r.notes.length > 0 : r.notes.length === 0))
    && matchesFindingQuery(r, q));
}
