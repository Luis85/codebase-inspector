// Part 3 Q8/Q9: a light, collected summary of one snapshot, and the difference between
// two. Everything here comes from the inventory; nothing is sample.
import type { EntityId } from '../../domain/entity-id';
import type { CodebaseSnapshot } from '../../domain/model';
import { hasValue, sumEvidence, unknown, type MetricValue } from '../evidence';
import { COMPARE_LINES_UNKNOWN, COMPARE_MODULE_ABSENT, SNAPSHOT_ENTRY_LABEL } from '../inspector-copy';
import { groupByModule, moduleLabel, type FileSummary } from './file-summaries';
import { dateLabels } from './overview';

const pad2 = (n: number): string => String(n).padStart(2, '0');

/** The one label for a journal entry (journal rows, comparison options, the Compare
 *  buttons' descriptions): capture date plus UTC HH:MM, which tells same-day scans apart. */
export function snapshotEntryLabel(capturedAt: string): string {
  const d = new Date(capturedAt);
  return SNAPSHOT_ENTRY_LABEL(dateLabels(capturedAt, 1, 0)[0] ?? '', `${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}`);
}

export interface JournalModule { module: string; files: number; lines: MetricValue }
export interface JournalEntry {
  snapshotId: string; repositoryId: string; capturedAt: string;
  files: number; lines: MetricValue; modules: readonly JournalModule[]; fileIds: ReadonlySet<EntityId>;
}
export interface ModuleDelta {
  module: string; label: string; filesBefore: number; filesAfter: number;
  linesBefore: MetricValue; linesAfter: MetricValue; changed: boolean;
}
export interface SnapshotComparison {
  base: JournalEntry; current: JournalEntry;
  added: number; removed: number; kept: number; filesDelta: number; linesDelta: MetricValue;
  modules: readonly ModuleDelta[];
}

/** A module absent from one side of the comparison: it is not that its lines are
 *  unknown for some other reason, it simply is not in that snapshot. */
const NONE: JournalModule = { module: '', files: 0, lines: unknown(COMPARE_MODULE_ABSENT, 'inventory') };

export function journalEntryFor(snapshot: CodebaseSnapshot, files: readonly FileSummary[]): JournalEntry {
  const groups = groupByModule(files);
  const modules = [...groups.entries()]
    .map(([module, fs]) => ({ module, files: fs.length, lines: sumEvidence(fs.map((f) => f.lines)) }))
    .sort((a, b) => a.module.localeCompare(b.module));
  return {
    snapshotId: snapshot.snapshotId, repositoryId: snapshot.repositoryId, capturedAt: snapshot.providerRun.capturedAt,
    files: files.length, lines: sumEvidence(files.map((f) => f.lines)), modules, fileIds: new Set(files.map((f) => f.id)),
  };
}

/** Both totals must have a value; a partial total makes the delta partial. */
function delta(before: MetricValue, after: MetricValue): MetricValue {
  if (!hasValue(before) || !hasValue(after)) return unknown(COMPARE_LINES_UNKNOWN, 'inventory');
  const partial = before.state !== 'collected' || after.state !== 'collected';
  return partial
    ? { state: 'partial', value: after.value - before.value, provenance: { source: 'inventory' }, reason: before.reason ?? after.reason ?? COMPARE_LINES_UNKNOWN }
    : { state: 'collected', value: after.value - before.value, provenance: { source: 'inventory' } };
}

const sameLines = (a: MetricValue, b: MetricValue): boolean => a.value === b.value && a.state === b.state;

export function compareSnapshots(base: JournalEntry, current: JournalEntry): SnapshotComparison {
  let kept = 0;
  for (const id of current.fileIds) if (base.fileIds.has(id)) kept += 1;
  const names = [...new Set([...base.modules, ...current.modules].map((m) => m.module))];
  const modules = names.map((module) => {
    const b = base.modules.find((m) => m.module === module) ?? NONE;
    const a = current.modules.find((m) => m.module === module) ?? NONE;
    return {
      module, label: moduleLabel(module), filesBefore: b.files, filesAfter: a.files, linesBefore: b.lines, linesAfter: a.lines,
      changed: b.files !== a.files || !sameLines(b.lines, a.lines),
    };
  }).sort((x, y) => x.label.localeCompare(y.label));
  return {
    base, current, kept, added: current.files - kept, removed: base.files - kept,
    filesDelta: current.files - base.files, linesDelta: delta(base.lines, current.lines), modules,
  };
}
