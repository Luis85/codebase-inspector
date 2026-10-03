// Part 3 Q1-Q3, Part 6 Y33-Y35: every imported fallow finding that resolved to a file on
// screen, merged with the review decisions held apart from them (keyed by fingerprint).
// A finding without a decision is open. With no report there are no findings, and every
// card is unknown with FALLOW_NOT_ANALYSED, never 0 (Y33).
import type { EntityId } from '../../domain/entity-id';
import { originOf, type FindingCategory } from '../../application/evidence/model';
import { hasValue, unknown, type MetricValue } from '../evidence';
import { toCsv, type CsvColumn } from '../export/csv';
import type { FindingDisposition } from '../stores/ports/review-repository';
import {
  FALLOW_NOT_ANALYSED, FINDING_TITLE_FOR, NO_FILES_REASON, QUALITY_CARD_COMPLEXITY, QUALITY_CARD_COMPLEXITY_CAPTION, QUALITY_CARD_DUPLICATION,
  QUALITY_CARD_DUPLICATION_CAPTION, QUALITY_CARD_OPEN, QUALITY_CARD_OPEN_CAPTION, QUALITY_CARD_OPEN_CAPTION_STALE, QUALITY_CARD_STRUCTURE,
  QUALITY_CARD_STRUCTURE_CAPTION, QUALITY_CARD_UNUSED, QUALITY_CARD_UNUSED_CAPTION,
} from '../inspector-copy';
import type { EvidenceIndex, EvidenceIndexState } from './evidence-index';
import type { FileFinding } from './file-detail';
import { filesByPriority, moduleLabel, type FileSummary } from './file-summaries';
import { FINDING_SEVERITIES, isHighSeverity, type FindingSeverity } from './severity';

export type FindingStatus = 'open' | 'acknowledged' | 'dismissed';
export interface QualityFinding extends FileFinding { file: FileSummary; moduleLabel: string; status: FindingStatus; reason: string | null }
export interface QualityFilter { query: string; kind: FindingCategory | null; severity: string | null; module: string | null; status: FindingStatus | 'all' }
export interface QualityCard { id: 'open' | 'structure' | FindingCategory; label: string; icon: string; value: MetricValue; caption: string; tone: 'accent' | 'warning' }
/** WP-03 N13: the categories the "Import structure" card counts together. WP-04 Task 6
 *  fix round 1: exported — investigation-evidence.ts's RELATIONS_SCOPE_NOTE scope (cycle,
 *  boundary, unresolved-import) is the same list, so both consumers read one source. */
export const STRUCTURE_CATEGORIES: readonly FindingCategory[] = ['cycle', 'boundary', 'unresolved-import'];
export interface QualityModel {
  findings: readonly QualityFinding[];
  byFingerprint: ReadonlyMap<string, QualityFinding>;
  modules: readonly { name: string; label: string }[];
  cards: readonly QualityCard[];
  /** R6: the severities the findings use, in severityRank order (the severity filter's options). */
  severities: readonly string[];
  /** The evidence the model was built from: its state, report and categories (Y35). */
  evidence: EvidenceIndex;
}

export const DEFAULT_QUALITY_FILTER: Readonly<QualityFilter> = { query: '', kind: null, severity: null, module: null, status: 'open' };
export const FINDINGS_PAGE = 100;
const SEVERITY_RANK: Readonly<Record<FindingSeverity, number>> = { critical: 0, high: 1, moderate: 2, unrated: 4 };
/** A Map, so a report's own word can never reach an Object.prototype member. */
const RANKS = new Map<string, number>(Object.entries(SEVERITY_RANK));
/** Y35: an unlisted severity ranks after moderate and before unrated. */
const UNLISTED_RANK = 3;
const TONES: ReadonlySet<string> = new Set<string>(FINDING_SEVERITIES);
const isSeverity = (severity: string): severity is FindingSeverity => TONES.has(severity);

export function severityRank(severity: string): number {
  return RANKS.get(severity) ?? UNLISTED_RANK;
}

/** R6: the kit severity class (`ci-severity--<tone>`). Picked from a fixed list, so a class
 *  name is never built from report text; any word fallow adds later reads as unrated. */
export function severityTone(severity: string): FindingSeverity {
  return isSeverity(severity) ? severity : 'unrated';
}

/** Q2: durable across snapshots (the EntityId is source-relative) and never the line.
 *  Part 6 Y24: the id is stable across re-imports, so a disposition applies again.
 *  WP-03 Task 6 fix round: also the canonical builder for relations.ts's cycle/boundary
 *  fingerprints, so File detail and the Relations model can never disagree on the shape. */
export function findingFingerprint(fileId: EntityId, findingId: string): string {
  return `${fileId}#${findingId}`;
}

/** E34/WP-03 N12/J14: THE one place a file's imported findings gain their row shape —
 *  title, durable fingerprint, related paths, anchored and anchorPath — via `touching`,
 *  so a finding shows on every file it involves (a cycle's other members, a boundary
 *  violation's other end), not only its anchor. File detail reads this directly for the
 *  ONE selected file; `titledFindings` below is its anchor-only filter for Quality, so
 *  the two screens build a row through this one function and can never disagree.
 *  `anchorPath` is the finding's own `path`, which is always the anchor's path (Part 6
 *  Y24/WP-03 N9-N10). */
export function touchingFindings(file: FileSummary, evidence: EvidenceIndex): FileFinding[] {
  return (evidence.touching.get(file.id) ?? []).map(({ finding: f, anchorId }) => ({
    id: f.id, kind: f.category, rule: f.rule, severity: f.severity ?? 'unrated', line: f.line, endLine: f.endLine,
    symbol: f.symbol, detail: f.detail, title: FINDING_TITLE_FOR(f.category, f.rule, f.symbol, f.detail),
    fingerprint: findingFingerprint(anchorId, f.id), related: f.related ?? [], anchored: anchorId === file.id, anchorPath: f.path,
  }));
}

/** Anchor-only view of `touchingFindings` (Part 6 Y26's `byFile` meaning): Quality counts
 *  a finding once, on its anchor. Not exported — file-detail.ts reads `touchingFindings`
 *  directly for the one file's full touching view. */
function titledFindings(file: FileSummary, evidence: EvidenceIndex): FileFinding[] {
  return touchingFindings(file, evidence).filter((f) => f.anchored);
}

type BaseFinding = Omit<QualityFinding, 'status' | 'reason'>;
const baseCache = new WeakMap<EvidenceIndex, { files: readonly FileSummary[]; base: readonly BaseFinding[] }>();
/** Built once per (evidence index, files), in priority order; decisions are merged per call. */
function baseFindings(files: readonly FileSummary[], evidence: EvidenceIndex): readonly BaseFinding[] {
  const hit = baseCache.get(evidence);
  if (hit && hit.files === files) return hit.base;
  const base = filesByPriority(files).flatMap((file) => titledFindings(file, evidence).map((f) => ({
    ...f, file, moduleLabel: moduleLabel(file.module),
  })));
  baseCache.set(evidence, { files, base });
  return base;
}

/** Part 6 E37: the Open card's caption never shows a count the card itself does not have
 *  (Y33), and stale evidence (Y30) is never "in this snapshot". */
function openCaption(value: MetricValue, state: EvidenceIndexState, total: number, decided: number): string {
  if (value.state === 'unknown') return value.reason ?? FALLOW_NOT_ANALYSED;
  return state === 'stale' ? QUALITY_CARD_OPEN_CAPTION_STALE(total, decided) : QUALITY_CARD_OPEN_CAPTION(total, decided);
}

/** R6: a word a later fallow adds is listed too, after moderate and before unrated. */
function presentSeverities(findings: readonly QualityFinding[]): string[] {
  return [...new Set(findings.map((f) => f.severity))].sort((a, b) => severityRank(a) - severityRank(b) || a.localeCompare(b));
}

/** `Array.isArray`'s own predicate narrows to `any[]`; this one keeps `FindingCategory`. */
const isCategoryList = (c: FindingCategory | readonly FindingCategory[] | null): c is readonly FindingCategory[] => Array.isArray(c);

export function buildQualityModel(
  files: readonly FileSummary[], evidence: EvidenceIndex, dispositions: readonly FindingDisposition[],
): QualityModel {
  const decided = new Map(dispositions.map((d) => [d.fingerprint, d]));
  const findings: QualityFinding[] = baseFindings(files, evidence).map((f) => {
    const d = decided.get(f.fingerprint);
    return { ...f, status: d?.status ?? 'open', reason: d?.reason ?? null };
  });
  const open = findings.filter((f) => f.status === 'open');
  /** One count for a single category, a list (the Import structure card, WP-03 N13), or
   *  every category (`null`, the Open card's total). */
  const count = (c: FindingCategory | readonly FindingCategory[] | null): MetricValue => {
    if (files.length === 0) return unknown(NO_FILES_REASON);
    const categories = c === null ? null : isCategoryList(c) ? c : [c];
    const n = categories === null ? open.length : open.filter((f) => categories.includes(f.kind)).length;
    return evidence.count(n, c);
  };
  const names = [...new Set(files.map((f) => f.module))].sort((a, b) => a.localeCompare(b));
  return {
    findings,
    byFingerprint: new Map(findings.map((f) => [f.fingerprint, f])),
    modules: names.map((name) => ({ name, label: moduleLabel(name) })),
    cards: [
      { id: 'open', label: QUALITY_CARD_OPEN, icon: 'code', value: count(null), caption: openCaption(count(null), evidence.state, findings.length, findings.length - open.length), tone: 'accent' },
      { id: 'complexity', label: QUALITY_CARD_COMPLEXITY, icon: 'flame', value: count('complexity'), caption: QUALITY_CARD_COMPLEXITY_CAPTION, tone: 'warning' },
      { id: 'unused-exports', label: QUALITY_CARD_UNUSED, icon: 'file-x', value: count('unused-exports'), caption: QUALITY_CARD_UNUSED_CAPTION, tone: 'accent' },
      { id: 'duplication', label: QUALITY_CARD_DUPLICATION, icon: 'copy', value: count('duplication'), caption: QUALITY_CARD_DUPLICATION_CAPTION, tone: 'accent' },
      { id: 'structure', label: QUALITY_CARD_STRUCTURE, icon: 'git-fork', value: count(STRUCTURE_CATEGORIES), caption: QUALITY_CARD_STRUCTURE_CAPTION, tone: 'warning' },
    ],
    severities: presentSeverities(findings),
    evidence,
  };
}

/** Part 6 E48 (I1): the open-findings count, in its evidence state. Every surface labelled
 *  "open" (the Overview card, its report-summary line, the Code quality nav badge) reads it
 *  here, so none can count a decided finding the Quality screen does not. */
export function openFindingsValue(model: QualityModel): MetricValue {
  return model.cards[0]!.value;
}

/** Polish E2: the Overview's "critical or high" over OPEN findings only (as openFindingsValue),
 *  in the state and provenance of the index's own high count: unknown stays unknown, never 0. */
export function openHighFindingsValue(model: QualityModel): MetricValue {
  const all = model.evidence.totals.high;
  if (!hasValue(all)) return all;
  return { ...all, value: model.findings.filter((f) => f.status === 'open' && isHighSeverity(f.severity)).length };
}

/** WP-04 Task 6 fix round 1: shared with investigation.ts's filterInvestigation, so the two
 *  screens' query matching can never drift apart. `q` is already trimmed and lowercased. */
export function matchesFindingQuery(f: QualityFinding, q: string): boolean {
  return !q || f.file.path.toLowerCase().includes(q) || f.title.toLowerCase().includes(q) || f.id.toLowerCase().includes(q)
    || (f.symbol ?? '').toLowerCase().includes(q);
}

export function filterFindings(findings: readonly QualityFinding[], filter: QualityFilter): readonly QualityFinding[] {
  const q = filter.query.trim().toLowerCase();
  return findings.filter((f) => (filter.status === 'all' || f.status === filter.status)
    && (filter.kind === null || f.kind === filter.kind)
    && (filter.severity === null || f.severity === filter.severity)
    && (filter.module === null || f.file.module === filter.module)
    && matchesFindingQuery(f, q));
}

function csvColumns(provenance: string): readonly CsvColumn<QualityFinding>[] {
  return [
    { header: 'id', value: (f) => f.id },
    { header: 'path', value: (f) => f.file.path },
    { header: 'module', value: (f) => f.moduleLabel },
    { header: 'kind', value: (f) => f.kind },
    { header: 'rule', value: (f) => f.rule },
    { header: 'severity', value: (f) => f.severity },
    { header: 'line', value: (f) => f.line ?? undefined },
    { header: 'line_state', value: (f) => (f.line === null ? 'unknown' : 'reported') },
    { header: 'status', value: (f) => f.status },
    { header: 'reason', value: (f) => f.reason ?? undefined },
    { header: 'provenance', value: () => provenance },
  ];
}

/** Q15, Part 6 Y35: the filtered set, each decision next to the imported finding, with its
 *  rule and provenance (`fallow <version> imported` or `collected`, or `… stale`). */
export function findingsCsv(rows: readonly QualityFinding[], evidence: EvidenceIndex): string {
  const report = evidence.report;
  const provenance = report === null ? 'none' : `fallow ${report.providerVersion} ${evidence.state === 'stale' ? 'stale' : originOf(report)}`;
  return toCsv(csvColumns(provenance), rows);
}
