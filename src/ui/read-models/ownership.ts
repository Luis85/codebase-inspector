// read-models/ownership.ts — Part 3 Q11: module stewardship only. There is no field for
// a person anywhere in this model; teams and concentration are sample.
import { collected, countEvidence, sample, type MetricValue } from '../evidence';
import { metricColumns, toCsv, type CsvColumn } from '../export/csv';
import { sampleStewardship } from '../fixtures/sample-stewardship';
import { OWNERSHIP_ACTION_BODY, OWNERSHIP_ACTION_TITLE, SAMPLE_TEAM_LABELS } from '../inspector-copy';
import { MAX_GRAPH_MODULES } from './architecture';
import { groupByModule, moduleLabel, type FileSummary } from './file-summaries';
import { HOTSPOT_THRESHOLD } from './overview';

export const CONCENTRATION_WARNING = 70;
export interface StewardshipRow { module: string; label: string; team: MetricValue<string>; files: MetricValue; concentration: MetricValue; reviewCandidates: MetricValue }
export interface StewardshipAction { intent: 'pairing' | 'tests' | 'documentation'; module: string; label: string; title: string; body: string }
export interface OwnershipModel { rows: readonly StewardshipRow[]; hiddenModules: number; actions: readonly StewardshipAction[]; usesSample: true }

const INTENTS = ['pairing', 'tests', 'documentation'] as const;
const byConcentration = (a: StewardshipRow, b: StewardshipRow): number =>
  (b.concentration.value ?? 0) - (a.concentration.value ?? 0) || a.label.localeCompare(b.label);

export function buildOwnershipModel(files: readonly FileSummary[]): OwnershipModel {
  const groups = groupByModule(files);
  const all = [...groups.entries()].map(([module, fs]): StewardshipRow => {
    const s = sampleStewardship(module);
    return {
      module, label: moduleLabel(module),
      team: sample(SAMPLE_TEAM_LABELS[s.teamIndex] ?? ''),
      files: collected(fs.length, 'inventory'),
      concentration: sample(s.concentration),
      reviewCandidates: countEvidence(fs.map((f) => f.priority), (v) => v >= HOTSPOT_THRESHOLD),
    };
  }).sort((a, b) => (b.files.value ?? 0) - (a.files.value ?? 0) || a.label.localeCompare(b.label));
  const rows = all.slice(0, MAX_GRAPH_MODULES);
  return {
    rows,
    hiddenModules: Math.max(0, all.length - MAX_GRAPH_MODULES),
    actions: [...rows].sort(byConcentration).slice(0, 3).map((r, i) => {
      const intent = INTENTS[i] ?? 'pairing';
      return { intent, module: r.module, label: r.label, title: OWNERSHIP_ACTION_TITLE[intent](r.label), body: OWNERSHIP_ACTION_BODY[intent] };
    }),
    usesSample: true,
  };
}

const COLUMNS: readonly CsvColumn<StewardshipRow>[] = [
  { header: 'module', value: (r) => r.label },
  ...metricColumns<StewardshipRow>('team', (r) => r.team),
  ...metricColumns<StewardshipRow>('files', (r) => r.files),
  ...metricColumns<StewardshipRow>('concentration_pct', (r) => r.concentration),
  ...metricColumns<StewardshipRow>('review_candidates', (r) => r.reviewCandidates),
];

export function stewardshipCsv(rows: readonly StewardshipRow[]): string {
  return toCsv(COLUMNS, rows);
}
