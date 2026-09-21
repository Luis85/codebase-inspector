import type { RouteId } from '../../domain/route-ids';
import { sample, unknown, type MetricValue } from '../evidence';
import type { FileSummary } from './file-summaries';
import { HOTSPOT_THRESHOLD } from './overview';

export interface CitySummaryCard { id: 'hotspots' | 'cycles' | 'unused'; title: string; caption: string; value: MetricValue; route: RouteId }

export function buildCitySummary(files: readonly FileSummary[]): readonly CitySummaryCard[] {
  const hotspots = files.filter((f) => (f.priority.value ?? 0) >= HOTSPOT_THRESHOLD).length;
  const unused = files.reduce((n, f) => n + (f.unusedExports.value ?? 0), 0);
  const empty = files.length === 0;
  return [
    { id: 'hotspots', title: 'Change hotspots', caption: 'Complexity × change × coverage gap', route: 'hotspots',
      value: empty ? unknown('No files in this scan.') : sample(hotspots) },
    { id: 'cycles', title: 'Architectural cycles', caption: 'Inspect module boundaries', route: 'architecture',
      value: unknown('Import graph not collected yet.') },
    { id: 'unused', title: 'Potentially unused exports', caption: 'Verify entry points before deletion', route: 'quality',
      value: empty ? unknown('No files in this scan.') : sample(unused) },
  ];
}
