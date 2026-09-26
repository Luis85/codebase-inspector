// Part 6 Y23/Y27: imported evidence, normalised. Provider-neutral in shape, fallow in
// origin. Holds no source text: every field is a path, a number, a tool-assigned name or
// a tool message (Y23's dropped list never reaches it).
import type { FallowReportKind } from './raw-fallow';

export type FindingCategory = 'complexity' | 'duplication' | 'unused-exports' | 'cycle' | 'boundary' | 'unresolved-import';
export const FINDING_CATEGORIES: readonly FindingCategory[] = [
  'complexity', 'duplication', 'unused-exports', 'cycle', 'boundary', 'unresolved-import',
];

/** The tool's rule, one per mapping in Y23. `unused-exports` covers both unused rules.
 *  WP-03 N9: the four relation rules are fallow's own rule ids, verbatim. */
export type FindingRule =
  | 'complexity' | 'duplication' | 'unused-export' | 'unused-type'
  | 'circular-dependencies' | 're-export-cycle' | 'boundary-violation' | 'unresolved-imports';

/** WP-03 N3: one hop of a reported import cycle, `files[i] → files[(i + 1) % n]`. */
export interface RelationHop { readonly from: string; readonly to: string; readonly line: number | null }

export type FindingDetail =
  | {
    kind: 'complexity';
    cognitive: number;
    cyclomatic: number;
    lineCount: number;
    /** fallow's own word for which thresholds were exceeded, verbatim ("cognitive", "all", "crap", …). */
    exceeded: string;
    cognitiveThreshold: number;
    cyclomaticThreshold: number;
  }
  | { kind: 'duplication'; tokenCount: number; lineCount: number; partnerFiles: number }
  | { kind: 'unused'; typeOnly: boolean }
  | { kind: 'cycle'; cycleKind: 'import' | 're-export'; members: readonly string[]; hops: readonly RelationHop[] }
  | { kind: 'boundary'; toPath: string; fromZone: string; toZone: string; specifier: string }
  | { kind: 'unresolved-import'; specifier: string };

export interface EvidenceFinding {
  /** Y24, WP-03 N9: `CX-`, `DU-`, `UN-`, `CY-`, `BV-` or `UR-` plus eight hex digits;
   *  always matches FINDING_ID_PATTERN. */
  id: string;
  category: FindingCategory;
  rule: FindingRule;
  /** The tool's own severity string (`critical`/`high`/`moderate`), or null when it rates none. */
  severity: string | null;
  /** Normalised, POSIX, root-relative, after any strip prefix. */
  path: string;
  line: number | null;
  endLine: number | null;
  symbol: string | null;
  detail: FindingDetail;
  /** WP-03 N10: the finding's other paths, sorted, without the anchor. Omitted (never
   *  `undefined`) for a single-file finding. */
  related?: readonly string[];
}

/** Y25: one reported count Part 6 does not show. `key` is fallow's own key; the UI
 *  labels it with `fallowNotShownLabel` (application code holds no copy). */
export interface NotShownCount {
  key: string;
  count: number;
}

/** WP-03 N3: one reported import cycle, path-level and snapshot-independent. `files`
 *  keeps fallow's own import order; `hops[i]` is `files[i] → files[(i + 1) % n]`. */
export interface ReportedCycle { findingId: string; files: readonly string[]; hops: readonly RelationHop[] }
/** WP-03 N3: one reported re-export (`export * from`) cycle. `files` is sorted: fallow
 *  gives no order for a re-export cycle. */
export interface ReportedReExportCycle { findingId: string; files: readonly string[]; kind: 'multi-node' | 'self-loop' }
/** WP-03 N3: one import crossing a configured `.fallowrc.json` zone boundary. */
export interface ReportedBoundaryViolation {
  findingId: string; from: string; to: string; fromZone: string; toZone: string; specifier: string; line: number;
}
/** WP-03 N3: one import fallow could not resolve. */
export interface ReportedUnresolvedImport { findingId: string; path: string; specifier: string; line: number }
/** WP-03 N8: one file's fan-in/fan-out, from `health.file_scores`. */
export interface ReportedFan { path: string; fanIn: number; fanOut: number }
/** WP-03 N4 (JF2): whether `.fallowrc.json` boundaries were configured and checked. */
export type BoundariesState = 'configured' | 'not-configured' | 'not-reported';

/** WP-03 N3: fallow's dependency evidence, path-level and snapshot-independent, built by
 *  `normalize-relations.ts`. */
export interface RelationEvidence {
  importCycles: readonly ReportedCycle[];
  reExportCycles: readonly ReportedReExportCycle[];
  boundaryViolations: readonly ReportedBoundaryViolation[];
  unresolvedImports: readonly ReportedUnresolvedImport[];
  /** null: the report has no `health.file_scores` (J7). */
  fan: readonly ReportedFan[] | null;
  boundaries: BoundariesState;
  /** A check section with both cycle arrays was read (the `cycle` category is analysed). */
  cyclesReported: boolean;
}

export interface NormalizedEvidence {
  findings: readonly EvidenceFinding[];
  categories: Readonly<Record<FindingCategory, 'analysed' | 'not-analysed'>>;
  notShown: readonly NotShownCount[];
  /** Y23/Y26: report paths `normalizeRelativePath` refused (absolute, `..`, control
   *  characters, …), distinct and sorted. Their findings were dropped. */
  rejectedPaths: readonly string[];
  /** `workspace_diagnostics[].message`, verbatim, rendered as text only. */
  warnings: readonly string[];
  /** WP-03 N3: fallow's dependency evidence. */
  relations: RelationEvidence;
  /** WP-03 N11: `['boundary']` when boundaries were configured off by the user's own
   *  fallow configuration (never missing evidence), else `[]`. */
  notConfigured: readonly FindingCategory[];
}

/** Y27: one attached report and where it came from. */
export interface EvidenceReport {
  provider: 'fallow';
  providerVersion: string;
  reportKind: FallowReportKind;
  schemaVersion: number;
  /** The picked file's name only, never a path, at most 255 characters. */
  fileName: string;
  /** ISO 8601, from the Clock. */
  importedAt: string;
  /** The snapshot the report was attached to; a different current snapshot makes it stale (Y30). */
  snapshotId: string;
  stripPrefix: string | null;
  normalized: NormalizedEvidence;
  /** Part 7 Z25: present only for a run the user started; an imported report never has it.
   *  For a collected report `fileName` is the executable's base name, `importedAt` is when
   *  the result was attached, and `stripPrefix` is null. */
  collected?: CollectedRunProvenance;
  /** Part 7 Z23: set by EvidenceRepository.markStale after an operational run failure. */
  staleReason?: 'failed-run';
}

/** Part 7 Z25: where a collected report came from. Held in memory only (Y28): the absolute
 *  paths are never persisted, exported or put in getState(). "Verified" means the run's
 *  root was the snapshot's own scope.rootPath and that snapshot was still the latest when
 *  the result was published (Z20). */
export interface CollectedRunProvenance {
  origin: 'collected';
  sourceMatch: 'verified';
  runId: string;
  rootPath: string;
  executablePath: string;
  args: readonly string[];
  exitCode: 0 | 1;
  startedAt: string;
  durationMs: number;
  versionTested: boolean;
}

export type EvidenceOrigin = 'imported' | 'collected';

export function originOf(report: EvidenceReport): EvidenceOrigin {
  return report.collected === undefined ? 'imported' : 'collected';
}
