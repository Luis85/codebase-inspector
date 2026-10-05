// read-models/evolution.ts — Part 3 Q8-Q10. Size, snapshot count and the comparison are
// collected; activity, coverage trend, the window card and coupling are sample.
import type { CodebaseSnapshot } from '../../domain/model';
import { collected, hasValue, ratioEvidence, sample, sumEvidence, unknown, type MetricValue } from '../evidence';
import { sampleActivity, sampleCoupling, WINDOW_POINTS, type ChangeWindow } from '../fixtures/sample-evolution';
import { sampleTrend } from '../fixtures/sample-signals';
import {
  EVOLUTION_CARD_CHANGED, EVOLUTION_CARD_CHANGED_CAPTION, EVOLUTION_CARD_SIZE, EVOLUTION_CARD_SIZE_CAPTION,
  EVOLUTION_CARD_SNAPSHOTS, EVOLUTION_CARD_SNAPSHOTS_CAPTION, EVOLUTION_CARD_WINDOW, EVOLUTION_CARD_WINDOW_CAPTION,
  EVOLUTION_COVERAGE_SERIES, NEEDS_SECOND_SNAPSHOT,
} from '../inspector-copy';
import { filesByPriority, type FileSummary } from './file-summaries';
import { dateLabels } from './overview';
import { compareSnapshots, type JournalEntry, type SnapshotComparison } from './snapshot-comparison';

const COUPLING_ROWS = 6;
export interface EvolutionCard { id: 'size' | 'window' | 'snapshots' | 'changed'; label: string; icon: string; value: MetricValue; unit: string; caption: string; tone: 'accent' | 'warning' }
export interface CouplingRow { a: FileSummary; b: FileSummary; rate: MetricValue; shared: MetricValue }
interface CoverageSeries { id: string; label: string; tone: 'success'; points: readonly { label: string; value: number }[] }
export interface EvolutionModel {
  cards: readonly EvolutionCard[];
  activity: readonly { label: string; value: number }[];
  coverage: readonly CoverageSeries[];
  coupling: readonly CouplingRow[];
  journal: readonly JournalEntry[];
  comparison: SnapshotComparison | null;
  usesSample: true;
}

/** Newest first, without `Array#reverse()`'s in-place mutation (and `toReversed` is
 *  ES2023, past this project's ES2020 lib). */
function reversed<T>(items: readonly T[]): T[] {
  const out: T[] = [];
  for (let i = items.length - 1; i >= 0; i -= 1) out.push(items[i]!);
  return out;
}

function changedCard(comparison: SnapshotComparison | null): EvolutionCard {
  const base = { id: 'changed' as const, label: EVOLUTION_CARD_CHANGED, icon: 'git-compare', unit: '', tone: 'warning' as const };
  return comparison
    ? { ...base, value: collected(comparison.added + comparison.removed, 'inventory'), caption: EVOLUTION_CARD_CHANGED_CAPTION(comparison.added, comparison.removed) }
    : { ...base, value: unknown(NEEDS_SECOND_SNAPSHOT, 'session'), caption: '' };
}

export function buildEvolutionModel(
  snapshot: CodebaseSnapshot, files: readonly FileSummary[], journal: readonly JournalEntry[], changeWindow: ChangeWindow,
): EvolutionModel {
  const { count, stepDays } = WINDOW_POINTS[changeWindow];
  const labels = dateLabels(snapshot.providerRun.capturedAt, count, stepDays);
  const toPoints = (values: readonly number[]) => values.map((value, i) => ({ label: labels[i] ?? '', value }));
  const coverageNow = ratioEvidence(sumEvidence(files.map((f) => f.branchesCovered)), sumEvidence(files.map((f) => f.branchesTotal)));
  const coverage: CoverageSeries[] = hasValue(coverageNow)
    ? [{ id: 'coverage', label: EVOLUTION_COVERAGE_SERIES, tone: 'success', points: toPoints(sampleTrend(`${snapshot.repositoryId}:coverage:${changeWindow}`, coverageNow.value, count, 3)) }]
    : [];
  const at = journal.findIndex((e) => e.snapshotId === snapshot.snapshotId);
  const current = at >= 0 ? journal[at] : undefined;
  const previous = at > 0 ? journal[at - 1] : undefined;
  const comparison = current && previous ? compareSnapshots(previous, current) : null;
  const activityValues = sampleActivity(snapshot.repositoryId, changeWindow);
  const activitySum = activityValues.reduce((a, b) => a + b, 0);
  return {
    cards: [
      { id: 'size', label: EVOLUTION_CARD_SIZE, icon: 'file', value: sumEvidence(files.map((f) => f.lines)), unit: ' lines', caption: EVOLUTION_CARD_SIZE_CAPTION, tone: 'accent' },
      // E23/E37: a sample of the activity series, never a UI setting presented as collected evidence.
      { id: 'window', label: EVOLUTION_CARD_WINDOW, icon: 'git-branch', value: sample(activitySum), unit: ' commits', caption: EVOLUTION_CARD_WINDOW_CAPTION(changeWindow), tone: 'accent' },
      { id: 'snapshots', label: EVOLUTION_CARD_SNAPSHOTS, icon: 'arrow-up-down', value: collected(journal.length, 'session'), unit: '', caption: EVOLUTION_CARD_SNAPSHOTS_CAPTION, tone: 'accent' },
      changedCard(comparison),
    ],
    activity: toPoints(activityValues),
    coverage,
    coupling: sampleCoupling(filesByPriority(files), COUPLING_ROWS).map((p) => ({ a: p.a, b: p.b, rate: sample(p.rate), shared: sample(p.shared) })),
    journal: reversed(journal),
    comparison,
    usesSample: true,
  };
}
