// Part 6 Y20/Y31: reading a fallow JSON report the user picked. Pure apart from
// `file.text()`: the picked file's text in, a validated `RawFallowReport` or ONE refusal
// out. Nothing is read from the vault and nothing is executed; the report is data only.
// Refusals carry a code and a `detail`, never copy: the import dialog maps them to
// FALLOW_IMPORT_ERROR (src/ui/audit-copy/fallow.ts), because src/application never
// imports src/ui.
import type { z } from 'zod';
import { FALLOW_REPORT } from './fallow-report-schema';
import {
  FALLOW_REPORT_MAX_BYTES, isSupportedFallow, type FallowImportErrorCode, type FallowReadResult,
} from './raw-fallow';

const DETAIL_MAX = 120;
const KIND_TEXT_MAX = 40;
const BOM = 0xfeff;

const refused = (code: FallowImportErrorCode, detail = ''): FallowReadResult => ({ ok: false, code, detail });

/** Y31: the first issue's path joined by '.', for example "health.findings.0.cognitive". */
function issueDetail(issue: z.core.$ZodIssue | undefined): string {
  if (!issue) return '';
  return issue.path.map((p) => String(p)).join('.').slice(0, DETAIL_MAX);
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

/** Y20/Y22: size, JSON, the supported (kind, schema) set, then the schema. */
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
  if (!parsed.success) return refused('invalid', issueDetail(parsed.error.issues[0]));
  return { ok: true, report: parsed.data };
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
