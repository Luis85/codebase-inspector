// Part 3 Q1-Q3, Part 6 Y33-Y35: every imported fallow finding that resolved to a file on
// screen, merged with the review decisions held apart from them (keyed by fingerprint).
// A finding without a decision is open. With no report there are no findings, and every
// card is unknown with FALLOW_NOT_ANALYSED, never 0 (Y33).
import type { EntityId } from '../../domain/entity-id';
import type { FindingCategory } from '../../application/evidence/model';
import { unknown, type MetricValue } from '../evidence';
import { toCsv, type CsvColumn } from '../export/csv';
import type { FindingDisposition } from '../stores/ports/review-repository';
import {
  FINDING_TITLE, NO_FILES_REASON, QUALITY_CARD_COMPLEXITY, QUALITY_CARD_COMPLEXITY_CAPTION, QUALITY_CARD_DUPLICATION,
  QUALITY_CARD_DUPLICATION_CAPTION, QUALITY_CARD_OPEN, QUALITY_CARD_OPEN_CAPTION, QUALITY_CARD_UNUSED,
  QUALITY_CARD_UNUSED_CAPTION,
} from '../inspector-copy';
import type { EvidenceIndex } from './evidence-index';
import type { FileFinding } from './file-detail';
import { filesByPriority, moduleLabel, type FileSummary } from './file-summaries';

export type FindingStatus = 'open' | 'acknowledged' | 'dismissed';
/** Part 6 Y35 (R6): fallow's own severities, plus `unrated` for a finding it does not rate.
 *  A word a later fallow adds is kept verbatim on the finding; it is just not in this list. */
export type FindingSeverity = 'critical' | 'high' | 'moderate' | 'unrated';
export interface QualityFinding extends FileFinding { file: FileSummary; moduleLabel: string; status: FindingStatus; reason: string | null }
export interface QualityFilter { query: string; kind: FindingCategory | null; severity: string | null; module: string | null; status: FindingStatus | 'all' }
export interface QualityCard { id: 'open' | FindingCategory; label: string; icon: string; value: MetricValue; caption: string; tone: 'accent' | 'warning' }
export interface QualityModel {
  findings: readonly QualityFinding[];
  byFingerprint: ReadonlyMap<string, QualityFinding>;
  modules: readonly { name: string; label: string }[];
  cards: readonly QualityCard[];
  /** The evidence the model was built from: its state, report and categories (Y35). */
  evidence: EvidenceIndex;
}

export const DEFAULT_QUALITY_FILTER: Readonly<QualityFilter> = { query: '', kind: null, severity: null, module: null, status: 'open' };
export const FINDINGS_PAGE = 100;
export const SEVERITY_RANK: Readonly<Record<FindingSeverity, number>> = { critical: 0, high: 1, moderate: 2, unrated: 4 };
/** A Map, so a report's own word can never reach an Object.prototype member. */
const RANKS = new Map<string, number>(Object.entries(SEVERITY_RANK));
/** Y35: an unlisted severity ranks after moderate and before unrated. */
const UNLISTED_RANK = 3;
const TONES: ReadonlySet<string> = new Set<FindingSeverity>(['critical', 'high', 'moderate', 'unrated']);
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
 *  Part 6 Y24: the id is stable across re-imports, so a disposition applies again. */
export function findingFingerprint(fileId: EntityId, findingId: string): string {
  return `${fileId}#${findingId}`;
}

/** The one place a file's imported findings gain their display title and their durable
 *  fingerprint. File detail (one file) and Code quality (every file) share it, so the two
 *  screens can never disagree on either. */
export function titledFindings(file: FileSummary, evidence: EvidenceIndex): FileFinding[] {
  return (evidence.byFile.get(file.id) ?? []).map((f) => ({
    id: f.id, kind: f.category, rule: f.rule, severity: f.severity ?? 'unrated', line: f.line, endLine: f.endLine,
    symbol: f.symbol, detail: f.detail, title: FINDING_TITLE[f.category], fingerprint: findingFingerprint(file.id, f.id),
  }));
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

export function buildQualityModel(
  files: readonly FileSummary[], evidence: EvidenceIndex, dispositions: readonly FindingDisposition[],
): QualityModel {
  const decided = new Map(dispositions.map((d) => [d.fingerprint, d]));
  const findings: QualityFinding[] = baseFindings(files, evidence).map((f) => {
    const d = decided.get(f.fingerprint);
    return { ...f, status: d?.status ?? 'open', reason: d?.reason ?? null };
  });
  const open = findings.filter((f) => f.status === 'open');
  const count = (kind: FindingCategory | null): MetricValue => (files.length === 0
    ? unknown(NO_FILES_REASON)
    : evidence.count(open.filter((f) => kind === null || f.kind === kind).length, kind));
  const names = [...new Set(files.map((f) => f.module))].sort((a, b) => a.localeCompare(b));
  return {
    findings,
    byFingerprint: new Map(findings.map((f) => [f.fingerprint, f])),
    modules: names.map((name) => ({ name, label: moduleLabel(name) })),
    cards: [
      { id: 'open', label: QUALITY_CARD_OPEN, icon: 'code', value: count(null), caption: QUALITY_CARD_OPEN_CAPTION(findings.length, findings.length - open.length), tone: 'accent' },
      { id: 'complexity', label: QUALITY_CARD_COMPLEXITY, icon: 'flame', value: count('complexity'), caption: QUALITY_CARD_COMPLEXITY_CAPTION, tone: 'warning' },
      { id: 'unused-exports', label: QUALITY_CARD_UNUSED, icon: 'file-x', value: count('unused-exports'), caption: QUALITY_CARD_UNUSED_CAPTION, tone: 'accent' },
      { id: 'duplication', label: QUALITY_CARD_DUPLICATION, icon: 'copy', value: count('duplication'), caption: QUALITY_CARD_DUPLICATION_CAPTION, tone: 'accent' },
    ],
    evidence,
  };
}

export function filterFindings(findings: readonly QualityFinding[], filter: QualityFilter): readonly QualityFinding[] {
  const q = filter.query.trim().toLowerCase();
  return findings.filter((f) => (filter.status === 'all' || f.status === filter.status)
    && (filter.kind === null || f.kind === filter.kind)
    && (filter.severity === null || f.severity === filter.severity)
    && (filter.module === null || f.file.module === filter.module)
    && (!q || f.file.path.toLowerCase().includes(q) || f.title.toLowerCase().includes(q) || f.id.toLowerCase().includes(q)
      || (f.symbol ?? '').toLowerCase().includes(q)));
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
 *  rule and provenance (`fallow <version> imported`, or `… stale`). */
export function findingsCsv(rows: readonly QualityFinding[], evidence: EvidenceIndex): string {
  const report = evidence.report;
  const provenance = report === null ? 'none' : `fallow ${report.providerVersion} ${evidence.state === 'stale' ? 'stale' : 'imported'}`;
  return toCsv(csvColumns(provenance), rows);
}
