// Part 3 Q1-Q3: every file's sample findings, merged with the review decisions held apart
// from them (keyed by fingerprint). A finding without a decision is open.
import type { EntityId } from '../../domain/entity-id';
import { sample, unknown, type MetricValue } from '../evidence';
import { toCsv, type CsvColumn } from '../export/csv';
import { sampleFindings, type FindingKind, type FindingSeverity } from '../fixtures/sample-findings';
import type { FindingDisposition } from '../stores/ports/review-repository';
import {
  FINDING_TITLE, NO_FILES_REASON, QUALITY_CARD_COMPLEXITY, QUALITY_CARD_COMPLEXITY_CAPTION, QUALITY_CARD_DUPLICATION,
  QUALITY_CARD_DUPLICATION_CAPTION, QUALITY_CARD_OPEN, QUALITY_CARD_OPEN_CAPTION, QUALITY_CARD_UNUSED,
  QUALITY_CARD_UNUSED_CAPTION,
} from '../inspector-copy';
import type { FileFinding } from './file-detail';
import { filesByPriority, moduleLabel, type FileSummary } from './file-summaries';

export type FindingStatus = 'open' | 'acknowledged' | 'dismissed';
export interface QualityFinding extends FileFinding { file: FileSummary; moduleLabel: string; status: FindingStatus; reason: string | null }
export interface QualityFilter { query: string; kind: FindingKind | null; severity: FindingSeverity | null; module: string | null; status: FindingStatus | 'all' }
export interface QualityCard { id: 'open' | FindingKind; label: string; icon: string; value: MetricValue; caption: string; tone: 'accent' | 'warning' }
export interface QualityModel {
  findings: readonly QualityFinding[];
  byFingerprint: ReadonlyMap<string, QualityFinding>;
  modules: readonly { name: string; label: string }[];
  cards: readonly QualityCard[];
  usesSample: boolean;
}

export const DEFAULT_QUALITY_FILTER: Readonly<QualityFilter> = { query: '', kind: null, severity: null, module: null, status: 'open' };
export const FINDINGS_PAGE = 100;
export const SEVERITY_RANK: Readonly<Record<FindingSeverity, number>> = { high: 0, medium: 1, low: 2 };

/** Q2: durable across snapshots (the EntityId is source-relative) and never the line. */
export function findingFingerprint(fileId: EntityId, findingId: string): string {
  return `${fileId}#${findingId}`;
}

type BaseFinding = Omit<QualityFinding, 'status' | 'reason'>;
const baseCache = new WeakMap<readonly FileSummary[], readonly BaseFinding[]>();
/** Generated once per files array, in priority order; decisions are merged per call. */
function baseFindings(files: readonly FileSummary[]): readonly BaseFinding[] {
  let hit = baseCache.get(files);
  if (!hit) {
    hit = filesByPriority(files).flatMap((file) => sampleFindings(file).map((f) => ({
      ...f, title: FINDING_TITLE[f.kind], fingerprint: findingFingerprint(file.id, f.id), file, moduleLabel: moduleLabel(file.module),
    })));
    baseCache.set(files, hit);
  }
  return hit;
}

export function buildQualityModel(files: readonly FileSummary[], dispositions: readonly FindingDisposition[]): QualityModel {
  const decided = new Map(dispositions.map((d) => [d.fingerprint, d]));
  const findings: QualityFinding[] = baseFindings(files).map((f) => {
    const d = decided.get(f.fingerprint);
    return { ...f, status: d?.status ?? 'open', reason: d?.reason ?? null };
  });
  const open = findings.filter((f) => f.status === 'open');
  const count = (kind: FindingKind | null): MetricValue =>
    (files.length === 0 ? unknown(NO_FILES_REASON) : sample(open.filter((f) => kind === null || f.kind === kind).length));
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
    usesSample: files.length > 0,
  };
}

export function filterFindings(findings: readonly QualityFinding[], filter: QualityFilter): readonly QualityFinding[] {
  const q = filter.query.trim().toLowerCase();
  return findings.filter((f) => (filter.status === 'all' || f.status === filter.status)
    && (filter.kind === null || f.kind === filter.kind)
    && (filter.severity === null || f.severity === filter.severity)
    && (filter.module === null || f.file.module === filter.module)
    && (!q || f.file.path.toLowerCase().includes(q) || f.title.toLowerCase().includes(q) || f.id.toLowerCase().includes(q)));
}

const CSV_COLUMNS: readonly CsvColumn<QualityFinding>[] = [
  { header: 'id', value: (f) => f.id },
  { header: 'path', value: (f) => f.file.path },
  { header: 'module', value: (f) => f.moduleLabel },
  { header: 'kind', value: (f) => f.kind },
  { header: 'severity', value: (f) => f.severity },
  { header: 'line', value: (f) => f.line ?? undefined },
  { header: 'line_state', value: (f) => (f.line === null ? 'unknown' : 'sample') },
  { header: 'status', value: (f) => f.status },
  { header: 'reason', value: (f) => f.reason ?? undefined },
  { header: 'provenance', value: () => 'sample' },
];

/** Q15: the filtered set, with each decision next to the generated finding. */
export function findingsCsv(rows: readonly QualityFinding[]): string {
  return toCsv(CSV_COLUMNS, rows);
}
