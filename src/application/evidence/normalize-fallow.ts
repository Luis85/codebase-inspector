// Part 6 Y23-Y25, Y27: a validated fallow report in, provider-neutral evidence out. Pure
// and snapshot-independent, so the evidence index can resolve the same report again
// against a newer snapshot (Y30); matching is resolve-findings.ts's job. Only paths,
// numbers, tool names and tool messages are copied: no source text exists in the input
// (fallow-report-schema.ts strips it) and none is produced here.
import { fnv1a32Hex } from '../../domain/hash';
import { normalizeRelativePath } from '../../domain/path-safety';
import type {
  EvidenceFinding, EvidenceReport, FindingCategory, FindingRule, NormalizedEvidence, NotShownCount,
} from './model';
import type {
  RawCheckSection, RawCloneInstance, RawDupesSection, RawFallowReport, RawHealthFinding, RawHealthSection, RawUnusedEntry,
} from './raw-fallow';

/** check.summary keys Part 6 shows (as findings) or that are a total, not a section. */
const SHOWN_SUMMARY_KEYS = new Set(['total_issues', 'unused_exports', 'unused_types']);
const REJECTED_TEXT_MAX = 1024;
const FILE_NAME_MAX = 255;
const VERSION_MAX = 64;

/** Y26: a strip prefix is a normalised relative folder followed by '/', like `src/`. */
function isFolderPrefix(prefix: string): boolean {
  if (!prefix.endsWith('/')) return false;
  const folder = prefix.slice(0, -1);
  try {
    return normalizeRelativePath(folder) === folder;
  } catch {
    return false;
  }
}

interface Sections {
  check: RawCheckSection | null;
  dupes: RawDupesSection | null;
  health: RawHealthSection | null;
}

/** Y22: a combined report nests its sections; a single-command report is its section. */
function sectionsOf(raw: RawFallowReport): Sections {
  switch (raw.kind) {
    case 'combined': return { check: raw.check ?? null, dupes: raw.dupes ?? null, health: raw.health ?? null };
    case 'dead-code': return { check: raw, dupes: null, health: null };
    case 'health': return { check: null, dupes: null, health: raw };
    case 'dupes': return { check: null, dupes: raw, health: null };
  }
}

type PathMapper = (reportPath: string) => string | null;

/** Y26: every report path goes through the scanner's own `normalizeRelativePath`. A
 *  refused path is recorded and yields null (its finding is dropped). The strip prefix,
 *  when chosen, is removed from every path that starts with it. */
function pathMapper(stripPrefix: string | null, rejected: Set<string>): PathMapper {
  return (reportPath) => {
    let path: string;
    try {
      path = normalizeRelativePath(reportPath);
    } catch {
      rejected.add(reportPath.slice(0, REJECTED_TEXT_MAX));
      return null;
    }
    if (stripPrefix !== null && path.length > stripPrefix.length && path.startsWith(stripPrefix)) {
      return path.slice(stripPrefix.length);
    }
    return path;
  };
}

const findingId = (prefix: 'CX' | 'DU' | 'UN', key: string): string => `${prefix}-${fnv1a32Hex(key)}`;
const byPosition = (a: RawHealthFinding, b: RawHealthFinding): number => a.line - b.line || a.col - b.col;

/** Y24: the index of each finding among same-named findings in its file, counted in
 *  source order (line, then column), so reordering the report never renames a finding. */
function occurrenceIndexes(findings: readonly RawHealthFinding[], mapPath: PathMapper): Map<RawHealthFinding, number> {
  const groups = new Map<string, RawHealthFinding[]>();
  for (const f of findings) {
    const path = mapPath(f.path);
    if (path === null) continue;
    const key = `${path}|${f.name}`;
    groups.set(key, [...(groups.get(key) ?? []), f]);
  }
  const index = new Map<RawHealthFinding, number>();
  for (const group of groups.values()) [...group].sort(byPosition).forEach((f, i) => index.set(f, i));
  return index;
}

/** Y23: one finding per health finding. */
function complexityFindings(health: RawHealthSection, mapPath: PathMapper): EvidenceFinding[] {
  const occurrence = occurrenceIndexes(health.findings, mapPath);
  const out: EvidenceFinding[] = [];
  for (const f of health.findings) {
    const path = mapPath(f.path);
    if (path === null) continue;
    out.push({
      id: findingId('CX', `${path}|${f.name}|${occurrence.get(f) ?? 0}`),
      category: 'complexity', rule: 'complexity', severity: f.severity, path,
      line: f.line, endLine: null, symbol: f.name,
      detail: {
        kind: 'complexity', cognitive: f.cognitive, cyclomatic: f.cyclomatic, lineCount: f.line_count, exceeded: f.exceeded,
        cognitiveThreshold: health.summary.max_cognitive_threshold, cyclomaticThreshold: health.summary.max_cyclomatic_threshold,
      },
    });
  }
  return out;
}

/** Y23: one finding per (clone group, instance file). A file holding two instances of the
 *  same group gets one finding, with its earliest instance's range. `partnerFiles`
 *  counts the group's other distinct files, a refused path included. */
function duplicationFindings(dupes: RawDupesSection, mapPath: PathMapper): EvidenceFinding[] {
  const out: EvidenceFinding[] = [];
  for (const group of dupes.clone_groups) {
    const refused = new Set<string>();
    const first = new Map<string, RawCloneInstance>();
    for (const instance of group.instances) {
      const path = mapPath(instance.file);
      if (path === null) {
        refused.add(instance.file);
        continue;
      }
      const seen = first.get(path);
      if (seen === undefined || instance.start_line < seen.start_line) first.set(path, instance);
    }
    const partnerFiles = first.size + refused.size - 1;
    for (const [path, instance] of first) {
      out.push({
        id: findingId('DU', `${group.fingerprint}|${path}`),
        category: 'duplication', rule: 'duplication', severity: null, path,
        line: instance.start_line, endLine: instance.end_line, symbol: null,
        detail: { kind: 'duplication', tokenCount: group.token_count, lineCount: group.line_count, partnerFiles },
      });
    }
  }
  return out;
}

/** Y23: one finding per unused export and per unused type. */
function unusedFindings(entries: readonly RawUnusedEntry[], rule: FindingRule, mapPath: PathMapper): EvidenceFinding[] {
  const out: EvidenceFinding[] = [];
  for (const e of entries) {
    const path = mapPath(e.path);
    if (path === null) continue;
    out.push({
      id: findingId('UN', `${path}|${e.export_name}|${rule}`),
      category: 'unused-exports', rule, severity: null, path,
      line: e.line, endLine: null, symbol: e.export_name,
      detail: { kind: 'unused', typeOnly: e.is_type_only },
    });
  }
  return out;
}

/** Y25: every non-zero check.summary count Part 6 does not show, in the report's order,
 *  and the clone groups a standalone dupes report left out. */
function notShownOf(s: Sections): NotShownCount[] {
  const out: NotShownCount[] = [];
  if (s.check !== null) {
    for (const [key, count] of Object.entries(s.check.summary)) {
      if (!SHOWN_SUMMARY_KEYS.has(key) && count > 0) out.push({ key, count });
    }
  }
  const omitted = s.dupes?.clone_groups_omitted;
  if (omitted !== undefined && omitted > 0) out.push({ key: 'clone_groups_omitted', count: omitted });
  return out;
}

/** Keeps the first finding for each id: an identical key is the same finding reported twice. */
function distinctById(findings: readonly EvidenceFinding[]): EvidenceFinding[] {
  const seen = new Set<string>();
  const out: EvidenceFinding[] = [];
  for (const f of findings) {
    if (seen.has(f.id)) continue;
    seen.add(f.id);
    out.push(f);
  }
  return out;
}

const analysed = (present: boolean): 'analysed' | 'not-analysed' => (present ? 'analysed' : 'not-analysed');

/** Y23: the whole mapping. `stripPrefix` is null, or a folder ending in '/' that the user
 *  chose in the review step (Y26); anything else is a programming error. */
export function normalizeFallow(raw: RawFallowReport, opts: { stripPrefix: string | null }): NormalizedEvidence {
  if (opts.stripPrefix !== null && !isFolderPrefix(opts.stripPrefix)) {
    throw new Error('A strip prefix is a relative folder ending in "/".');
  }
  const s = sectionsOf(raw);
  const rejected = new Set<string>();
  const mapPath = pathMapper(opts.stripPrefix, rejected);
  const findings = distinctById([
    ...(s.health !== null ? complexityFindings(s.health, mapPath) : []),
    ...(s.dupes !== null ? duplicationFindings(s.dupes, mapPath) : []),
    ...(s.check !== null ? unusedFindings(s.check.unused_exports, 'unused-export', mapPath) : []),
    ...(s.check !== null ? unusedFindings(s.check.unused_types, 'unused-type', mapPath) : []),
  ]);
  // Y25: a category is analysed when the report carries its section, even with no finding.
  const categories: Record<FindingCategory, 'analysed' | 'not-analysed'> = {
    complexity: analysed(s.health !== null),
    duplication: analysed(s.dupes !== null),
    'unused-exports': analysed(s.check !== null),
  };
  return {
    findings,
    categories,
    notShown: notShownOf(s),
    rejectedPaths: [...rejected].sort(),
    warnings: (raw.workspace_diagnostics ?? []).map((d) => d.message),
  };
}

/** Y27: the last segment of whatever the browser called the file, never a path. */
function baseName(name: string): string {
  const at = Math.max(name.lastIndexOf('/'), name.lastIndexOf('\\'));
  return name.slice(at + 1).slice(0, FILE_NAME_MAX);
}

/** Y27: the report to attach, with its provenance. */
export function buildEvidenceReport(input: {
  raw: RawFallowReport;
  fileName: string;
  importedAt: string;
  snapshotId: string;
  stripPrefix: string | null;
}): EvidenceReport {
  return {
    provider: 'fallow',
    providerVersion: input.raw.version.slice(0, VERSION_MAX),
    reportKind: input.raw.kind,
    schemaVersion: input.raw.schema_version,
    fileName: baseName(input.fileName),
    importedAt: input.importedAt,
    snapshotId: input.snapshotId,
    stripPrefix: input.stripPrefix,
    normalized: normalizeFallow(input.raw, { stripPrefix: input.stripPrefix }),
  };
}
