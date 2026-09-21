// Part 3 Q12/Q13. Coverage is sample and weighted by branches; assertion strength
// (mutation) is never inferred from it and stays unknown.
import type { CodebaseSnapshot } from '../../domain/model';
import {
  countEvidence, formatMetric, hasValue, ratioEvidence, sample, sumEvidence, unknown, type MetricValue,
} from '../evidence';
import { metricColumns, toCsv, type CsvColumn } from '../export/csv';
import { sampleTestRun } from '../fixtures/sample-test-runs';
import {
  MUTATION_NOT_COLLECTED, NO_FILES_REASON, TESTS_CARD_BELOW, TESTS_CARD_BELOW_CAPTION, TESTS_CARD_COVERAGE,
  TESTS_CARD_COVERAGE_CAPTION, TESTS_CARD_MUTATION, TESTS_CARD_RESULTS, TESTS_CARD_RESULTS_CAPTION, TESTS_NO_TEST_FILES,
} from '../inspector-copy';
import { MAX_GRAPH_MODULES } from './architecture';
import { filesByPriority, moduleLabel, type FileSummary } from './file-summaries';
import { coverageBand, type CoverageBand } from './hotspots';
import { moduleCoverage, type ModuleCoverage } from './module-coverage';

export const GAP_THRESHOLD = 60;
export const MAX_TILES = 400;

export type { ModuleCoverage };
export interface CoverageTile { file: FileSummary; band: CoverageBand }
export interface TestRunRow { file: FileSummary; tests: MetricValue; failing: MetricValue; durationMs: MetricValue }
export interface TestsCard {
  id: 'coverage' | 'below' | 'results' | 'mutation'; label: string; icon: string;
  value: MetricValue; unit: string; caption: string; tone: 'success' | 'warning' | 'accent';
}
export interface TestConfidenceModel {
  modules: readonly ModuleCoverage[];
  hiddenModules: number;
  moduleOptions: readonly { name: string; label: string }[];
  gaps: readonly FileSummary[];
  runs: readonly TestRunRow[];
  cards: readonly TestsCard[];
  usesSample: boolean;
}

const commitsRank = (f: FileSummary): number => f.commits90d.value ?? -Infinity;
const byCommits = (a: FileSummary, b: FileSummary): number => commitsRank(b) - commitsRank(a) || a.path.localeCompare(b.path);

/** Q12: sample runs, one per real test file (`category === 'test'`) — never invented. */
function testRuns(snapshot: CodebaseSnapshot, files: readonly FileSummary[]): TestRunRow[] {
  const testIds = new Set(snapshot.entities.filter((e) => e.kind === 'file' && e.category === 'test').map((e) => e.id));
  return files.filter((f) => testIds.has(f.id)).map((file) => {
    const run = sampleTestRun(file.id);
    return { file, tests: sample(run.tests), failing: sample(run.failing), durationMs: sample(run.durationMs) };
  }).sort((a, b) => (b.failing.value ?? 0) - (a.failing.value ?? 0) || a.file.path.localeCompare(b.file.path));
}

function resultsCard(runs: readonly TestRunRow[]): TestsCard {
  const base = { id: 'results' as const, label: TESTS_CARD_RESULTS, icon: 'flask-conical', tone: 'accent' as const };
  if (runs.length === 0) return { ...base, value: unknown(TESTS_NO_TEST_FILES, 'inventory'), unit: '', caption: '' };
  const tests = sumEvidence(runs.map((r) => r.tests));
  const failing = sumEvidence(runs.map((r) => r.failing));
  const passing: MetricValue = hasValue(tests) && hasValue(failing) ? { ...tests, value: tests.value - failing.value } : tests;
  return { ...base, value: passing, unit: ` / ${formatMetric(tests)}`, caption: TESTS_CARD_RESULTS_CAPTION(formatMetric(failing)) };
}

export function buildTestConfidenceModel(snapshot: CodebaseSnapshot, files: readonly FileSummary[]): TestConfidenceModel {
  const all = moduleCoverage(files);
  const covered = sumEvidence(files.map((f) => f.branchesCovered), NO_FILES_REASON);
  const total = sumEvidence(files.map((f) => f.branchesTotal), NO_FILES_REASON);
  const runs = testRuns(snapshot, files);   // E30: computed once, used by `runs` and `resultsCard` below.
  return {
    modules: all.slice(0, MAX_GRAPH_MODULES),
    hiddenModules: Math.max(0, all.length - MAX_GRAPH_MODULES),
    moduleOptions: [...all].sort((a, b) => a.label.localeCompare(b.label)).map((m) => ({ name: m.module, label: m.label })),
    gaps: files.filter((f) => hasValue(f.branchCoverage) && f.branchCoverage.value < GAP_THRESHOLD).sort(byCommits),
    runs,
    cards: [
      { id: 'coverage', label: TESTS_CARD_COVERAGE, icon: 'flask-conical', value: ratioEvidence(covered, total), unit: '%',
        caption: TESTS_CARD_COVERAGE_CAPTION(formatMetric(covered), formatMetric(total)), tone: 'success' },
      { id: 'below', label: TESTS_CARD_BELOW, icon: 'alert-triangle',
        value: countEvidence(files.map((f) => f.branchCoverage), (v) => v < GAP_THRESHOLD, NO_FILES_REASON),
        unit: '', caption: TESTS_CARD_BELOW_CAPTION, tone: 'warning' },
      resultsCard(runs),
      { id: 'mutation', label: TESTS_CARD_MUTATION, icon: 'info', value: unknown(MUTATION_NOT_COLLECTED), unit: '', caption: '', tone: 'accent' },
    ],
    usesSample: files.length > 0,
  };
}

/** Q13: at most MAX_TILES tiles, highest priority first; `total` is the filtered count. */
export function coverageTiles(files: readonly FileSummary[], module: string | null): { tiles: readonly CoverageTile[]; total: number } {
  const scoped = filesByPriority(files).filter((f) => module === null || f.module === module);
  return { tiles: scoped.slice(0, MAX_TILES).map((file) => ({ file, band: coverageBand(file.branchCoverage) })), total: scoped.length };
}

const GAP_COLUMNS: readonly CsvColumn<FileSummary>[] = [
  { header: 'path', value: (f) => f.path },
  { header: 'module', value: (f) => moduleLabel(f.module) },
  ...metricColumns<FileSummary>('branch_coverage_pct', (f) => f.branchCoverage),
  ...metricColumns<FileSummary>('branches_covered', (f) => f.branchesCovered),
  ...metricColumns<FileSummary>('branches_total', (f) => f.branchesTotal),
  ...metricColumns<FileSummary>('commits_90d', (f) => f.commits90d),
];

export function gapsCsv(rows: readonly FileSummary[]): string {
  return toCsv(GAP_COLUMNS, rows);
}
