// WP-03 N3/N4/N9/N10: fallow's dependency evidence, path-level and snapshot-independent,
// and the findings drawn from it. A relation and its finding share one id (assemble).
import type {
  RawBoundaryViolation, RawCheckSection, RawCircularDependency, RawHealthSection, RawReExportCycle,
  RawUnresolvedImport, RawWorkspaceDiagnostic,
} from './raw-fallow';
import { draftIdKey, type DraftFinding, type PathMapper } from './draft-finding';
import type {
  BoundariesState, RelationEvidence, RelationHop, ReportedBoundaryViolation, ReportedCycle, ReportedFan,
  ReportedReExportCycle, ReportedUnresolvedImport,
} from './model';

const BOUNDARIES_NOT_CONFIGURED = 'boundaries-not-configured';

/** Every path mapped, or null when any was refused (the whole record is then dropped, N3).
 *  Every path is offered to `mapPath`, even after a refusal, so every refused path in the
 *  record is recorded (mapPath records rejection as a side effect). */
function mapAll(paths: readonly string[], mapPath: PathMapper): string[] | null {
  const out: string[] = [];
  let refused = false;
  for (const p of paths) {
    const mapped = mapPath(p);
    if (mapped === null) refused = true; else out.push(mapped);
  }
  return refused ? null : out;
}

const byCodeUnit = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

/** N3: hops[i] = files[i] → files[(i+1) % n], with edges[i].line only when edges[i] is
 *  really files[i]'s import (Review Focus 1: an older writer, or a fallow bug, may give
 *  edges out of alignment with files, or omit edges entirely). */
function hopsOf(raw: RawCircularDependency, mapped: readonly string[]): RelationHop[] {
  return mapped.map((from, i) => {
    const edge = raw.edges?.[i];
    const line = edge !== undefined && edge.path === raw.files[i] ? edge.line : null;
    return { from, to: mapped[(i + 1) % mapped.length]!, line };
  });
}

/** N4, amended by JF2: `not-reported` with no check section or no `boundary_violations`
 *  key; else `not-configured` when fallow says so; else `configured` when a violation was
 *  reported or the report's own schema already carries boundaries (schema >= 12); else
 *  `not-reported` (an older writer that reports the key only when it finds something). */
function boundariesOf(check: RawCheckSection | null, diagnostics: readonly RawWorkspaceDiagnostic[], schemaVersion: number): BoundariesState {
  if (check === null || check.boundary_violations === undefined) return 'not-reported';
  if (diagnostics.some((d) => d.kind === BOUNDARIES_NOT_CONFIGURED)) return 'not-configured';
  return check.boundary_violations.length > 0 || schemaVersion >= 12 ? 'configured' : 'not-reported';
}

interface PendingCycle { key: string; files: readonly string[]; hops: readonly RelationHop[] }
interface PendingReExport { key: string; files: readonly string[]; kind: 'multi-node' | 'self-loop' }
interface PendingBoundary {
  key: string; from: string; to: string; fromZone: string; toZone: string; specifier: string; line: number;
}
interface PendingUnresolved { key: string; path: string; specifier: string; line: number }

/** N9/N10: one CY- draft per reported import cycle, anchored on the lexicographically
 *  first member (fallow's own suppression convention); `hops` keeps fallow's own order. */
function importCycleDrafts(raws: readonly RawCircularDependency[], mapPath: PathMapper): { drafts: DraftFinding[]; pending: PendingCycle[] } {
  const drafts: DraftFinding[] = [];
  const pending: PendingCycle[] = [];
  for (const raw of raws) {
    const mapped = mapAll(raw.files, mapPath);
    if (mapped === null) continue;
    const hops = hopsOf(raw, mapped);
    const sorted = [...mapped].sort(byCodeUnit);
    const anchor = sorted[0]!;
    const related = sorted.slice(1);
    const line = hops.find((h) => h.from === anchor)?.line ?? null;
    const key = `import|${sorted.join('\n')}`;
    drafts.push({
      key, prefix: 'CY',
      finding: {
        category: 'cycle', rule: 'circular-dependencies', severity: null, path: anchor,
        line, endLine: null, symbol: null,
        detail: { kind: 'cycle', cycleKind: 'import', members: sorted, hops },
        ...(related.length > 0 ? { related } : {}),
      },
    });
    pending.push({ key, files: mapped, hops });
  }
  return { drafts, pending };
}

/** N9/N10: one CY- draft per reported re-export cycle. No hops: fallow gives no order. */
function reExportCycleDrafts(raws: readonly RawReExportCycle[], mapPath: PathMapper): { drafts: DraftFinding[]; pending: PendingReExport[] } {
  const drafts: DraftFinding[] = [];
  const pending: PendingReExport[] = [];
  for (const raw of raws) {
    const mapped = mapAll(raw.files, mapPath);
    if (mapped === null) continue;
    const sorted = [...mapped].sort(byCodeUnit);
    const anchor = sorted[0]!;
    const related = sorted.slice(1);
    const key = `re-export|${sorted.join('\n')}`;
    drafts.push({
      key, prefix: 'CY',
      finding: {
        category: 'cycle', rule: 're-export-cycle', severity: null, path: anchor,
        line: null, endLine: null, symbol: null,
        detail: { kind: 'cycle', cycleKind: 're-export', members: sorted, hops: [] },
        ...(related.length > 0 ? { related } : {}),
      },
    });
    pending.push({ key, files: sorted, kind: raw.kind });
  }
  return { drafts, pending };
}

/** N9/N10: one BV- draft per reported boundary violation, anchored on `from`. Both paths
 *  are offered to `mapPath` unconditionally, so a refused `to_path` is recorded even when
 *  `from_path` is also refused. */
function boundaryViolationDrafts(raws: readonly RawBoundaryViolation[], mapPath: PathMapper): { drafts: DraftFinding[]; pending: PendingBoundary[] } {
  const drafts: DraftFinding[] = [];
  const pending: PendingBoundary[] = [];
  for (const raw of raws) {
    const from = mapPath(raw.from_path);
    const to = mapPath(raw.to_path);
    if (from === null || to === null) continue;
    const key = `${from}|${to}|${raw.import_specifier}`;
    drafts.push({
      key, prefix: 'BV',
      finding: {
        category: 'boundary', rule: 'boundary-violation', severity: null, path: from,
        line: raw.line, endLine: null, symbol: null,
        detail: { kind: 'boundary', toPath: to, fromZone: raw.from_zone, toZone: raw.to_zone, specifier: raw.import_specifier },
        related: [to],
      },
    });
    pending.push({ key, from, to, fromZone: raw.from_zone, toZone: raw.to_zone, specifier: raw.import_specifier, line: raw.line });
  }
  return { drafts, pending };
}

/** N9/N10: one UR- draft per reported unresolved import. No related file. */
function unresolvedImportDrafts(raws: readonly RawUnresolvedImport[], mapPath: PathMapper): { drafts: DraftFinding[]; pending: PendingUnresolved[] } {
  const drafts: DraftFinding[] = [];
  const pending: PendingUnresolved[] = [];
  for (const raw of raws) {
    const path = mapPath(raw.path);
    if (path === null) continue;
    const key = `${path}|${raw.specifier}`;
    drafts.push({
      key, prefix: 'UR',
      finding: {
        category: 'unresolved-import', rule: 'unresolved-imports', severity: null, path,
        line: raw.line, endLine: null, symbol: null,
        detail: { kind: 'unresolved-import', specifier: raw.specifier },
      },
    });
    pending.push({ key, path, specifier: raw.specifier, line: raw.line });
  }
  return { drafts, pending };
}

/** N3/N8: null when the report has no `health.file_scores`; else every scored file whose
 *  path was accepted, a refused path dropped (never rejecting the whole section). */
function fanOf(health: RawHealthSection | null, mapPath: PathMapper): readonly ReportedFan[] | null {
  if (health?.file_scores === undefined) return null;
  const out: ReportedFan[] = [];
  for (const score of health.file_scores) {
    const path = mapPath(score.path);
    if (path !== null) out.push({ path, fanIn: score.fan_in, fanOut: score.fan_out });
  }
  return out;
}

export interface RelationDrafts {
  drafts: readonly DraftFinding[];
  assemble(idByKey: ReadonlyMap<string, string>): RelationEvidence;
}

/** N3/N9-N11: the whole relation mapping. `assignIds` (normalize-fallow.ts) sees every
 *  draft's key before `assemble` runs, so `idByKey.get(key)!` below is always present. */
export function relationDrafts(
  check: RawCheckSection | null,
  health: RawHealthSection | null,
  diagnostics: readonly RawWorkspaceDiagnostic[],
  mapPath: PathMapper,
  schemaVersion: number,
): RelationDrafts {
  const cycles = check?.circular_dependencies !== undefined ? importCycleDrafts(check.circular_dependencies, mapPath) : { drafts: [], pending: [] };
  const reExports = check?.re_export_cycles !== undefined ? reExportCycleDrafts(check.re_export_cycles, mapPath) : { drafts: [], pending: [] };
  const boundaries = check?.boundary_violations !== undefined ? boundaryViolationDrafts(check.boundary_violations, mapPath) : { drafts: [], pending: [] };
  const unresolved = check?.unresolved_imports !== undefined ? unresolvedImportDrafts(check.unresolved_imports, mapPath) : { drafts: [], pending: [] };
  const fan = fanOf(health, mapPath);
  const boundariesState = boundariesOf(check, diagnostics, schemaVersion);
  const cyclesReported = check !== null && check.circular_dependencies !== undefined && check.re_export_cycles !== undefined;

  return {
    drafts: [...cycles.drafts, ...reExports.drafts, ...boundaries.drafts, ...unresolved.drafts],
    // Fix round 1: looked up by the same composite key assignIds dedupes on
    // (draftIdKey(prefix, key)), never the bare key (see draft-finding.ts).
    assemble: (idByKey: ReadonlyMap<string, string>): RelationEvidence => ({
      importCycles: cycles.pending.map((p): ReportedCycle => ({ findingId: idByKey.get(draftIdKey('CY', p.key))!, files: p.files, hops: p.hops })),
      reExportCycles: reExports.pending.map((p): ReportedReExportCycle => ({ findingId: idByKey.get(draftIdKey('CY', p.key))!, files: p.files, kind: p.kind })),
      boundaryViolations: boundaries.pending.map((p): ReportedBoundaryViolation => ({
        findingId: idByKey.get(draftIdKey('BV', p.key))!, from: p.from, to: p.to, fromZone: p.fromZone, toZone: p.toZone, specifier: p.specifier, line: p.line,
      })),
      unresolvedImports: unresolved.pending.map((p): ReportedUnresolvedImport => ({ findingId: idByKey.get(draftIdKey('UR', p.key))!, path: p.path, specifier: p.specifier, line: p.line })),
      fan,
      boundaries: boundariesState,
      cyclesReported,
    }),
  };
}
