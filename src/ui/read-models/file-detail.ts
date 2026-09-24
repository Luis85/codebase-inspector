// Part 2 §2.3: the File detail screen's read model, for the ONE selected file (P10).
// Source content is never read here (P9): the source facts are inventory metadata only.
import type { EntityId } from '../../domain/entity-id';
import type { CodebaseSnapshot } from '../../domain/model';
import { collected, formatMetric, hasValue, isSampleBacked, unknown, type MetricValue } from '../evidence';
import { sampleTrend } from '../fixtures/sample-signals';
import type { FindingCategory, FindingDetail } from '../../application/evidence/model';
import {
  FILE_CARD_COMPLEXITY, FILE_CARD_COMPLEXITY_CAPTION, FILE_CARD_COVERAGE, FILE_CARD_COVERAGE_CAPTION,
  FILE_CARD_DEPENDENTS, FILE_CARD_DEPENDENTS_CAPTION, FILE_CARD_PRIORITY, FILE_CARD_PRIORITY_CAPTION,
  FILE_HISTORY_COMPLEXITY, FILE_HISTORY_COVERAGE, NOT_MEASURED_REASON, PRIORITY_SCALE_SUFFIX,
} from '../inspector-copy';
import { evidenceIndexFor, type EvidenceIndex } from './evidence-index';
import { touchingFindings } from './findings';
import { moduleLabel, type FileSummary } from './file-summaries';
import { TREND_POINTS, trendLabels } from './overview';

export interface FileDetailCard {
  id: 'complexity' | 'coverage' | 'dependents' | 'priority'; label: string; icon: string;
  value: MetricValue; unit: string; caption: string; tone: 'warning' | 'success' | 'accent';
}
/** Part 6 Y34/Y35: one imported finding, as File detail and Code quality show it.
 *  `severity` is the tool's own word, or 'unrated' when the tool gives none. WP-03
 *  N12/J14: `related` is the finding's other paths (empty for a single-file finding),
 *  `anchored` is whether THIS file is the finding's anchor, and `anchorPath` is the
 *  anchor file's own path, so a related file can say "Reported on <anchorPath>". */
export interface FileFinding {
  id: string; kind: FindingCategory; rule: string; severity: string; line: number | null; endLine: number | null;
  symbol: string | null; detail: FindingDetail; title: string; fingerprint: string;
  related: readonly string[]; anchored: boolean; anchorPath: string;
}
export interface FileHistorySeries {
  id: 'complexity' | 'coverage'; label: string; tone: 'accent' | 'success';
  points: readonly { label: string; value: number }[];
}
export interface FileDetailModel {
  file: FileSummary;
  moduleLabel: string;
  category: string | null;
  bytes: MetricValue;
  cards: readonly FileDetailCard[];
  findingsCount: MetricValue;
  findings: readonly FileFinding[];
  history: readonly FileHistorySeries[];
  usesSample: boolean;
}

function bytesOf(snapshot: CodebaseSnapshot, id: EntityId): MetricValue {
  const obs = snapshot.observations.find((o) => o.entityId === id && o.measurement.metricId === 'byte-size');
  if (!obs) return unknown(NOT_MEASURED_REASON, 'inventory');
  return obs.status === 'measured' && obs.value !== null ? collected(obs.value, 'inventory') : unknown(obs.reason ?? NOT_MEASURED_REASON, 'inventory');
}

export function buildFileDetail(
  snapshot: CodebaseSnapshot, files: readonly FileSummary[], entityId: EntityId | null,
  evidence: EvidenceIndex = evidenceIndexFor(files, null, snapshot.snapshotId),
): FileDetailModel | null {
  if (!entityId) return null;
  const file = files.find((f) => f.id === entityId);
  if (!file) return null;
  const labels = trendLabels(snapshot.providerRun.capturedAt);
  const toPoints = (values: readonly number[]) => values.map((value, i) => ({ label: labels[i] ?? '', value }));
  const history: FileHistorySeries[] = [];
  if (hasValue(file.complexity)) {
    history.push({ id: 'complexity', label: FILE_HISTORY_COMPLEXITY, tone: 'accent', points: toPoints(sampleTrend(`${file.id}:complexity`, file.complexity.value, TREND_POINTS, 4, Infinity)) });
  }
  if (hasValue(file.branchCoverage)) {
    history.push({ id: 'coverage', label: FILE_HISTORY_COVERAGE, tone: 'success', points: toPoints(sampleTrend(`${file.id}:coverage`, file.branchCoverage.value, TREND_POINTS, 5)) });
  }
  const cards: FileDetailCard[] = [
    { id: 'complexity', label: FILE_CARD_COMPLEXITY, icon: 'flame', value: file.complexity, unit: '', caption: FILE_CARD_COMPLEXITY_CAPTION, tone: 'warning' },
    { id: 'coverage', label: FILE_CARD_COVERAGE, icon: 'flask-conical', value: file.branchCoverage, unit: '%',
      caption: FILE_CARD_COVERAGE_CAPTION(formatMetric(file.branchesCovered), formatMetric(file.branchesTotal)), tone: 'success' },
    { id: 'dependents', label: FILE_CARD_DEPENDENTS, icon: 'link', value: file.directDependents, unit: '', caption: FILE_CARD_DEPENDENTS_CAPTION, tone: 'accent' },
    { id: 'priority', label: FILE_CARD_PRIORITY, icon: 'info', value: file.priority, unit: PRIORITY_SCALE_SUFFIX, caption: FILE_CARD_PRIORITY_CAPTION, tone: 'accent' },
  ];
  return {
    file,
    moduleLabel: moduleLabel(file.module),
    category: snapshot.entities.find((e) => e.id === file.id)?.category ?? null,
    bytes: bytesOf(snapshot, file.id),
    cards,
    findingsCount: evidence.perFile(file.id).findings,
    findings: touchingFindings(file, evidence),
    history,
    usesSample: cards.some((c) => isSampleBacked(c.value)),
  };
}
