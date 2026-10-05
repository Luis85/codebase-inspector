// Part 6 Y20/Y22: the fallow report as this plugin reads it. Only the fields the
// normaliser uses are declared; the zod schema beside it (fallow-report-schema.ts)
// checks exactly these and strips the rest, so source text (`fragment`), `actions`,
// `suggestions` and the other sections never reach this type. Plain TypeScript, so the
// UI can import the supported set and the refusal codes without pulling in zod.
//
// WP-03 Part 1 N1, N2: `check` gains four optional relation arrays (`circular_
// dependencies`, `re_export_cycles`, `boundary_violations`, `unresolved_imports`) and
// `health` gains an optional `file_scores`. Each is absent unless the report's writer
// included it (N2); when present, every element is validated (fallow-report-schema.ts,
// read-fallow-report.ts).

export type FallowReportKind = 'combined' | 'dead-code' | 'health' | 'dupes';

/** Y20: exactly the (kind, schema_version) pairs the recorded fixtures cover. */
export const FALLOW_SUPPORTED: readonly { kind: FallowReportKind; schema: number }[] = [
  { kind: 'combined', schema: 11 },
  { kind: 'combined', schema: 12 },
  { kind: 'dead-code', schema: 9 },
  { kind: 'health', schema: 11 },
  { kind: 'dupes', schema: 10 },
];

export function isSupportedFallow(kind: unknown, schema: unknown): kind is FallowReportKind {
  return FALLOW_SUPPORTED.some((s) => s.kind === kind && s.schema === schema);
}

/** Y20: 16 MB, checked with `File.size` before reading and with the text length after. */
export const FALLOW_REPORT_MAX_BYTES = 16 * 1024 * 1024;

/** Y31: every way an import can be refused. `source-mismatch` is decided by the import
 *  dialog after resolving against the snapshot; the reader produces the others. */
export type FallowImportErrorCode = 'too-large' | 'not-json' | 'unsupported' | 'invalid' | 'source-mismatch' | 'read-failed';

export interface RawUnusedEntry {
  path: string;
  export_name: string;
  is_type_only: boolean;
  line: number;
  col: number;
}

/** WP-03 Part 1 N1: one hop of a `circular_dependencies` entry's `edges`. */
export interface RawCycleEdge {
  path: string;
  line: number;
  col: number;
}

/** WP-03 Part 1 N1: an import cycle. `edges` is optional (N2: absent unless the report
 *  writer included it). */
export interface RawCircularDependency {
  files: readonly string[];
  line: number;
  col: number;
  edges?: readonly RawCycleEdge[];
}

/** WP-03 Part 1 N1: a re-export (`export * from`) cycle. */
export interface RawReExportCycle {
  files: readonly string[];
  kind: 'multi-node' | 'self-loop';
}

/** WP-03 Part 1 N1: one import crossing a `.fallowrc.json` zone boundary it may not. */
export interface RawBoundaryViolation {
  from_path: string;
  to_path: string;
  from_zone: string;
  to_zone: string;
  import_specifier: string;
  line: number;
  col: number;
}

/** WP-03 Part 1 N1: one import fallow could not resolve. */
export interface RawUnresolvedImport {
  path: string;
  specifier: string;
  line: number;
  col: number;
}

/** WP-03 Part 1 N1: one `health.file_scores` entry, read for `path`, `fan_in` and
 *  `fan_out` only. */
export interface RawFileScore {
  path: string;
  fan_in: number;
  fan_out: number;
}

export interface RawCheckSection {
  /** Every count fallow reports; Y25 lists the non-zero ones Part 6 does not show. */
  summary: Readonly<Record<string, number>>;
  unused_exports: readonly RawUnusedEntry[];
  unused_types: readonly RawUnusedEntry[];
  circular_dependencies?: readonly RawCircularDependency[];
  re_export_cycles?: readonly RawReExportCycle[];
  boundary_violations?: readonly RawBoundaryViolation[];
  unresolved_imports?: readonly RawUnresolvedImport[];
}

export interface RawCloneInstance {
  file: string;
  start_line: number;
  end_line: number;
}

export interface RawCloneGroup {
  fingerprint: string;
  token_count: number;
  line_count: number;
  instances: readonly RawCloneInstance[];
}

export interface RawDupesSection {
  clone_groups: readonly RawCloneGroup[];
  /** Standalone `dupes` only: groups fallow left out of its own output. */
  clone_groups_omitted?: number;
}

export interface RawHealthFinding {
  path: string;
  name: string;
  line: number;
  col: number;
  cyclomatic: number;
  cognitive: number;
  line_count: number;
  exceeded: string;
  severity: string;
}

export interface RawHealthSection {
  findings: readonly RawHealthFinding[];
  summary: { max_cyclomatic_threshold: number; max_cognitive_threshold: number };
  file_scores?: readonly RawFileScore[];
}

export interface RawWorkspaceDiagnostic {
  path: string;
  kind: string;
  message: string;
}

interface RawCommon {
  schema_version: number;
  version: string;
  workspace_diagnostics?: readonly RawWorkspaceDiagnostic[];
}

/** Y22: a combined report nests the three sections; a single-command report carries its
 *  one section's fields at the top level. */
export type RawFallowReport =
  | (RawCommon & { kind: 'combined'; check?: RawCheckSection; dupes?: RawDupesSection; health?: RawHealthSection })
  | (RawCommon & { kind: 'dead-code' } & RawCheckSection)
  | (RawCommon & { kind: 'health' } & RawHealthSection)
  | (RawCommon & { kind: 'dupes' } & RawDupesSection);

/** Y31: a validated report, or ONE refusal. `detail` is data for the copy, never copy. */
export type FallowReadResult =
  | { ok: true; report: RawFallowReport }
  | { ok: false; code: FallowImportErrorCode; detail: string };
