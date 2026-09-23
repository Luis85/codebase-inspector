// Part 6 Y20/Y31: reading a fallow JSON report the user picked. Pure apart from
// `file.text()`: the picked file's text in, a validated `RawFallowReport` or ONE refusal
// out. Nothing is read from the vault and nothing is executed; the report is data only.
// Refusals carry a code and a `detail`, never copy: the import dialog maps them to
// FALLOW_IMPORT_ERROR (src/ui/audit-copy/fallow.ts), because src/application never
// imports src/ui.
//
// Fix round 1 (E31, Important 1): the shell schema (fallow-report-schema.ts) leaves every
// hot array (`unused_exports`, `unused_types`, `clone_groups`, its `instances`,
// `findings`, `workspace_diagnostics`) as `z.array(z.unknown())`, so `FALLOW_REPORT.
// safeParse` never validates their elements. `buildReport` below walks each one by hand
// with `firstArrayFailure`, which stops at the first bad element instead of validating —
// and collecting an issue for — every one of them.
//
// Fix round 2 (E31, Important 1 continued): the same attack works through
// `check.summary`/the flattened `summary`, a record whose key count the report also
// controls. `buildCheck` now walks it with `firstRecordFailure`, the record counterpart
// of `firstArrayFailure`.
import type { z } from 'zod';
import {
  CLONE_GROUP_SHELL, CLONE_INSTANCE, FALLOW_REPORT, HEALTH_FINDING, SUMMARY_VALUE, UNUSED_ENTRY, WORKSPACE_DIAGNOSTIC,
  firstArrayFailure, firstRecordFailure,
} from './fallow-report-schema';
import {
  FALLOW_REPORT_MAX_BYTES, isSupportedFallow, type FallowImportErrorCode, type FallowReadResult,
  type RawCheckSection, type RawCloneGroup, type RawDupesSection, type RawFallowReport, type RawHealthSection, type RawWorkspaceDiagnostic,
} from './raw-fallow';

const DETAIL_MAX = 120;
const KIND_TEXT_MAX = 40;
const BOM = 0xfeff;

const refused = (code: FallowImportErrorCode, detail = ''): FallowReadResult => ({ ok: false, code, detail });

type Path = readonly PropertyKey[];
type Built<T> = { ok: true; value: T } | { ok: false; path: Path };

/** Y31: a path (from the shell schema or a manual array walk) joined by '.', for example
 *  "health.findings.0.cognitive". */
function pathDetail(path: Path | undefined): string {
  if (!path) return '';
  return path.map((p) => String(p)).join('.').slice(0, DETAIL_MAX);
}

interface ReportHead { kind: unknown; schema: unknown }

/** The two fields that decide support, read before any validation. */
function headOf(raw: unknown): ReportHead {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return { kind: undefined, schema: undefined };
  return {
    kind: 'kind' in raw ? raw.kind : undefined,
    schema: 'schema_version' in raw ? raw.schema_version : undefined,
  };
}

/** Y20: `<kind>@<schema>` for FALLOW_UNSUPPORTED, or '' when the document does not even
 *  name a kind (a string) and a schema version (a finite number). */
function unsupportedDetail(head: ReportHead): string {
  if (typeof head.kind !== 'string' || typeof head.schema !== 'number' || !Number.isFinite(head.schema)) return '';
  return `${head.kind.slice(0, KIND_TEXT_MAX)}@${head.schema}`;
}

type ShellCheck = { summary: Record<string, unknown>; unused_exports: unknown[]; unused_types: unknown[] };
type ShellHealth = { findings: unknown[]; summary: { max_cyclomatic_threshold: number; max_cognitive_threshold: number } };
type ShellDupes = { clone_groups: unknown[]; clone_groups_omitted?: number };

function buildCheck(raw: ShellCheck, prefix: Path): Built<RawCheckSection> {
  const summaryResult = firstRecordFailure(raw.summary, SUMMARY_VALUE, [...prefix, 'summary']);
  if (!summaryResult.ok) return summaryResult;
  const exportsResult = firstArrayFailure(raw.unused_exports, UNUSED_ENTRY, [...prefix, 'unused_exports']);
  if (!exportsResult.ok) return exportsResult;
  const typesResult = firstArrayFailure(raw.unused_types, UNUSED_ENTRY, [...prefix, 'unused_types']);
  if (!typesResult.ok) return typesResult;
  return { ok: true, value: { summary: summaryResult.values, unused_exports: exportsResult.values, unused_types: typesResult.values } };
}

function buildHealth(raw: ShellHealth, prefix: Path): Built<RawHealthSection> {
  const findingsResult = firstArrayFailure(raw.findings, HEALTH_FINDING, [...prefix, 'findings']);
  if (!findingsResult.ok) return findingsResult;
  return { ok: true, value: { findings: findingsResult.values, summary: raw.summary } };
}

/** Two levels of hot array: each clone group is walked before its own `instances`, so
 *  neither can be used to force zod to collect issues for a huge array in one call.
 *  Fix round 2 (minor): reuses `firstArrayFailure`'s own loop (via its custom-validator
 *  form) for the outer `clone_groups` walk instead of repeating it here; the inner
 *  `instances` walk (prefixed just `['instances']`, relative to the group) still goes
 *  through the same helper in its usual zod-schema form. */
function buildDupes(raw: ShellDupes, prefix: Path): Built<RawDupesSection> {
  const groupsResult = firstArrayFailure<RawCloneGroup>(raw.clone_groups, (item) => {
    const groupResult = CLONE_GROUP_SHELL.safeParse(item);
    if (!groupResult.success) return { ok: false, path: groupResult.error.issues[0]?.path ?? [] };
    const instancesResult = firstArrayFailure(groupResult.data.instances, CLONE_INSTANCE, ['instances']);
    if (!instancesResult.ok) return instancesResult;
    return {
      ok: true,
      value: {
        fingerprint: groupResult.data.fingerprint, token_count: groupResult.data.token_count, line_count: groupResult.data.line_count,
        instances: instancesResult.values,
      },
    };
  }, [...prefix, 'clone_groups']);
  if (!groupsResult.ok) return groupsResult;
  return {
    ok: true,
    value: raw.clone_groups_omitted === undefined ? { clone_groups: groupsResult.values } : { clone_groups: groupsResult.values, clone_groups_omitted: raw.clone_groups_omitted },
  };
}

function buildDiagnostics(items: unknown[] | undefined, prefix: Path): Built<RawWorkspaceDiagnostic[] | undefined> {
  if (items === undefined) return { ok: true, value: undefined };
  const result = firstArrayFailure(items, WORKSPACE_DIAGNOSTIC, [...prefix, 'workspace_diagnostics']);
  return result.ok ? { ok: true, value: result.values } : result;
}

/** Assembles the typed `RawFallowReport` from the shell-parsed document, walking every
 *  hot array by hand (Fix round 1, E31 Important 1). */
function buildReport(data: z.infer<typeof FALLOW_REPORT>): Built<RawFallowReport> {
  const diagnostics = buildDiagnostics(data.workspace_diagnostics, []);
  if (!diagnostics.ok) return diagnostics;
  const common = { schema_version: data.schema_version, version: data.version, ...(diagnostics.value === undefined ? {} : { workspace_diagnostics: diagnostics.value }) };

  if (data.kind === 'combined') {
    const check = data.check === undefined ? ({ ok: true, value: undefined } as const) : buildCheck(data.check, ['check']);
    if (!check.ok) return check;
    const dupes = data.dupes === undefined ? ({ ok: true, value: undefined } as const) : buildDupes(data.dupes, ['dupes']);
    if (!dupes.ok) return dupes;
    const health = data.health === undefined ? ({ ok: true, value: undefined } as const) : buildHealth(data.health, ['health']);
    if (!health.ok) return health;
    return {
      ok: true,
      value: {
        kind: 'combined',
        ...common,
        ...(check.value === undefined ? {} : { check: check.value }),
        ...(dupes.value === undefined ? {} : { dupes: dupes.value }),
        ...(health.value === undefined ? {} : { health: health.value }),
      },
    };
  }
  if (data.kind === 'dead-code') {
    const check = buildCheck(data, []);
    return check.ok ? { ok: true, value: { kind: 'dead-code', ...common, ...check.value } } : check;
  }
  if (data.kind === 'health') {
    const health = buildHealth(data, []);
    return health.ok ? { ok: true, value: { kind: 'health', ...common, ...health.value } } : health;
  }
  const dupes = buildDupes(data, []);
  return dupes.ok ? { ok: true, value: { kind: 'dupes', ...common, ...dupes.value } } : dupes;
}

/** Y20/Y22: size, JSON, the supported (kind, schema) set, the shell shape, then every
 *  hot array element (Fix round 1, E31). */
export function parseFallowReportText(text: string): FallowReadResult {
  if (text.length > FALLOW_REPORT_MAX_BYTES) return refused('too-large');
  const body = text.charCodeAt(0) === BOM ? text.slice(1) : text;
  let raw: unknown;
  try {
    raw = JSON.parse(body);
  } catch {
    return refused('not-json');
  }
  const head = headOf(raw);
  if (!isSupportedFallow(head.kind, head.schema)) return refused('unsupported', unsupportedDetail(head));
  const parsed = FALLOW_REPORT.safeParse(raw);
  if (!parsed.success) return refused('invalid', pathDetail(parsed.error.issues[0]?.path));
  const built = buildReport(parsed.data);
  if (!built.ok) return refused('invalid', pathDetail(built.path));
  return { ok: true, report: built.value };
}

/** Y20: reads the picked file, and only it. A file over 16 MB is refused before it is read. */
export async function readFallowReportFile(file: File): Promise<FallowReadResult> {
  if (file.size > FALLOW_REPORT_MAX_BYTES) return refused('too-large');
  let text: string;
  try {
    text = await file.text();
  } catch {
    return refused('read-failed');
  }
  return parseFallowReportText(text);
}
