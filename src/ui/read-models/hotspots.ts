// Part 2 §2.2/§3: the Hotspots screen's read model. The rows are every filtered file,
// highest priority first. The scatter plots only files whose two axes are known; a file
// missing either is counted, never drawn at 0.
import { hasValue, isSampleBacked, type MetricValue } from '../evidence';
import { type CsvColumn, metricColumns, toCsv } from '../export/csv';
import { niceTicks } from '../kit/chart-scale';
import { filesByPriority, moduleLabel, type FileSummary } from './file-summaries';

export const MAX_PLOTTED = 400;
export const TABLE_PAGE = 100;
const SHORTLIST_SIZE = 5;
const SCATTER_TICKS = 5;
/** The review quadrant's churn edge (half the sample range's 44). */
export const CHURN_THRESHOLD = 22;

export type CoverageBand = 'low' | 'mid' | 'high' | 'unknown';
export interface HotspotFilter { module: string | null; query: string }
export interface HotspotPoint { file: FileSummary; x: number; y: number; lines: number | null; band: CoverageBand }
export interface HotspotsModel {
  modules: readonly { name: string; label: string }[];
  rows: readonly FileSummary[];
  points: readonly HotspotPoint[];
  plottable: number;
  unplottable: number;
  shortlist: readonly FileSummary[];
  xMax: number;
  yMax: number;
  xTicks: readonly number[];
  yTicks: readonly number[];
  linesMax: number;
  usesSample: boolean;
}

export function coverageBand(m: MetricValue): CoverageBand {
  if (!hasValue(m)) return 'unknown';
  if (m.value < 60) return 'low';
  return m.value < 80 ? 'mid' : 'high';
}

export function buildHotspotsModel(files: readonly FileSummary[], filter: HotspotFilter): HotspotsModel {
  const q = filter.query.trim().toLowerCase();
  // F1: filter the once-sorted array; filter keeps the priority order, O(n) per keystroke.
  const rows = filesByPriority(files)
    .filter((f) => (filter.module === null || f.module === filter.module) && (!q || f.path.toLowerCase().includes(q)));
  const points: HotspotPoint[] = [];
  let plottable = 0;
  for (const f of rows) {
    if (!hasValue(f.complexity) || !hasValue(f.commits90d)) continue;
    plottable += 1;
    if (points.length < MAX_PLOTTED) {
      points.push({
        file: f, x: f.commits90d.value, y: f.complexity.value,
        lines: hasValue(f.lines) ? f.lines.value : null, band: coverageBand(f.branchCoverage),
      });
    }
  }
  const names = [...new Set(files.map((f) => f.module))].sort((a, b) => a.localeCompare(b));
  const xs = niceTicks(Math.max(0, ...points.map((p) => p.x)), SCATTER_TICKS);
  const ys = niceTicks(Math.max(0, ...points.map((p) => p.y)), SCATTER_TICKS);
  return {
    modules: names.map((name) => ({ name, label: moduleLabel(name) })),
    rows,
    points,
    plottable,
    unplottable: rows.length - plottable,
    shortlist: rows.filter((f) => hasValue(f.priority)).slice(0, SHORTLIST_SIZE),
    xMax: xs.max,
    yMax: ys.max,
    xTicks: xs.ticks,
    yTicks: ys.ticks,
    linesMax: Math.max(1, ...points.map((p) => p.lines ?? 0)),
    usesSample: rows.some((f) => isSampleBacked(f.priority) || isSampleBacked(f.complexity)),
  };
}

const HOTSPOTS_CSV_COLUMNS: readonly CsvColumn<FileSummary>[] = [
  { header: 'path', value: (f) => f.path },
  { header: 'module', value: (f) => moduleLabel(f.module) },
  ...metricColumns<FileSummary>('priority', (f) => f.priority),
  ...metricColumns<FileSummary>('complexity', (f) => f.complexity),
  ...metricColumns<FileSummary>('commits_90d', (f) => f.commits90d),
  ...metricColumns<FileSummary>('branch_coverage_pct', (f) => f.branchCoverage),
  ...metricColumns<FileSummary>('lines', (f) => f.lines),
];

/** P8: every row given. An unknown value is an empty cell whose `_state` column says
 *  why, so absent evidence is never exported as 0. RFC 4180 line endings, and a UTF-8
 *  byte-order mark (F7) so Excel reads non-ASCII paths. */
export function hotspotsCsv(rows: readonly FileSummary[]): string {
  return toCsv(HOTSPOTS_CSV_COLUMNS, rows);
}
