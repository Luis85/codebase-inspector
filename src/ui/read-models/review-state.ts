// Part 4 W14 / Part 5 V11–V12: the review state as JSON, for downloadText only. Targets
// and findings are written as source-relative paths, never raw entity ids (which carry
// NUL separators and the repository id). v2 adds `source`: the root folder's name (never
// the absolute path) and a digest of the repository id (never the raw id, which is the
// profile UUID). An entity id is converted only with the strict `parseEntityId`; anything
// that does not parse is left out and counted in `warnings`, never written verbatim.
// The import side is review-state-import.ts.
import { parseEntityId, type EntityId } from '../../domain/entity-id';
import type { BoundaryRule, FindingDisposition, WorkItem, WorkTarget } from '../stores/ports/review-repository';
import type { ReportSection } from '../stores/report-store';
import { fnv1a } from '../fixtures/seeded-random';
import { REVIEW_STATE_NOTE, REVIEW_STATE_SKIPPED } from '../inspector-copy';
import { rootFolderLabel } from './root-label';

export const REVIEW_STATE_SCHEMA_V1 = 'codebase-inspector.review-state.v1';
export const REVIEW_STATE_SCHEMA = 'codebase-inspector.review-state.v2';
/** V14: the longest folder label an import accepts, so every export stays importable. */
export const SOURCE_FOLDER_MAX = 255;
/** Part 5 E9(a): the pattern Task 8's import enforces on a finding id (the part of a
 *  fingerprint after the last '#'). An export never carries what the import refuses. */
const FINDING_ID_PATTERN = /^[A-Za-z0-9-]{1,64}$/;

export interface ReviewStateSource { folder: string; repository: string }

export interface ReviewStateInput {
  workItems: readonly WorkItem[];
  rules: readonly BoundaryRule[];
  dispositions: readonly FindingDisposition[];
  report: { sections: Readonly<Record<ReportSection, boolean>>; note: string };
  exportedAt: Date;
  /** V11: null when no codebase is on screen. */
  source: ReviewStateSource | null;
}

/** V11: names the codebase without revealing its id. */
export function repositoryDigest(repositoryId: string): string {
  return `fnv1a32:${(fnv1a(repositoryId) >>> 0).toString(16).padStart(8, '0')}`;
}

/** V11: the last path segment only (never the absolute root) and the digest (never the id). */
export function reviewStateSource(snapshot: { repositoryId: string; scope: { rootPath: string } } | null): ReviewStateSource | null {
  if (!snapshot) return null;
  const folder = rootFolderLabel(snapshot.scope.rootPath).slice(0, SOURCE_FOLDER_MAX) || '(root)';
  return { folder, repository: repositoryDigest(snapshot.repositoryId) };
}

/** V12: the strict parse only. `entityPath`'s NUL-to-slash fallback would write the repository id. */
function strictPath(id: EntityId): string | null {
  try { return parseEntityId(id).path; } catch { return null; }
}

const exportedTarget = (t: WorkTarget): Record<string, string> | null => {
  if (t.kind !== 'file') return { ...t };
  const path = strictPath(t.entityId);
  return path === null ? null : { kind: 'file', path };
};

/** Fingerprints are `${entityId}#${ruleScopedId}` (Q2); the rule id never contains '#'.
 *  V12: null when there is no '#' or the entity part does not parse. Part 5 E9(a): also
 *  null when the finding id (after the last '#') does not match the import's pattern, so
 *  an export never carries a finding id the import would refuse. */
export function findingRef(fingerprint: string): string | null {
  const at = fingerprint.lastIndexOf('#');
  if (at < 0) return null;
  const findingId = fingerprint.slice(at + 1);
  if (!FINDING_ID_PATTERN.test(findingId)) return null;
  const path = strictPath(fingerprint.slice(0, at));
  return path === null ? null : `${path}#${findingId}`;
}

function skippedWarnings(items: number, decisions: number): string[] {
  return [
    ...(items > 0 ? [REVIEW_STATE_SKIPPED(items, 'work items')] : []),
    ...(decisions > 0 ? [REVIEW_STATE_SKIPPED(decisions, 'finding decisions')] : []),
  ];
}

export function reviewStateJson(input: ReviewStateInput): string {
  const workItems = input.workItems.flatMap((w) => {
    const target = exportedTarget(w.target);
    return target === null ? [] : [{
      id: w.id, target, intent: w.intent, title: w.title, status: w.status,
      priority: w.priority, notes: w.notes, checks: [...w.checks], createdAt: w.createdAt,
      ...(w.updatedAt !== undefined ? { updatedAt: w.updatedAt } : {}),
    }];
  });
  const dispositions = input.dispositions.flatMap((d) => {
    const finding = findingRef(d.fingerprint);
    return finding === null ? [] : [{
      finding, status: d.status, ...(d.reason !== undefined ? { reason: d.reason } : {}), decidedAt: d.decidedAt,
    }];
  });
  const warnings = skippedWarnings(input.workItems.length - workItems.length, input.dispositions.length - dispositions.length);
  const data = {
    schema: REVIEW_STATE_SCHEMA,
    exportedAt: input.exportedAt.toISOString(),
    note: REVIEW_STATE_NOTE,
    source: input.source === null ? null : { folder: input.source.folder, repository: input.source.repository },
    workItems,
    rules: input.rules.map((r) => ({ id: r.id, from: r.from, to: r.to, rationale: r.rationale, createdAt: r.createdAt })),
    dispositions,
    report: { sections: { ...input.report.sections }, note: input.report.note },
    ...(warnings.length > 0 ? { warnings } : {}),
  };
  return `${JSON.stringify(data, null, 2)}\n`;
}
