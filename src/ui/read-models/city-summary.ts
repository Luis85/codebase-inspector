import type { RouteId } from '../../domain/route-ids';
import { countEvidence, unknown, type MetricValue } from '../evidence';
import { IMPORT_GRAPH_UNKNOWN_REASON, NO_FILES_REASON } from '../inspector-copy';
import { evidenceIndexFor, type EvidenceIndex } from './evidence-index';
import type { FileSummary } from './file-summaries';
import { HOTSPOT_THRESHOLD } from './overview';

export interface CitySummaryCard { id: 'hotspots' | 'cycles' | 'unused'; title: string; caption: string; value: MetricValue; route: RouteId }

/** Part 6 Y34: the unused card counts imported unused exports and types, or reads Not analysed. */
export function buildCitySummary(
  files: readonly FileSummary[], cycles: MetricValue = unknown(IMPORT_GRAPH_UNKNOWN_REASON),
  evidence: EvidenceIndex = evidenceIndexFor(files, null, ''),
): readonly CitySummaryCard[] {
  return [
    { id: 'hotspots', title: 'Change hotspots', caption: 'Complexity × change × coverage gap', route: 'hotspots',
      value: countEvidence(files.map((f) => f.priority), (v) => v >= HOTSPOT_THRESHOLD, NO_FILES_REASON) },
    { id: 'cycles', title: 'Architectural cycles', caption: 'Inspect module boundaries', route: 'architecture', value: cycles },
    { id: 'unused', title: 'Potentially unused exports', caption: 'Verify entry points before deletion', route: 'quality',
      value: evidence.totals.unused },
  ];
}
