// WP-02 spec §4.4: the one per-file read model every screen shares. Real inventory values
// are `collected`; everything a provider does not yet collect comes from the sample
// provider and says so.
import type { EntityId } from '../../domain/entity-id';
import type { CodebaseSnapshot, Observation } from '../../domain/model';
import { aggregate, collected, hasValue, sample, unknown, type MetricValue } from '../evidence';
import { sampleFileSignals } from '../fixtures/sample-signals';
import { PRIORITY_UNKNOWN_REASON, ROOT_FILES_LABEL } from '../inspector-copy';

export interface FileSummary {
  id: EntityId;
  name: string;
  path: string;
  module: string;
  lines: MetricValue;
  complexity: MetricValue;
  commits90d: MetricValue;
  branchesCovered: MetricValue;
  branchesTotal: MetricValue;
  branchCoverage: MetricValue;   // percent
  findings: MetricValue;
  highFindings: MetricValue;
  unusedExports: MetricValue;
  directDependents: MetricValue;
  priority: MetricValue;
}

export const ROOT_MODULE = '(root)';

export function moduleOf(path: string): string {
  const slash = path.indexOf('/');
  return slash > 0 ? path.slice(0, slash) : ROOT_MODULE;
}

/** Part 2 P1: what a module is called on screen. */
export function moduleLabel(module: string): string {
  return module === ROOT_MODULE ? ROOT_FILES_LABEL : module;
}

/** The prototype's transparent SAMPLE heuristic (IMPLEMENTATION-HANDOFF.md). Not a defect
 *  probability, maintainability index or benchmark. */
export function priorityScore(complexity: number, commits90d: number, coveredRatio: number): number {
  return Math.min(100, Math.round(100 * (0.42 * complexity / 48 + 0.35 * commits90d / 44 + 0.23 * (1 - coveredRatio))));
}

/** A13: the heuristic only when every input has a value; otherwise unknown, never a
 *  score computed from a stand-in 0. */
export function priorityEvidence(complexity: MetricValue, commits90d: MetricValue, covered: MetricValue, total: MetricValue): MetricValue {
  if (!hasValue(complexity) || !hasValue(commits90d) || !hasValue(covered) || !hasValue(total) || total.value === 0) {
    return unknown(PRIORITY_UNKNOWN_REASON);
  }
  const score = priorityScore(complexity.value, commits90d.value, covered.value / total.value);
  const m = aggregate([complexity, commits90d, covered, total], () => score);
  return { ...m, provenance: { ...m.provenance, detail: 'sample heuristic' } };
}

/** Sort order only, never displayed: highest priority first, unknown last, then path. */
const rank = (m: MetricValue): number => m.value ?? -Infinity;
export function byPriority(a: FileSummary, b: FileSummary): number {
  return rank(b.priority) - rank(a.priority) || a.path.localeCompare(b.path);
}

function linesValue(obs: Observation | undefined): MetricValue {
  if (!obs) return unknown('Not measured in this scan.', 'inventory');
  if (obs.status === 'measured' && obs.value !== null) return collected(obs.value, 'inventory');
  return unknown(obs.reason ?? 'Not measured in this scan.', 'inventory');
}

function build(snapshot: CodebaseSnapshot): readonly FileSummary[] {
  const lineObs = new Map<EntityId, Observation>();
  for (const o of snapshot.observations) {
    if (o.measurement.metricId === 'physical-lines') lineObs.set(o.entityId, o);
  }
  return snapshot.entities.filter((e) => e.kind === 'file').map((e) => {
    const s = sampleFileSignals(e.id);
    return {
      id: e.id, name: e.name, path: e.path, module: moduleOf(e.path),
      lines: linesValue(lineObs.get(e.id)),
      complexity: sample(s.complexity),
      commits90d: sample(s.commits90d),
      branchesCovered: sample(s.branchesCovered),
      branchesTotal: sample(s.branchesTotal),
      branchCoverage: sample(Math.round((s.branchesCovered / s.branchesTotal) * 100)),
      findings: sample(s.findings),
      highFindings: sample(s.highFindings),
      unusedExports: sample(s.unusedExports),
      directDependents: sample(s.directDependents),
      priority: priorityEvidence(sample(s.complexity), sample(s.commits90d), sample(s.branchesCovered), sample(s.branchesTotal)),
    };
  });
}

const cache = new WeakMap<CodebaseSnapshot, readonly FileSummary[]>();

/** Memoized per snapshot OBJECT: snapshots are immutable (city-store never mutates one). */
export function fileSummariesFor(snapshot: CodebaseSnapshot): readonly FileSummary[] {
  let hit = cache.get(snapshot);
  if (!hit) { hit = build(snapshot); cache.set(snapshot, hit); }
  return hit;
}

const priorityCache = new WeakMap<readonly FileSummary[], readonly FileSummary[]>();

/** Final review F1: every file in `byPriority` order, sorted ONCE per files array (the
 *  array `fileSummariesFor` returns per snapshot). Filtering this keeps the order, so a
 *  screen never re-sorts every file per keystroke. */
export function filesByPriority(files: readonly FileSummary[]): readonly FileSummary[] {
  let hit = priorityCache.get(files);
  if (!hit) { hit = [...files].sort(byPriority); priorityCache.set(files, hit); }
  return hit;
}
