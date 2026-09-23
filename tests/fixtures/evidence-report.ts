// Part 6: THE shared EvidenceReport fixture (ruling R5). Tasks 9-12 use only this file.
// - `emptyEvidenceReport`: a report with no findings, for the store and wiring tests.
// - `syntheticFallowJson`: the text of a real-shaped fallow 3.27.0 report whose paths are
//   a snapshot's own file paths. It is clearly synthetic (`_meta.synthetic`).
// - `syntheticEvidenceReport`: that text run through the REAL parser and normaliser
//   (parseFallowReportText, then buildEvidenceReport), so every synthetic report passes
//   the real schema and gets real finding ids.
// - `snapshotWithPaths`: a snapshot with chosen paths, for the recorded fixtures.
import { classify } from '../../src/domain/classify';
import { makeEntityId } from '../../src/domain/entity-id';
import { InMemoryEvidenceStore } from '../../src/adapters/storage/in-memory-evidence-store';
import { parseFallowReportText } from '../../src/application/evidence/read-fallow-report';
import { buildEvidenceReport } from '../../src/application/evidence/normalize-fallow';
import { useEvidenceStore } from '../../src/ui/stores/evidence-store';
import type { CodeEntity, CodebaseSnapshot } from '../../src/domain/model';
import type { EvidenceFinding, EvidenceReport, FindingCategory } from '../../src/application/evidence/model';
import { buildSnapshotFixture } from './snapshot-builder';

type Categories = Record<FindingCategory, 'analysed' | 'not-analysed'>;
export const ALL_ANALYSED: Readonly<Categories> = { complexity: 'analysed', duplication: 'analysed', 'unused-exports': 'analysed' };
export const SYNTHETIC_VERSION = '3.27.0';
const IMPORTED_AT = '2026-09-23T10:00:00.000Z';
const SEVERITIES = ['critical', 'high', 'moderate'] as const;

/** A well-formed report with no findings: the store and wiring tests only move it around. */
export function emptyEvidenceReport(snapshotId: string, fileName = 'fallow.json'): EvidenceReport {
  return {
    provider: 'fallow', providerVersion: SYNTHETIC_VERSION, reportKind: 'combined', schemaVersion: 12, fileName,
    importedAt: IMPORTED_AT, snapshotId, stripPrefix: null,
    normalized: { findings: [], categories: { ...ALL_ANALYSED }, notShown: [], rejectedPaths: [], warnings: [] },
  };
}

export interface SyntheticFallowOptions {
  /** `combined` (schema 12, all three sections) or `dead-code` (schema 9, unused exports only). */
  kind?: 'combined' | 'dead-code';
  /** Paths not in the snapshot; each gets one unused export named `orphan` (Y26). */
  unmatchedPaths?: readonly string[];
  /** The export name of the FIRST file's unused export (default `symbol0`), for the text-only tests. */
  symbol?: string;
  /** One `workspace_diagnostics` message, verbatim. */
  warning?: string;
}

interface UnusedRow { path: string; export_name: string; is_type_only: boolean; line: number; col: number }

/** For file i (in snapshot order):
 *  - an unused export `symbol<i>` on line 1 (an unused type on every fourth file, i % 4 === 3);
 *  - on every even file, a complexity finding `fn<i>` on line 2, cycling critical, high,
 *    moderate (files 0, 2 and 4 are critical, high and moderate);
 *  - on files 5k and 5k + 1, a clone group spanning lines 3-6 of both files.
 *  A `dead-code` report carries only the unused part. The counts per N files are: unused N,
 *  complexity ceil(N / 2), and duplication 2 for each group whose second file exists. */
export function syntheticFallowJson(snapshot: CodebaseSnapshot, options: SyntheticFallowOptions = {}): string {
  const paths = snapshot.entities.filter((e) => e.kind === 'file').map((e) => e.path);
  const rows: UnusedRow[] = paths.map((path, i) => ({
    path, export_name: i === 0 && options.symbol !== undefined ? options.symbol : `symbol${i}`, is_type_only: i % 4 === 3, line: 1, col: 7,
  }));
  const orphans: UnusedRow[] = (options.unmatchedPaths ?? []).map((path) => ({ path, export_name: 'orphan', is_type_only: false, line: 1, col: 7 }));
  const unusedExports = [...rows.filter((r) => !r.is_type_only), ...orphans];
  const unusedTypes = rows.filter((r) => r.is_type_only);
  const check = {
    summary: { total_issues: unusedExports.length + unusedTypes.length, unused_files: 0, unused_exports: unusedExports.length, unused_types: unusedTypes.length },
    unused_exports: unusedExports,
    unused_types: unusedTypes,
  };
  const common = {
    version: SYNTHETIC_VERSION,
    elapsed_ms: 12,
    workspace_diagnostics: options.warning === undefined ? [] : [{ path: paths[0] ?? 'package.json', kind: 'synthetic', message: options.warning }],
    _meta: { synthetic: true },
  };
  if (options.kind === 'dead-code') return JSON.stringify({ kind: 'dead-code', schema_version: 9, ...common, ...check });
  const health = {
    findings: paths.flatMap((path, i) => (i % 2 === 0 ? [{
      path, name: `fn${i}`, line: 2, col: 0, cyclomatic: 12, cognitive: 20 + (i % 10), line_count: 8,
      exceeded: 'cognitive_crap', severity: SEVERITIES[(i / 2) % 3]!,
    }] : [])),
    summary: { max_cyclomatic_threshold: 20, max_cognitive_threshold: 15 },
  };
  const dupes = {
    clone_groups: paths.flatMap((path, i) => (i % 5 === 0 ? [{
      fingerprint: `synthetic-${i}`, token_count: 60, line_count: 4,
      instances: [path, paths[i + 1]].filter((p): p is string => p !== undefined).map((file) => ({ file, start_line: 3, end_line: 6 })),
    }] : [])),
  };
  return JSON.stringify({ kind: 'combined', schema_version: 12, ...common, check, dupes, health });
}

export interface SyntheticReportOptions extends SyntheticFallowOptions {
  /** Defaults to the snapshot's own id (current evidence). Any other id makes it stale (Y30). */
  snapshotId?: string;
}

/** The synthetic JSON through the real parser and normaliser. Throws if the schema refuses it. */
export function syntheticEvidenceReport(snapshot: CodebaseSnapshot, options: SyntheticReportOptions = {}): EvidenceReport {
  const parsed = parseFallowReportText(syntheticFallowJson(snapshot, options));
  if (!parsed.ok) throw new Error(`test setup: the synthetic fallow report was refused (${parsed.code} ${parsed.detail})`);
  return buildEvidenceReport({
    raw: parsed.report, fileName: 'synthetic-fallow.json', importedAt: IMPORTED_AT,
    snapshotId: options.snapshotId ?? snapshot.snapshotId, stripPrefix: null,
  });
}

/** The synthetic report's normalised findings, limited to the analysed categories. */
export function syntheticFindings(snapshot: CodebaseSnapshot, categories: Readonly<Categories> = ALL_ANALYSED): readonly EvidenceFinding[] {
  return syntheticEvidenceReport(snapshot).normalized.findings.filter((f) => categories[f.category] === 'analysed');
}

/** Binds the active leaf's evidence store to the snapshot's codebase and attaches a
 *  synthetic report, as App's repository watcher and the S14 dialog do in the plugin. */
export function attachSyntheticReport(snapshot: CodebaseSnapshot, options: SyntheticReportOptions = {}): EvidenceReport {
  const report = syntheticEvidenceReport(snapshot, options);
  const store = useEvidenceStore();
  store.setRepository(new InMemoryEvidenceStore());
  store.bindRepository(snapshot.repositoryId);
  if (!store.attach(report)) throw new Error('test setup: the evidence store refused the report');
  return report;
}

/** A snapshot whose files are exactly `paths`, so a recorded report's own paths resolve. */
export function snapshotWithPaths(paths: readonly string[], repositoryId = 'repo-fallow'): CodebaseSnapshot {
  const base = buildSnapshotFixture({ files: 0, repositoryId });
  const root = base.entities[0]!;
  const files: CodeEntity[] = paths.map((path) => ({
    id: makeEntityId(repositoryId, 'file', path), repositoryId, kind: 'file', path,
    name: path.slice(path.lastIndexOf('/') + 1), parentId: root.id, category: classify(path),
  }));
  return { ...base, entities: [...base.entities, ...files] };
}

/** Task 11: the same snapshot, same id, with only the named files kept. Handed to
 *  syntheticFallowJson / syntheticEvidenceReport / attachSyntheticReport, it gives a report
 *  with findings on those files alone, which is still current for the full snapshot (same
 *  snapshotId and repositoryId). The findings lens needs files WITHOUT findings. */
export function snapshotWithOnlyFiles(snapshot: CodebaseSnapshot, paths: readonly string[]): CodebaseSnapshot {
  const keep = new Set(paths);
  return { ...snapshot, entities: snapshot.entities.filter((e) => e.kind !== 'file' || keep.has(e.path)) };
}
