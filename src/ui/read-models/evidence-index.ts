// Part 6 Y30/Y33/Y34: the attached fallow report, resolved against the files on screen.
// Every findings count on every screen reads from here. Each count is a MetricValue:
// - `collected` (source 'fallow') while the report was imported against this snapshot;
// - `stale` when it was imported against another snapshot (Y30), re-resolved against
//   this snapshot's paths;
// - `partial`, for the total (or a category list, WP-03 N13/JF3), when just some of its
//   categories were analysed;
// - `unknown` with FALLOW_NOT_ANALYSED when there is no report or the report did not
//   analyse the category; `unknown` with FALLOW_BOUNDARIES_NOT_CONFIGURED when every
//   category asked about is off by the user's own fallow configuration (WP-03 N11).
// Never a 0 that nothing measured (Y33).
import type { EntityId } from '../../domain/entity-id';
import {
  FINDING_CATEGORIES, originOf, type EvidenceFinding, type EvidenceOrigin, type EvidenceReport, type FindingCategory,
} from '../../application/evidence/model';
import { unknown, type MetricValue } from '../evidence';
import {
  FALLOW_BOUNDARIES_NOT_CONFIGURED, FALLOW_NOT_ANALYSED, FALLOW_PROVENANCE_DETAIL, FALLOW_SOME_NOT_ANALYSED, NO_FILES_REASON,
} from '../inspector-copy';
import type { FileSummary } from './file-summaries';
import { isHighSeverity } from './severity';
import { groupByFile, type TouchingFinding } from './evidence-touching';

export type { TouchingFinding };
export type EvidenceIndexState = 'none' | 'current' | 'stale';
export interface FileEvidence { findings: MetricValue; high: MetricValue; unused: MetricValue }
export interface EvidenceIndex {
  state: EvidenceIndexState;
  report: EvidenceReport | null;
  byFile: ReadonlyMap<EntityId, readonly EvidenceFinding[]>;
  /** WP-03 N12: a finding under its anchor AND every matched related file, each entry
   *  carrying the finding's own anchorId. File detail and the findings lens read this,
   *  so a cycle or a boundary violation is shown, and painted, on every file it involves. */
  touching: ReadonlyMap<EntityId, readonly TouchingFinding[]>;
  perFile(id: EntityId): FileEvidence;
  totals: FileEvidence;
  matchedFindings: number;
  matchedFiles: number;
  unmatchedPaths: readonly string[];
  category(c: FindingCategory): 'analysed' | 'not-analysed';
  /** `n` in this index's evidence state (WP-03 N13, JF3). For a list, a not-configured
   *  member is left out first; the count over what remains is unknown when none of it was
   *  asked about, collected/stale when all of it is analysed, partial when only some is,
   *  and unknown(FALLOW_NOT_ANALYSED) when none is. Nothing left after removing
   *  not-configured members is unknown(FALLOW_BOUNDARIES_NOT_CONFIGURED). `null` means
   *  every FindingCategory (the total). */
  count(n: number, c: FindingCategory | readonly FindingCategory[] | null): MetricValue;
}

type CategoryArg = FindingCategory | readonly FindingCategory[] | null;
type Counter = (n: number, c: CategoryArg) => MetricValue;

/** Y34: `high` counts the tool's two top severities (severity.ts, Polish E2). */
const isHigh = (f: EvidenceFinding): boolean => isHighSeverity(f.severity);
const isUnused = (f: EvidenceFinding): boolean => f.category === 'unused-exports';
const notAnalysed = (): MetricValue => unknown(FALLOW_NOT_ANALYSED, 'fallow');
const notConfiguredUnknown = (): MetricValue => unknown(FALLOW_BOUNDARIES_NOT_CONFIGURED, 'fallow');

/** Polish E8: whether the report analysed `c`; the counter and `category()` both read it. */
const isAnalysed = (report: EvidenceReport | null, c: FindingCategory): boolean =>
  report !== null && report.normalized.categories[c] === 'analysed';

/** `Array.isArray`'s own predicate narrows to `any[]`; this one keeps `FindingCategory`. */
const isCategoryList = (c: CategoryArg): c is readonly FindingCategory[] => Array.isArray(c);

/** WP-03 N11/N13 (JF3): a single category and a category list share one rule, since a
 *  single category is just a list of one. Not-configured members are dropped first; what
 *  remains decides collected/partial/unknown, and an empty remainder is the
 *  not-configured unknown, never the generic one (N11: off by the user's own config is
 *  not missing evidence). */
function counterFor(report: EvidenceReport | null, state: EvidenceIndexState): Counter {
  if (report === null) return notAnalysed;
  const analysed = (c: FindingCategory): boolean => isAnalysed(report, c);
  const notConfigured = report.normalized.notConfigured;
  const provenance = { source: 'fallow', detail: FALLOW_PROVENANCE_DETAIL(report.providerVersion, originOf(report)) };
  const present = (n: number): MetricValue => ({ state: state === 'stale' ? 'stale' : 'collected', value: n, provenance });
  return (n, c) => {
    const categories = c === null ? FINDING_CATEGORIES : isCategoryList(c) ? c : [c];
    const expected = categories.filter((cat) => !notConfigured.includes(cat));
    if (expected.length === 0) return notConfiguredUnknown();
    const covered = expected.filter(analysed).length;
    if (covered === 0) return notAnalysed();
    return covered === expected.length ? present(n) : { ...present(n), state: 'partial', reason: FALLOW_SOME_NOT_ANALYSED };
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

function build(files: readonly FileSummary[], report: EvidenceReport | null, snapshotId: string): EvidenceIndex {
  // Part 7 Z23: stale for another snapshot (Y30), or after a failed run on this one.
  const state: EvidenceIndexState = report === null ? 'none'
    : report.snapshotId === snapshotId && report.staleReason === undefined ? 'current' : 'stale';
  const count = counterFor(report, state);
  const { byFile, touching, unmatchedPaths } = report === null
    ? { byFile: new Map<EntityId, EvidenceFinding[]>(), touching: new Map<EntityId, TouchingFinding[]>(), unmatchedPaths: [] }
    : groupByFile(files, report.normalized.findings);
  const matched = [...byFile.values()].flat();
  const perFileCache = new Map<EntityId, FileEvidence>();
  /** E37: an id that is not one of `files` has no evidence here: unknown, never a collected 0. */
  const known = new Set(files.map((f) => f.id));
  return {
    state,
    report,
    byFile,
    touching,
    unmatchedPaths,
    matchedFindings: matched.length,
    matchedFiles: byFile.size,
    totals: files.length === 0 ? noFiles() : evidenceOf(matched, count),
    perFile(id: EntityId): FileEvidence {
      if (!known.has(id)) return evidenceOf([], notAnalysed);
      let hit = perFileCache.get(id);
      // WP-03 N12: perFile is fed the touching list's findings, so a related file (a
      // boundary violation's other end, a cycle's other members) counts it too.
      if (!hit) { hit = evidenceOf((touching.get(id) ?? []).map((t) => t.finding), count); perFileCache.set(id, hit); }
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

/** Polish 5b fix round: module-private; screens use `evidenceBadgeFor` (E9). */
function evidenceBadgeOf(report: EvidenceReport, stale: boolean): EvidenceBadgeProps {
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
