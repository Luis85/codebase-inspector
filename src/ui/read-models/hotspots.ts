// Part 2 §2.2/§3: the Hotspots screen's read model. The rows are every filtered file,
// highest priority first. The scatter plots only files whose two axes are known; a file
// missing either is counted, never drawn at 0.
import { hasValue, isSampleBacked, type MetricValue } from '../evidence';
import { byPriority, moduleLabel, type FileSummary } from './file-summaries';

export const MAX_PLOTTED = 400;
export const TABLE_PAGE = 100;
export const SHORTLIST_SIZE = 5;
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
  linesMax: number;
  usesSample: boolean;
}

export function coverageBand(m: MetricValue): CoverageBand {
  if (!hasValue(m)) return 'unknown';
  if (m.value < 60) return 'low';
  return m.value < 80 ? 'mid' : 'high';
}

const niceMax = (v: number): number => Math.max(10, Math.ceil(v / 10) * 10);

export function buildHotspotsModel(files: readonly FileSummary[], filter: HotspotFilter): HotspotsModel {
  const q = filter.query.trim().toLowerCase();
  const rows = files
    .filter((f) => (filter.module === null || f.module === filter.module) && (!q || f.path.toLowerCase().includes(q)))
    .sort(byPriority);
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
  return {
    modules: names.map((name) => ({ name, label: moduleLabel(name) })),
    rows,
    points,
    plottable,
    unplottable: rows.length - plottable,
    shortlist: rows.filter((f) => hasValue(f.priority)).slice(0, SHORTLIST_SIZE),
    xMax: niceMax(Math.max(0, ...points.map((p) => p.x))),
    yMax: niceMax(Math.max(0, ...points.map((p) => p.y))),
    linesMax: Math.max(1, ...points.map((p) => p.lines ?? 0)),
    usesSample: rows.some((f) => isSampleBacked(f.priority) || isSampleBacked(f.complexity)),
  };
}

/** P8: a string cell starting with = + - @ (or tab/CR) is prefixed with ' so a
 *  spreadsheet never evaluates it. Numbers are never prefixed. */
function csvCell(value: string | number | undefined): string {
  if (value === undefined) return '';
  let s = String(value);
  if (typeof value === 'string' && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

const CSV_METRICS: readonly [string, (f: FileSummary) => MetricValue][] = [
  ['priority', (f) => f.priority],
  ['complexity', (f) => f.complexity],
  ['commits_90d', (f) => f.commits90d],
  ['branch_coverage_pct', (f) => f.branchCoverage],
  ['lines', (f) => f.lines],
];

/** P8: every row given. An unknown value is an empty cell whose `_state` column says
 *  why, so absent evidence is never exported as 0. RFC 4180 line endings. */
export function hotspotsCsv(rows: readonly FileSummary[]): string {
  const header = ['path', 'module', ...CSV_METRICS.flatMap(([name]) => [name, `${name}_state`])];
  const lines = rows.map((f) => [
    csvCell(f.path), csvCell(moduleLabel(f.module)),
    ...CSV_METRICS.flatMap(([, get]) => { const m = get(f); return [csvCell(m.value), csvCell(m.state)]; }),
  ].join(','));
  return `${[header.join(','), ...lines].join('\r\n')}\r\n`;
}
