// WP-02 spec §4.4: the one per-file read model every screen shares. Real inventory values
// are `collected`; everything a provider does not yet collect comes from the sample
// provider and says so.
import type { EntityId } from '../../domain/entity-id';
import type { CodebaseSnapshot, Observation } from '../../domain/model';
import { collected, sample, unknown, type MetricValue } from '../evidence';
import { sampleFileSignals } from '../fixtures/sample-signals';

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

export function moduleOf(path: string): string {
  const slash = path.indexOf('/');
  return slash > 0 ? path.slice(0, slash) : '(root)';
}

/** The prototype's transparent SAMPLE heuristic (IMPLEMENTATION-HANDOFF.md). Not a defect
 *  probability, maintainability index or benchmark. */
export function priorityScore(complexity: number, commits90d: number, coveredRatio: number): number {
  return Math.min(100, Math.round(100 * (0.42 * complexity / 48 + 0.35 * commits90d / 44 + 0.23 * (1 - coveredRatio))));
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
    const ratio = s.branchesCovered / s.branchesTotal;
    return {
      id: e.id, name: e.name, path: e.path, module: moduleOf(e.path),
      lines: linesValue(lineObs.get(e.id)),
      complexity: sample(s.complexity),
      commits90d: sample(s.commits90d),
      branchesCovered: sample(s.branchesCovered),
      branchesTotal: sample(s.branchesTotal),
      branchCoverage: sample(Math.round(ratio * 100)),
      findings: sample(s.findings),
      highFindings: sample(s.highFindings),
      unusedExports: sample(s.unusedExports),
      directDependents: sample(s.directDependents),
      priority: sample(priorityScore(s.complexity, s.commits90d, ratio), 'sample heuristic'),
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
