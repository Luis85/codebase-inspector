// Part 6 Y23/Y27: imported evidence, normalised. Provider-neutral in shape, fallow in
// origin. Holds no source text: every field is a path, a number, a tool-assigned name or
// a tool message (Y23's dropped list never reaches it).
import type { FallowReportKind } from './raw-fallow';

export type FindingCategory = 'complexity' | 'duplication' | 'unused-exports';
export const FINDING_CATEGORIES: readonly FindingCategory[] = ['complexity', 'duplication', 'unused-exports'];

/** The tool's rule, one per mapping in Y23. `unused-exports` covers both unused rules. */
export type FindingRule = 'complexity' | 'duplication' | 'unused-export' | 'unused-type';

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
  | { kind: 'unused'; typeOnly: boolean };

export interface EvidenceFinding {
  /** Y24: `CX-`, `DU-` or `UN-` plus eight hex digits; always matches FINDING_ID_PATTERN. */
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
}

/** Y25: one reported count Part 6 does not show. `key` is fallow's own key; the UI
 *  labels it with `fallowNotShownLabel` (application code holds no copy). */
export interface NotShownCount {
  key: string;
  count: number;
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
