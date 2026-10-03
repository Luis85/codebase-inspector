// E11/E35: the one weighted module-coverage implementation, built on the shared
// group-by-module loop (file-summaries.ts). Weighted by instrumented branches, not by
// file count. Shared by the Overview (weak-module investigation) and Test confidence
// read models, so there is exactly one such computation in the codebase.
import { ratioEvidence, sumEvidence, type MetricValue } from '../evidence';
import { groupByModule, moduleLabel, type FileSummary } from './file-summaries';

export interface ModuleCoverage {
  module: string; label: string; files: number;
  covered: MetricValue; total: MetricValue; coverage: MetricValue;
}

/** Sorted by file count descending, then label. */
export function moduleCoverage(files: readonly FileSummary[]): ModuleCoverage[] {
  const groups = groupByModule(files);
  return [...groups.entries()].map(([module, fs]) => {
    const covered = sumEvidence(fs.map((f) => f.branchesCovered));
    const total = sumEvidence(fs.map((f) => f.branchesTotal));
    return { module, label: moduleLabel(module), files: fs.length, covered, total, coverage: ratioEvidence(covered, total) };
  }).sort((a, b) => b.files - a.files || a.label.localeCompare(b.label));
}
