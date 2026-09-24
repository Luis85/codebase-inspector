// WP-02 spec §4.3: the Overview screen's read model. No composite health score.
// Part 2 §4 (A13): every aggregate goes through evidence.ts, so a missing input makes the
// result partial or unknown — never a silent 0.
import type { CodebaseSnapshot } from '../../domain/model';
import type { EntityId } from '../../domain/entity-id';
import type { RouteId } from '../../domain/route-ids';
import { originOf } from '../../application/evidence/model';
import {
  countEvidence, formatMetric, hasValue, isSampleBacked, ratioEvidence, sumEvidence, unknown,
  type EvidenceState, type MetricValue,
} from '../evidence';
import { sampleTrend } from '../fixtures/sample-signals';
import {
  ARCH_VIOLATIONS_NOT_CONFIGURED, FALLOW_BOUNDARIES_NOT_CONFIGURED, FALLOW_NOT_ANALYSED, INVESTIGATE_FILE_TITLE,
  INVESTIGATE_HOTSPOT_DETAIL, INVESTIGATE_HOTSPOT_TITLE, EVIDENCE_SOURCE_NONE, INVESTIGATE_LARGEST_DETAIL,
  INVESTIGATE_MODULE_DETAIL, INVESTIGATE_NO_LINES, NO_FILES_REASON, OVERVIEW_ARCH_CAPTION, OVERVIEW_FALLOW_ROW,
  OVERVIEW_FALLOW_SOURCE, OVERVIEW_FINDINGS_CAPTION, OVERVIEW_IMPORTS_ROW, PROTECT_MODULE_TITLE,
} from '../inspector-copy';
import { evidenceIndexFor, type EvidenceIndex, type EvidenceIndexState } from './evidence-index';
import { filesByPriority, ROOT_MODULE, type FileSummary } from './file-summaries';
import { buildQualityModel, openFindingsValue, openHighFindingsValue, type QualityModel } from './findings';
import { moduleCoverage } from './module-coverage';
import { relationModelFor, relationRowState, type RelationModel } from './relations';

export const HOTSPOT_THRESHOLD = 65;
export const HIGH_COMPLEXITY = 30;
export const TREND_POINTS = 7;
const TREND_SPACING_DAYS = 14;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;
/** R6: the fallow row's state follows the evidence index. It is never sample. E37: a report
 *  that analysed only some categories reads partial (the findings total's own state), even
 *  when stale, because partial is the weaker state (evidence.ts). */
const FALLOW_ROW_STATE: Readonly<Record<EvidenceIndexState, EvidenceState>> = { none: 'unknown', current: 'collected', stale: 'stale' };
const fallowRowState = (evidence: EvidenceIndex): EvidenceState =>
  (evidence.totals.findings.state === 'partial' ? 'partial' : FALLOW_ROW_STATE[evidence.state]);

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

export function dateLabels(capturedAt: string, count: number, stepDays: number): string[] {
  const end = new Date(capturedAt).getTime();
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(end - (count - 1 - i) * stepDays * 86_400_000);
    return `${MONTHS[d.getUTCMonth()] ?? ''} ${String(d.getUTCDate()).padStart(2, '0')}`;
  });
}

export function trendLabels(capturedAt: string): string[] {
  return dateLabels(capturedAt, TREND_POINTS, TREND_SPACING_DAYS);
}

function investigations(files: readonly FileSummary[]): Investigation[] {
  if (files.length === 0) return [];
  const top = filesByPriority(files)[0]!;
  const weak = [...moduleCoverage(files)]
    .sort((a, b) => (a.coverage.value ?? Infinity) - (b.coverage.value ?? Infinity) || a.module.localeCompare(b.module))[0]!;
  const largest = files.filter((f) => hasValue(f.lines))
    .sort((a, b) => (b.lines.value ?? 0) - (a.lines.value ?? 0) || a.path.localeCompare(b.path))[0] ?? top;
  return [
    { id: 'top-hotspot', icon: 'flame', route: 'hotspots', entityId: top.id,
      title: INVESTIGATE_HOTSPOT_TITLE(top.name),
      detail: INVESTIGATE_HOTSPOT_DETAIL(formatMetric(top.complexity), formatMetric(top.commits90d), formatMetric(top.branchCoverage, '%')) },
    { id: 'weak-module', icon: 'flask-conical', route: 'tests', entityId: null,
      title: PROTECT_MODULE_TITLE(weak.label, weak.module === ROOT_MODULE),
      detail: INVESTIGATE_MODULE_DETAIL(formatMetric(weak.coverage, '%'), weak.files) },
    { id: 'largest-file', icon: 'building-2', route: 'city', entityId: largest.id,
      title: INVESTIGATE_FILE_TITLE(largest.name),
      detail: hasValue(largest.lines) ? INVESTIGATE_LARGEST_DETAIL(formatMetric(largest.lines)) : INVESTIGATE_NO_LINES },
  ];
}

/** Part 6 E48 (I1): `quality` is the leaf's Quality model, whose decisions it carries, so a
 *  decided finding never counts here. The default is that model with no decisions. */
export function buildOverviewModel(
  snapshot: CodebaseSnapshot, files: readonly FileSummary[],
  cycles: MetricValue = unknown(FALLOW_NOT_ANALYSED, 'fallow'),
  evidence: EvidenceIndex = evidenceIndexFor(files, null, snapshot.snapshotId),
  quality: QualityModel = buildQualityModel(files, evidence, []),
  relations: RelationModel = relationModelFor(files, evidence),
): OverviewModel {
  const covered = sumEvidence(files.map((f) => f.branchesCovered), NO_FILES_REASON);
  const total = sumEvidence(files.map((f) => f.branchesTotal), NO_FILES_REASON);
  const coverage = files.length ? ratioEvidence(covered, total) : unknown(NO_FILES_REASON);
  // Part 6 Y34: imported fallow evidence, or unknown (Not analysed), never a sample count.
  // Part 6 E48 (I1), Polish E2: both the count and its caption read the Quality model's OPEN findings.
  const findings = openFindingsValue(quality);
  const high = openHighFindingsValue(quality);
  const hotspots = countEvidence(files.map((f) => f.priority), (v) => v >= HOTSPOT_THRESHOLD, NO_FILES_REASON);
  const highComplexity = countEvidence(files.map((f) => f.complexity), (v) => v >= HIGH_COMPLEXITY, NO_FILES_REASON);

  const labels = trendLabels(snapshot.providerRun.capturedAt);
  const coverageTrend = hasValue(coverage) ? sampleTrend(`${snapshot.snapshotId}:coverage`, coverage.value, TREND_POINTS, 4) : null;
  const complexityTrend = hasValue(highComplexity)
    ? sampleTrend(`${snapshot.snapshotId}:complexity`, highComplexity.value, TREND_POINTS, 3, Infinity) : null;
  const toPoints = (values: readonly number[]) => values.map((value, i) => ({ label: labels[i] ?? '', value }));

  // N26: fallow's own boundary-violation count, in evidence.count's state (N11's
  // not-configured rule). Fix round 1 #3: only the not-configured reason gets the fixed
  // "boundaries not configured" phrase — any other unknown (no report, or the check
  // section never covered boundaries) falls through to formatMetric's own "—", never a
  // fabricated 0. #4: pluralised, so a single violation reads "1 boundary violation".
  // Final review #9: distinct findings (RelationModel.boundaryFindings), as Quality counts them.
  const violations = evidence.count(relations.boundaryFindings, 'boundary');
  const violationsText = violations.reason === FALLOW_BOUNDARIES_NOT_CONFIGURED
    ? ARCH_VIOLATIONS_NOT_CONFIGURED
    : `${formatMetric(violations)}${hasValue(violations) ? ` boundary violation${violations.value === 1 ? '' : 's'}` : ''}`;

  const cards: OverviewCard[] = [
    { id: 'findings', label: 'Open quality findings', icon: 'code', unit: '', tone: 'warning', trend: null,
      value: findings, caption: OVERVIEW_FINDINGS_CAPTION(formatMetric(high)) },
    { id: 'coverage', label: 'Branch coverage', icon: 'flask-conical', unit: '%', tone: 'success', trend: coverageTrend,
      value: coverage, caption: `${formatMetric(covered)} / ${formatMetric(total)} instrumented branches` },
    { id: 'architecture', label: 'Architecture exceptions', icon: 'network', unit: '', tone: 'danger', trend: null,
      value: cycles, caption: OVERVIEW_ARCH_CAPTION(violationsText) },
    { id: 'hotspots', label: 'Change hotspots', icon: 'flame', unit: '', tone: 'accent', trend: null,
      value: hotspots, caption: `Priority ≥ ${HOTSPOT_THRESHOLD} · last 90 days` },
  ];

  const series: TrendSeries[] = [
    ...(coverageTrend ? [{ id: 'coverage' as const, label: 'Branch coverage (%)', tone: 'success' as const, points: toPoints(coverageTrend) }] : []),
    ...(complexityTrend ? [{ id: 'high-complexity' as const, label: 'High-complexity files (count)', tone: 'accent' as const, points: toPoints(complexityTrend) }] : []),
  ];

  // JF22/E9: shared with Data & scans (relations.ts's relationRowState), so the two can
  // never disagree on the no-report wording ("Not analysed", never "Not collected").
  const imports = relationRowState(relations);
  const coverageRows: EvidenceCoverageRow[] = [
    { id: 'inventory', label: 'File inventory', state: snapshot.completeness === 'partial' ? 'partial' : 'collected', source: 'Built-in scan' },
    { id: 'fallow', label: OVERVIEW_FALLOW_ROW, state: fallowRowState(evidence),
      source: evidence.report ? OVERVIEW_FALLOW_SOURCE(evidence.report.providerVersion, originOf(evidence.report)) : EVIDENCE_SOURCE_NONE },
    { id: 'history', label: 'Git history', state: 'sample', source: 'Sample provider' },
    { id: 'coverage', label: 'Test coverage', state: 'sample', source: 'Sample provider' },
    { id: 'imports', label: OVERVIEW_IMPORTS_ROW, state: imports.state, source: imports.source },
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
