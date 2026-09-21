// WP-02 spec §4.3: the Overview screen's read model. No composite health score.
import type { CodebaseSnapshot } from '../../domain/model';
import type { EntityId } from '../../domain/entity-id';
import type { RouteId } from '../../domain/route-ids';
import { sample, unknown, type EvidenceState, type MetricValue } from '../evidence';
import { sampleTrend } from '../fixtures/sample-signals';
import type { FileSummary } from './file-summaries';

export const HOTSPOT_THRESHOLD = 65;
export const HIGH_COMPLEXITY = 30;
const TREND_POINTS = 7;
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

const num = (m: MetricValue): number => m.value ?? 0;
const byPriority = (a: FileSummary, b: FileSummary): number =>
  num(b.priority) - num(a.priority) || a.path.localeCompare(b.path);

function trendLabels(capturedAt: string): string[] {
  const end = new Date(capturedAt).getTime();
  return Array.from({ length: TREND_POINTS }, (_, i) => {
    const d = new Date(end - (TREND_POINTS - 1 - i) * TREND_SPACING_DAYS * 86_400_000);
    return `${MONTHS[d.getUTCMonth()] ?? ''} ${String(d.getUTCDate()).padStart(2, '0')}`;
  });
}

function investigations(files: readonly FileSummary[]): Investigation[] {
  if (files.length === 0) return [];
  const top = [...files].sort(byPriority)[0]!;
  const modules = new Map<string, { covered: number; total: number; count: number }>();
  for (const f of files) {
    const m = modules.get(f.module) ?? { covered: 0, total: 0, count: 0 };
    m.covered += num(f.branchesCovered); m.total += num(f.branchesTotal); m.count += 1;
    modules.set(f.module, m);
  }
  const [weakName, weak] = [...modules.entries()]
    .sort(([an, a], [bn, b]) => a.covered / a.total - b.covered / b.total || an.localeCompare(bn))[0]!;
  const largest = [...files].filter((f) => f.lines.value !== undefined)
    .sort((a, b) => num(b.lines) - num(a.lines) || a.path.localeCompare(b.path))[0] ?? top;
  return [
    { id: 'top-hotspot', icon: 'flame', route: 'hotspots', entityId: top.id,
      title: `Review ${top.name}`,
      detail: `Complexity ${num(top.complexity)} · ${num(top.commits90d)} commits in 90 days · ${num(top.branchCoverage)}% branch coverage.` },
    { id: 'weak-module', icon: 'flask-conical', route: 'tests', entityId: null,
      title: `Protect the ${weakName} module`,
      detail: `${Math.round((weak.covered / weak.total) * 100)}% branch coverage across ${weak.count} files.` },
    { id: 'largest-file', icon: 'building-2', route: 'city', entityId: largest.id,
      title: `Inspect ${largest.name}`,
      detail: largest.lines.value !== undefined
        ? `${num(largest.lines).toLocaleString('en-US')} lines — the largest file in this scan.`
        : 'Line count unavailable for this file.' },
  ];
}

export function buildOverviewModel(snapshot: CodebaseSnapshot, files: readonly FileSummary[]): OverviewModel {
  const covered = files.reduce((n, f) => n + num(f.branchesCovered), 0);
  const total = files.reduce((n, f) => n + num(f.branchesTotal), 0);
  const findings = files.reduce((n, f) => n + num(f.findings), 0);
  const high = files.reduce((n, f) => n + num(f.highFindings), 0);
  const hotspotCount = files.filter((f) => num(f.priority) >= HOTSPOT_THRESHOLD).length;
  const highComplexity = files.filter((f) => num(f.complexity) >= HIGH_COMPLEXITY).length;
  const coveragePct = total > 0 ? Math.round((covered / total) * 100) : null;

  const labels = trendLabels(snapshot.providerRun.capturedAt);
  const coverageTrend = coveragePct === null ? null : sampleTrend(`${snapshot.snapshotId}:coverage`, coveragePct, TREND_POINTS, 4);
  const complexityTrend = sampleTrend(`${snapshot.snapshotId}:complexity`, highComplexity, TREND_POINTS, 3, Infinity);
  const toPoints = (values: readonly number[]) => values.map((value, i) => ({ label: labels[i] ?? '', value }));

  const cards: OverviewCard[] = [
    { id: 'findings', label: 'Open quality findings', icon: 'code', unit: '', tone: 'warning', trend: null,
      value: files.length ? sample(findings) : unknown('No files in this scan.'),
      caption: `${high} high-priority findings · sample rules` },
    { id: 'coverage', label: 'Branch coverage', icon: 'flask-conical', unit: '%', tone: 'success', trend: coverageTrend,
      value: coveragePct === null ? unknown('No files in this scan.') : sample(coveragePct),
      caption: `${covered.toLocaleString('en-US')} / ${total.toLocaleString('en-US')} instrumented branches` },
    { id: 'architecture', label: 'Architecture exceptions', icon: 'network', unit: '', tone: 'danger', trend: null,
      value: unknown('Import graph not collected yet.'),
      caption: 'Forbidden imports · cycles' },
    { id: 'hotspots', label: 'Change hotspots', icon: 'flame', unit: '', tone: 'accent', trend: null,
      value: files.length ? sample(hotspotCount) : unknown('No files in this scan.'),
      caption: `Priority ≥ ${HOTSPOT_THRESHOLD} · last 90 days` },
  ];

  const series: TrendSeries[] = [
    ...(coverageTrend ? [{ id: 'coverage' as const, label: 'Branch coverage (%)', tone: 'success' as const, points: toPoints(coverageTrend) }] : []),
    { id: 'high-complexity', label: 'High-complexity files (count)', tone: 'accent', points: toPoints(complexityTrend) },
  ];

  const coverage: EvidenceCoverageRow[] = [
    { id: 'inventory', label: 'File inventory', state: snapshot.completeness === 'partial' ? 'partial' : 'collected', source: 'Built-in scan' },
    { id: 'static', label: 'Static signals', state: 'sample', source: 'Sample provider' },
    { id: 'history', label: 'Git history', state: 'sample', source: 'Sample provider' },
    { id: 'coverage', label: 'Test coverage', state: 'sample', source: 'Sample provider' },
    { id: 'imports', label: 'Import graph', state: 'unknown', source: 'Not collected' },
    { id: 'mutation', label: 'Mutation testing', state: 'unknown', source: 'Not collected' },
    { id: 'runtime', label: 'Runtime evidence', state: 'unknown', source: 'Not collected' },
  ];

  return {
    fileCount: files.length,
    cards,
    series,
    investigations: investigations(files),
    hotspots: [...files].sort(byPriority).slice(0, 5),
    coverage,
    usesSample: cards.some((c) => c.value.state === 'sample'),
  };
}
