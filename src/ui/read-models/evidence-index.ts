// Part 6 Y30/Y33/Y34: the attached fallow report, resolved against the files on screen.
// Every findings count on every screen reads from here. Each count is a MetricValue:
// - `collected` (source 'fallow') while the report was imported against this snapshot;
// - `stale` when it was imported against another snapshot (Y30), re-resolved against
//   this snapshot's paths;
// - `partial`, for the total only, when just some categories were analysed;
// - `unknown` with FALLOW_NOT_ANALYSED when there is no report or the report did not
//   analyse the category.
// Never a 0 that nothing measured (Y33).
import type { EntityId } from '../../domain/entity-id';
import {
  FINDING_CATEGORIES, originOf, type EvidenceFinding, type EvidenceOrigin, type EvidenceReport, type FindingCategory,
} from '../../application/evidence/model';
import { resolveFindings } from '../../application/evidence/resolve-findings';
import { unknown, type MetricValue } from '../evidence';
import { FALLOW_NOT_ANALYSED, FALLOW_PROVENANCE_DETAIL, FALLOW_SOME_NOT_ANALYSED, NO_FILES_REASON } from '../inspector-copy';
import type { FileSummary } from './file-summaries';
import { isHighSeverity } from './severity';

export type EvidenceIndexState = 'none' | 'current' | 'stale';
export interface FileEvidence { findings: MetricValue; high: MetricValue; unused: MetricValue }
export interface EvidenceIndex {
  state: EvidenceIndexState;
  report: EvidenceReport | null;
  byFile: ReadonlyMap<EntityId, readonly EvidenceFinding[]>;
  perFile(id: EntityId): FileEvidence;
  totals: FileEvidence;
  matchedFindings: number;
  matchedFiles: number;
  unmatchedPaths: readonly string[];
  category(c: FindingCategory): 'analysed' | 'not-analysed';
  /** `n` in this index's evidence state. Unknown when `c` (or, for `null`, every category)
   *  was not analysed; partial when `c` is null and only some were. */
  count(n: number, c: FindingCategory | null): MetricValue;
}

type Counter = (n: number, c: FindingCategory | null) => MetricValue;

/** Y34: `high` counts the tool's two top severities (severity.ts, Polish E2). */
const isHigh = (f: EvidenceFinding): boolean => isHighSeverity(f.severity);
const isUnused = (f: EvidenceFinding): boolean => f.category === 'unused-exports';
const notAnalysed = (): MetricValue => unknown(FALLOW_NOT_ANALYSED, 'fallow');

/** Polish E8: whether the report analysed `c`; the counter and `category()` both read it. */
const isAnalysed = (report: EvidenceReport | null, c: FindingCategory): boolean =>
  report !== null && report.normalized.categories[c] === 'analysed';

function counterFor(report: EvidenceReport | null, state: EvidenceIndexState): Counter {
  if (report === null) return notAnalysed;
  const analysed = (c: FindingCategory): boolean => isAnalysed(report, c);
  const provenance = { source: 'fallow', detail: FALLOW_PROVENANCE_DETAIL(report.providerVersion, originOf(report)) };
  const present = (n: number): MetricValue => ({ state: state === 'stale' ? 'stale' : 'collected', value: n, provenance });
  const covered = FINDING_CATEGORIES.filter(analysed).length;
  return (n, c) => {
    if (c !== null) return analysed(c) ? present(n) : notAnalysed();
    if (covered === 0) return notAnalysed();
    return covered === FINDING_CATEGORIES.length ? present(n) : { ...present(n), state: 'partial', reason: FALLOW_SOME_NOT_ANALYSED };
  };
}

function evidenceOf(list: readonly EvidenceFinding[], count: Counter): FileEvidence {
  return {
    findings: count(list.length, null),
    high: count(list.filter(isHigh).length, 'complexity'),
    unused: count(list.filter(isUnused).length, 'unused-exports'),
  };
}

function noFiles(): FileEvidence {
  return { findings: unknown(NO_FILES_REASON), high: unknown(NO_FILES_REASON), unused: unknown(NO_FILES_REASON) };
}

/** Y26: findings whose path is not in the snapshot never reach a file; their paths are listed. */
function groupByFile(files: readonly FileSummary[], findings: readonly EvidenceFinding[]): {
  byFile: Map<EntityId, EvidenceFinding[]>; unmatchedPaths: readonly string[];
} {
  const byPath = new Map<string, EntityId>(files.map((f) => [f.path, f.id]));
  const { matched, unmatchedPaths } = resolveFindings(findings, new Set(byPath.keys()));
  const byFile = new Map<EntityId, EvidenceFinding[]>();
  for (const f of matched) {
    const id = byPath.get(f.path);
    if (id === undefined) continue;
    const list = byFile.get(id);
    if (list) list.push(f); else byFile.set(id, [f]);
  }
  return { byFile, unmatchedPaths };
}

function build(files: readonly FileSummary[], report: EvidenceReport | null, snapshotId: string): EvidenceIndex {
  // Part 7 Z23: stale for another snapshot (Y30), or after a failed run on this one.
  const state: EvidenceIndexState = report === null ? 'none'
    : report.snapshotId === snapshotId && report.staleReason === undefined ? 'current' : 'stale';
  const count = counterFor(report, state);
  const { byFile, unmatchedPaths } = report === null
    ? { byFile: new Map<EntityId, EvidenceFinding[]>(), unmatchedPaths: [] }
    : groupByFile(files, report.normalized.findings);
  const matched = [...byFile.values()].flat();
  const perFileCache = new Map<EntityId, FileEvidence>();
  /** E37: an id that is not one of `files` has no evidence here: unknown, never a collected 0. */
  const known = new Set(files.map((f) => f.id));
  return {
    state,
    report,
    byFile,
    unmatchedPaths,
    matchedFindings: matched.length,
    matchedFiles: byFile.size,
    totals: files.length === 0 ? noFiles() : evidenceOf(matched, count),
    perFile(id: EntityId): FileEvidence {
      if (!known.has(id)) return evidenceOf([], notAnalysed);
      let hit = perFileCache.get(id);
      if (!hit) { hit = evidenceOf(byFile.get(id) ?? [], count); perFileCache.set(id, hit); }
      return hit;
    },
    category: (c) => (isAnalysed(report, c) ? 'analysed' : 'not-analysed'),
    count,
  };
}

/** The no-report key: a WeakMap key must be an object. */
const NO_REPORT: object = {};
const cache = new WeakMap<readonly FileSummary[], WeakMap<object, { snapshotId: string; index: EvidenceIndex }>>();

/** Y30/Y34: memoised per (files array, raw report) in a WeakMap of WeakMaps. Both keys are
 *  shared by every leaf on the codebase, so two leaves with the same inputs share one index,
 *  and a leaf with other inputs never reads it (E53: no single slot). `files` is one array
 *  per snapshot, so this is also the Y30 (report, snapshot) pair. Callers pass the RAW report. */
export function evidenceIndexFor(files: readonly FileSummary[], report: EvidenceReport | null, snapshotId: string): EvidenceIndex {
  let byReport = cache.get(files);
  if (!byReport) { byReport = new WeakMap(); cache.set(files, byReport); }
  const key: object = report ?? NO_REPORT;
  const hit = byReport.get(key);
  if (hit && (report === null || hit.snapshotId === snapshotId)) return hit.index;
  const index = build(files, report, snapshotId);
  byReport.set(key, { snapshotId, index });
  return index;
}

/** Part 7 Z26: what the C13 badge shows for a report. */
export interface EvidenceBadgeProps {
  version: string;
  state: 'imported' | 'collected' | 'stale';
  origin: EvidenceOrigin;
  untested: boolean;
}

export function evidenceBadgeOf(report: EvidenceReport, stale: boolean): EvidenceBadgeProps {
  const origin = originOf(report);
  return {
    version: report.providerVersion, state: stale ? 'stale' : origin, origin,
    untested: report.collected !== undefined && !report.collected.versionTested,
  };
}

/** Polish E9: the badge for an index's report in the index's own state, or none without one. */
export function evidenceBadgeFor(index: EvidenceIndex): EvidenceBadgeProps | null {
  return index.report === null ? null : evidenceBadgeOf(index.report, index.state === 'stale');
}

/** Part 7 Z23/Z27: why stale evidence is stale, for FALLOW_STALE_NOTICE. */
export function staleCauseOf(report: EvidenceReport): 'snapshot' | 'failed-run' {
  return report.staleReason === 'failed-run' ? 'failed-run' : 'snapshot';
}
