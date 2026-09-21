// Part 2 §2.3: SAMPLE static findings for one file, derived from the file's own sample
// counts, so a file's list agrees with its "findings" number everywhere it is shown.
// Seeded per entity and position. A line is only given when the file's line count is
// known, and it never exceeds that count.
import { hasValue } from '../evidence';
import type { FileSummary } from '../read-models/file-summaries';
import { fnv1a, mulberry32 } from './seeded-random';

export type FindingKind = 'complexity' | 'duplication' | 'unused-exports';
export type FindingSeverity = 'high' | 'medium' | 'low';
export interface SampleFinding { id: string; kind: FindingKind; severity: FindingSeverity; line: number | null }

const PREFIX: Readonly<Record<FindingKind, string>> = { complexity: 'CX', duplication: 'DU', 'unused-exports': 'UN' };
const SEVERITY: Readonly<Record<FindingKind, FindingSeverity>> = { complexity: 'high', duplication: 'medium', 'unused-exports': 'low' };

export function sampleFindings(file: FileSummary): SampleFinding[] {
  if (!hasValue(file.findings) || !hasValue(file.highFindings)) return [];
  const total = file.findings.value;
  const high = Math.min(file.highFindings.value, total);
  const kinds: FindingKind[] = [
    ...Array.from({ length: high }, (): FindingKind => 'complexity'),
    ...Array.from({ length: total - high }, (_, i): FindingKind => (i % 2 === 0 ? 'duplication' : 'unused-exports')),
  ];
  const lines = hasValue(file.lines) && file.lines.value > 0 ? file.lines.value : null;
  const slug = file.module.replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase() || 'root';
  return kinds.map((kind, i) => {
    const r = mulberry32(fnv1a(`finding:${file.id}:${i}`));
    return { id: `${PREFIX[kind]}-${slug}-${i}`, kind, severity: SEVERITY[kind], line: lines === null ? null : 1 + Math.floor(r() * lines) };
  });
}
