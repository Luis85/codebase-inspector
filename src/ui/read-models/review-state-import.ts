// Part 5 V14: the review-state import parser. Pure: the picked file's text in, a typed
// state or ONE refusal out. Everything in the file is untrusted input:
// - every object is strict, so an unknown key at any level is refused;
// - every string and array is bounded;
// - the store's own validity rule (`workItemProblem`) and every uniqueness rule run
//   before anything reaches the store.
// File paths become entity ids of the codebase on screen (V16), and a v2 file from
// another codebase is refused (Part 4 E8/E11). The only input is the text of the file the
// user picked (V13); nothing is read from the vault. zod 4 conventions as in
// src/domain/validator.ts (`error.issues`, `.strict()`, `{ error: '…' }`).
import { z } from 'zod';
import { makeEntityId } from '../../domain/entity-id';
import { normalizeRelativePath } from '../../domain/path-safety';
import {
  DISMISS_REASON_MAX, RULE_RATIONALE_MAX, WORK_NOTES_MAX, WORK_TITLE_MAX, workItemProblem,
  type BoundaryRule, type FindingDisposition, type WorkItem, type WorkTarget,
} from '../stores/ports/review-repository';
import { REPORT_NOTE_MAX, type ReportSection } from '../stores/report-store';
import { FINDING_ID_PATTERN, REVIEW_STATE_SCHEMA, REVIEW_STATE_SCHEMA_V1, SOURCE_FOLDER_MAX, repositoryDigest } from './review-state';

export type ImportErrorCode = 'too-large' | 'not-json' | 'unknown-schema' | 'invalid' | 'other-codebase';
export interface ImportedReviewState {
  workItems: WorkItem[];
  rules: BoundaryRule[];
  dispositions: FindingDisposition[];
  report: { sections: Record<ReportSection, boolean>; note: string };
  /** The exporting codebase's folder label. Null for v1, and for v2 exported with no codebase on screen. */
  origin: { folder: string } | null;
}
export type ImportResult = { ok: true; state: ImportedReviewState } | { ok: false; code: ImportErrorCode; detail: string };
/** Reading a picked file adds one more refusal: the file itself could not be read. */
export type ReadResult = ImportResult | { ok: false; code: 'read-failed'; detail: string };

/** V14: 1 MB, checked with `File.size` before reading and with the text length after. */
export const IMPORT_MAX_BYTES = 1_000_000;
const PATH_MAX = 1024;
const DETAIL_MAX = 120;

/** V14: relative (no leading `/` or `\`, no drive letter), no `..` segment, no NUL and no
 *  backslash. `normalizeRelativePath` is the scanner's own rule, and it is stricter still:
 *  it also refuses empty and `.` segments and every control character, which a scanned
 *  path never has. */
function isRelativePath(path: string): boolean {
  if (path.includes('\\')) return false;
  try {
    normalizeRelativePath(path);
    return true;
  } catch {
    return false;
  }
}

/** `<path>#<findingId>`; the finding id never contains '#', so the last one splits. */
function splitFinding(ref: string): { path: string; findingId: string } | null {
  const at = ref.lastIndexOf('#');
  if (at < 0) return null;
  const path = ref.slice(0, at);
  const findingId = ref.slice(at + 1);
  return path.length <= PATH_MAX && isRelativePath(path) && FINDING_ID_PATTERN.test(findingId) ? { path, findingId } : null;
}

/** Indexes of entries whose key an earlier entry already had. */
function duplicateIndexes<T>(entries: readonly T[], key: (entry: T) => string): number[] {
  const seen = new Set<string>();
  const duplicates: number[] = [];
  entries.forEach((entry, index) => {
    const k = key(entry);
    if (seen.has(k)) duplicates.push(index);
    else seen.add(k);
  });
  return duplicates;
}

const trimmedBetween = (min: number, max: number) => z.string().refine((s) => {
  const n = s.trim().length;
  return n >= min && n <= max;
}, { error: `Must be ${min}–${max} characters after trimming.` });

const ISO = z.iso.datetime();
const PATH = z.string().min(1).max(PATH_MAX).refine(isRelativePath, { error: 'Must be a relative path inside the codebase.' });

const TARGET = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('file'), path: PATH }).strict(),
  z.object({ kind: z.literal('package'), name: z.string().min(1).max(214) }).strict(),
  z.object({ kind: z.literal('module'), module: z.string().min(1).max(255) }).strict(),
]);
type ImportedTarget = z.output<typeof TARGET>;
const targetKey = (t: ImportedTarget): string => JSON.stringify([t.kind, t.kind === 'file' ? t.path : t.kind === 'package' ? t.name : t.module]);

/** Which field each `workItemProblem` answer is about. */
const PROBLEM_FIELD = { 'title-empty': 'title', 'title-long': 'title', 'notes-long': 'notes', unverified: 'status' } as const;

/** Part 6 Y7: the three record schemas are exported for the durable codec
 *  (review-record-codec.ts), which validates every stored record with them. The list
 *  rules (caps, duplicates) stay here, with the import. */
export const WORK_ITEM = z.object({
  id: z.string().regex(/^wi-\d{1,6}$/),
  target: TARGET,
  intent: z.enum(['refactor', 'tests', 'review', 'pairing', 'documentation']),
  title: trimmedBetween(1, WORK_TITLE_MAX),
  status: z.enum(['investigate', 'planned', 'in-progress', 'verified']),
  priority: z.enum(['high', 'medium', 'low']),
  notes: z.string().max(WORK_NOTES_MAX),
  checks: z.tuple([z.boolean(), z.boolean(), z.boolean()]),
  createdAt: ISO,
  updatedAt: ISO.optional(),
}).strict().superRefine((item, ctx) => {
  // The store's own rule: `verified` needs all three checks (Part 4 W9).
  const problem = workItemProblem(item);
  if (problem !== null) ctx.addIssue({ code: 'custom', path: [PROBLEM_FIELD[problem]], message: `The store refuses this item (${problem}).` });
});
const WORK_ITEMS = z.array(WORK_ITEM).max(2000).superRefine((items, ctx) => {
  for (const i of duplicateIndexes(items, (w) => w.id)) ctx.addIssue({ code: 'custom', path: [i, 'id'], message: 'Duplicate work item id.' });
  for (const i of duplicateIndexes(items, (w) => `${targetKey(w.target)}:${w.intent}`)) {
    ctx.addIssue({ code: 'custom', path: [i, 'target'], message: 'A second work item for the same target and intent.' });
  }
});

export const RULE = z.object({
  id: z.string().regex(/^AR-\d{3,6}$/),
  from: z.string().min(1).max(255),
  to: z.string().min(1).max(255),
  // Part 5 E9(b): bounded by the same constant the store's `addRule` refuses beyond.
  rationale: trimmedBetween(1, RULE_RATIONALE_MAX),
  createdAt: ISO,
}).strict().refine((r) => r.from !== r.to, { error: 'A rule needs two different modules.', path: ['to'] });
const RULES = z.array(RULE).max(500).superRefine((rules, ctx) => {
  for (const i of duplicateIndexes(rules, (r) => r.id)) ctx.addIssue({ code: 'custom', path: [i, 'id'], message: 'Duplicate rule id.' });
  for (const i of duplicateIndexes(rules, (r) => JSON.stringify([r.from, r.to]))) ctx.addIssue({ code: 'custom', path: [i, 'to'], message: 'Duplicate rule.' });
});

export const DISPOSITION = z.object({
  finding: z.string().max(PATH_MAX + 65).refine((f) => splitFinding(f) !== null, { error: 'Must be <relative path>#<finding id>.' }),
  status: z.enum(['acknowledged', 'dismissed']),
  reason: z.string().optional(),
  decidedAt: ISO,
}).strict().superRefine((d, ctx) => {
  const length = d.reason === undefined ? 0 : d.reason.trim().length;
  if (d.status === 'dismissed' && (length < 1 || length > DISMISS_REASON_MAX)) {
    ctx.addIssue({ code: 'custom', path: ['reason'], message: 'A dismissal needs a reason.' });
  }
  if (d.status === 'acknowledged' && d.reason !== undefined) {
    ctx.addIssue({ code: 'custom', path: ['reason'], message: 'An acknowledgement carries no reason.' });
  }
});
const DISPOSITIONS = z.array(DISPOSITION).max(5000).superRefine((ds, ctx) => {
  for (const i of duplicateIndexes(ds, (d) => d.finding)) ctx.addIssue({ code: 'custom', path: [i, 'finding'], message: 'Duplicate decision.' });
});

const REPORT = z.object({
  sections: z.object({
    summary: z.boolean(), architecture: z.boolean(), hotspots: z.boolean(), security: z.boolean(), plan: z.boolean(),
  }).strict(),
  note: z.string().max(REPORT_NOTE_MAX),
}).strict();

const COMMON = {
  exportedAt: ISO,
  note: z.string().max(500),
  workItems: WORK_ITEMS,
  rules: RULES,
  dispositions: DISPOSITIONS,
  report: REPORT,
};
const V1 = z.object({ schema: z.literal(REVIEW_STATE_SCHEMA_V1), ...COMMON }).strict();
const V2 = z.object({
  schema: z.literal(REVIEW_STATE_SCHEMA),
  ...COMMON,
  source: z.object({
    folder: z.string().min(1).max(SOURCE_FOLDER_MAX),
    repository: z.string().regex(/^fnv1a32:[0-9a-f]{8}$/),
  }).strict().nullable(),
  warnings: z.array(z.string().max(200)).max(20).optional(),
}).strict();
type Parsed = z.output<typeof V1> | z.output<typeof V2>;

const refused = (code: ImportErrorCode, detail = ''): ImportResult => ({ ok: false, code, detail });

/** V15: the first issue's path, joined by '.' (for example "workItems.2.title"). An
 *  unknown key is named too, so the reader can find it. */
function issueDetail(issue: z.core.$ZodIssue | undefined): string {
  if (!issue) return '';
  const path = issue.path.map((p) => String(p));
  if (issue.code === 'unrecognized_keys' && issue.keys[0] !== undefined) path.push(issue.keys[0]);
  return path.join('.').slice(0, DETAIL_MAX);
}

function toTarget(t: ImportedTarget, repositoryId: string): WorkTarget {
  if (t.kind === 'file') return { kind: 'file', entityId: makeEntityId(repositoryId, 'file', t.path) };
  return t.kind === 'package' ? { kind: 'package', name: t.name } : { kind: 'module', module: t.module };
}

/** V16 / Part 6 Y7: one validated work item in the store's shape, its file path an entity
 *  id of `repositoryId`. Shared by `toState` and the durable codec (review-record-codec.ts). */
export function toWorkItem(w: z.output<typeof WORK_ITEM>, repositoryId: string): WorkItem {
  return {
    id: w.id, target: toTarget(w.target, repositoryId), intent: w.intent, title: w.title.trim(), status: w.status,
    priority: w.priority, notes: w.notes, checks: [w.checks[0], w.checks[1], w.checks[2]], createdAt: w.createdAt,
    ...(w.updatedAt !== undefined ? { updatedAt: w.updatedAt } : {}),
  };
}

export function toRule(r: z.output<typeof RULE>): BoundaryRule {
  return { id: r.id, from: r.from, to: r.to, rationale: r.rationale.trim(), createdAt: r.createdAt };
}

/** A decision's `<path>#<findingId>` becomes `<entity id of that path>#<findingId>`. */
export function toDisposition(d: z.output<typeof DISPOSITION>, repositoryId: string): FindingDisposition | null {
  const ref = splitFinding(d.finding);
  return ref === null ? null : {
    fingerprint: `${makeEntityId(repositoryId, 'file', ref.path)}#${ref.findingId}`, status: d.status,
    ...(d.reason !== undefined ? { reason: d.reason.trim() } : {}), decidedAt: d.decidedAt,
  };
}

/** V16: paths become entity ids of the codebase on screen; findings become `<that id>#<findingId>`. */
function toState(data: Parsed, repositoryId: string, origin: { folder: string } | null): ImportedReviewState {
  return {
    workItems: data.workItems.map((w) => toWorkItem(w, repositoryId)),
    rules: data.rules.map((r) => toRule(r)),
    dispositions: data.dispositions.flatMap((d) => {
      const decision = toDisposition(d, repositoryId);
      return decision === null ? [] : [decision];
    }),
    report: { sections: { ...data.report.sections }, note: data.report.note },
    origin,
  };
}

/** V14: strict parse of a review-state file for the codebase on screen. */
export function parseReviewState(text: string, current: { repositoryId: string }): ImportResult {
  if (text.length > IMPORT_MAX_BYTES) return refused('too-large');
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return refused('not-json');
  }
  const schema = typeof raw === 'object' && raw !== null && 'schema' in raw ? raw.schema : undefined;
  if (schema !== REVIEW_STATE_SCHEMA && schema !== REVIEW_STATE_SCHEMA_V1) return refused('unknown-schema');
  const parsed = schema === REVIEW_STATE_SCHEMA ? V2.safeParse(raw) : V1.safeParse(raw);
  if (!parsed.success) return refused('invalid', issueDetail(parsed.error.issues[0]));
  const source = parsed.data.schema === REVIEW_STATE_SCHEMA ? parsed.data.source : null;
  if (source !== null && source.repository !== repositoryDigest(current.repositoryId)) return refused('other-codebase', source.folder);
  return { ok: true, state: toState(parsed.data, current.repositoryId, source === null ? null : { folder: source.folder }) };
}

/** V13/V14: reads the picked file, and only it. A file over 1 MB is refused before it is read. */
export async function readReviewStateFile(file: Blob, current: { repositoryId: string }): Promise<ReadResult> {
  if (file.size > IMPORT_MAX_BYTES) return refused('too-large');
  let text: string;
  try {
    text = await file.text();
  } catch {
    return { ok: false, code: 'read-failed', detail: '' };
  }
  return parseReviewState(text, current);
}
