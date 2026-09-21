// WP-02 spec §4.3: the Overview screen's read model. No composite health score.
// Part 2 §4 (A13): every aggregate goes through evidence.ts, so a missing input makes the
// result partial or unknown — never a silent 0.
import type { CodebaseSnapshot } from '../../domain/model';
import type { EntityId } from '../../domain/entity-id';
import type { RouteId } from '../../domain/route-ids';
import {
  countEvidence, formatMetric, hasValue, isSampleBacked, ratioEvidence, sumEvidence, unknown,
  type EvidenceState, type MetricValue,
} from '../evidence';
import { sampleTrend } from '../fixtures/sample-signals';
import {
  IMPORT_GRAPH_UNKNOWN_REASON, INVESTIGATE_FILE_TITLE, INVESTIGATE_HOTSPOT_DETAIL, INVESTIGATE_HOTSPOT_TITLE,
  INVESTIGATE_LARGEST_DETAIL, INVESTIGATE_MODULE_DETAIL, INVESTIGATE_NO_LINES, NO_FILES_REASON, OVERVIEW_ARCH_CAPTION,
  PROTECT_MODULE_TITLE,
} from '../inspector-copy';
import { filesByPriority, moduleLabel, ROOT_MODULE, type FileSummary } from './file-summaries';

export const HOTSPOT_THRESHOLD = 65;
export const HIGH_COMPLEXITY = 30;
export const TREND_POINTS = 7;
const TREND_SPACING_DAYS = 14;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;

export interface OverviewCard {
  id: 'findings' | 'coverage' | 'architecture' | 'hotspots';
  label: string; icon: string; value: MetricValue; unit: string; caption: string;
  trend: readonly number[] | null;
  tone: 'warning' | 'success' | 'danger' | 'accent';
}
/** `tone` keys the series colour by WHAT it is, not its position: without coverage the
 *  complexity series is first, and must not take coverage's colour. */
export interface TrendSeries {
  id: 'coverage' | 'high-complexity'; label: string; tone: 'success' | 'accent';
  points: readonly { label: string; value: number }[];
}
export interface Investigation { id: string; icon: string; title: string; detail: string; route: RouteId; entityId: EntityId | null }
export interface EvidenceCoverageRow { id: string; label: string; state: EvidenceState; source: string }
export interface OverviewModel {
  fileCount: number;
  cards: readonly OverviewCard[];
  series: readonly TrendSeries[];
  investigations: readonly Investigation[];
  hotspots: readonly FileSummary[];
  coverage: readonly EvidenceCoverageRow[];
  usesSample: boolean;
}

export function trendLabels(capturedAt: string): string[] {
  const end = new Date(capturedAt).getTime();
  return Array.from({ length: TREND_POINTS }, (_, i) => {
    const d = new Date(end - (TREND_POINTS - 1 - i) * TREND_SPACING_DAYS * 86_400_000);
    return `${MONTHS[d.getUTCMonth()] ?? ''} ${String(d.getUTCDate()).padStart(2, '0')}`;
  });
}

function moduleCoverage(files: readonly FileSummary[]): { name: string; count: number; pct: MetricValue }[] {
  const groups = new Map<string, FileSummary[]>();
  for (const f of files) {
    const g = groups.get(f.module);
    if (g) g.push(f); else groups.set(f.module, [f]);
  }
  return [...groups.entries()].map(([name, fs]) => ({
    name, count: fs.length,
    pct: ratioEvidence(sumEvidence(fs.map((f) => f.branchesCovered)), sumEvidence(fs.map((f) => f.branchesTotal))),
  }));
}

function investigations(files: readonly FileSummary[]): Investigation[] {
  if (files.length === 0) return [];
  const top = filesByPriority(files)[0]!;
  const weak = moduleCoverage(files)
    .sort((a, b) => (a.pct.value ?? Infinity) - (b.pct.value ?? Infinity) || a.name.localeCompare(b.name))[0]!;
  const largest = files.filter((f) => hasValue(f.lines))
    .sort((a, b) => (b.lines.value ?? 0) - (a.lines.value ?? 0) || a.path.localeCompare(b.path))[0] ?? top;
  return [
    { id: 'top-hotspot', icon: 'flame', route: 'hotspots', entityId: top.id,
      title: INVESTIGATE_HOTSPOT_TITLE(top.name),
      detail: INVESTIGATE_HOTSPOT_DETAIL(formatMetric(top.complexity), formatMetric(top.commits90d), formatMetric(top.branchCoverage, '%')) },
    { id: 'weak-module', icon: 'flask-conical', route: 'tests', entityId: null,
      title: PROTECT_MODULE_TITLE(moduleLabel(weak.name), weak.name === ROOT_MODULE),
      detail: INVESTIGATE_MODULE_DETAIL(formatMetric(weak.pct, '%'), weak.count) },
    { id: 'largest-file', icon: 'building-2', route: 'city', entityId: largest.id,
      title: INVESTIGATE_FILE_TITLE(largest.name),
      detail: hasValue(largest.lines) ? INVESTIGATE_LARGEST_DETAIL(formatMetric(largest.lines)) : INVESTIGATE_NO_LINES },
  ];
}

export function buildOverviewModel(
  snapshot: CodebaseSnapshot, files: readonly FileSummary[],
  cycles: MetricValue = unknown(IMPORT_GRAPH_UNKNOWN_REASON),
): OverviewModel {
  const covered = sumEvidence(files.map((f) => f.branchesCovered), NO_FILES_REASON);
  const total = sumEvidence(files.map((f) => f.branchesTotal), NO_FILES_REASON);
  const coverage = files.length ? ratioEvidence(covered, total) : unknown(NO_FILES_REASON);
  const findings = sumEvidence(files.map((f) => f.findings), NO_FILES_REASON);
  const high = sumEvidence(files.map((f) => f.highFindings), NO_FILES_REASON);
  const hotspots = countEvidence(files.map((f) => f.priority), (v) => v >= HOTSPOT_THRESHOLD, NO_FILES_REASON);
  const highComplexity = countEvidence(files.map((f) => f.complexity), (v) => v >= HIGH_COMPLEXITY, NO_FILES_REASON);

  const labels = trendLabels(snapshot.providerRun.capturedAt);
  const coverageTrend = hasValue(coverage) ? sampleTrend(`${snapshot.snapshotId}:coverage`, coverage.value, TREND_POINTS, 4) : null;
  const complexityTrend = hasValue(highComplexity)
    ? sampleTrend(`${snapshot.snapshotId}:complexity`, highComplexity.value, TREND_POINTS, 3, Infinity) : null;
  const toPoints = (values: readonly number[]) => values.map((value, i) => ({ label: labels[i] ?? '', value }));

  const cards: OverviewCard[] = [
    { id: 'findings', label: 'Open quality findings', icon: 'code', unit: '', tone: 'warning', trend: null,
      value: findings, caption: `${formatMetric(high)} high-priority findings · sample rules` },
    { id: 'coverage', label: 'Branch coverage', icon: 'flask-conical', unit: '%', tone: 'success', trend: coverageTrend,
      value: coverage, caption: `${formatMetric(covered)} / ${formatMetric(total)} instrumented branches` },
    { id: 'architecture', label: 'Architecture exceptions', icon: 'network', unit: '', tone: 'danger', trend: null,
      value: cycles, caption: OVERVIEW_ARCH_CAPTION },
    { id: 'hotspots', label: 'Change hotspots', icon: 'flame', unit: '', tone: 'accent', trend: null,
      value: hotspots, caption: `Priority ≥ ${HOTSPOT_THRESHOLD} · last 90 days` },
  ];

  const series: TrendSeries[] = [
    ...(coverageTrend ? [{ id: 'coverage' as const, label: 'Branch coverage (%)', tone: 'success' as const, points: toPoints(coverageTrend) }] : []),
    ...(complexityTrend ? [{ id: 'high-complexity' as const, label: 'High-complexity files (count)', tone: 'accent' as const, points: toPoints(complexityTrend) }] : []),
  ];

  const importsSampled = cycles.state !== 'unknown';
  const coverageRows: EvidenceCoverageRow[] = [
    { id: 'inventory', label: 'File inventory', state: snapshot.completeness === 'partial' ? 'partial' : 'collected', source: 'Built-in scan' },
    { id: 'static', label: 'Static signals', state: 'sample', source: 'Sample provider' },
    { id: 'history', label: 'Git history', state: 'sample', source: 'Sample provider' },
    { id: 'coverage', label: 'Test coverage', state: 'sample', source: 'Sample provider' },
    { id: 'imports', label: 'Import graph', state: importsSampled ? 'sample' : 'unknown', source: importsSampled ? 'Sample provider' : 'Not collected' },
    { id: 'mutation', label: 'Mutation testing', state: 'unknown', source: 'Not collected' },
    { id: 'runtime', label: 'Runtime evidence', state: 'unknown', source: 'Not collected' },
  ];

  return {
    fileCount: files.length,
    cards,
    series,
    investigations: investigations(files),
    hotspots: filesByPriority(files).slice(0, 5),
    coverage: coverageRows,
    usesSample: cards.some((c) => isSampleBacked(c.value)),
  };
}
