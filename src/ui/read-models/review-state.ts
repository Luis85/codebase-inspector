// Part 4 W14: the review state as JSON, for downloadText only. Targets and findings are
// written as source-relative paths, never raw entity ids (which carry NUL separators and
// the repository id). Import is deferred to WP-05 with durable persistence.
import type { BoundaryRule, FindingDisposition, WorkItem, WorkTarget } from '../stores/ports/review-repository';
import type { ReportSection } from '../stores/report-store';
import { REVIEW_STATE_NOTE } from '../inspector-copy';
import { entityPath } from './work-items';

export const REVIEW_STATE_SCHEMA = 'codebase-inspector.review-state.v1';

export interface ReviewStateInput {
  workItems: readonly WorkItem[];
  rules: readonly BoundaryRule[];
  dispositions: readonly FindingDisposition[];
  report: { sections: Readonly<Record<ReportSection, boolean>>; note: string };
  exportedAt: Date;
}

const exportedTarget = (t: WorkTarget): Record<string, string> =>
  (t.kind === 'file' ? { kind: 'file', path: entityPath(t.entityId) } : { ...t });

/** Fingerprints are `${entityId}#${ruleScopedId}` (Q2); the rule id never contains '#'. */
function findingRef(fingerprint: string): string {
  const at = fingerprint.lastIndexOf('#');
  return at < 0 ? fingerprint : `${entityPath(fingerprint.slice(0, at))}#${fingerprint.slice(at + 1)}`;
}

export function reviewStateJson(input: ReviewStateInput): string {
  const data = {
    schema: REVIEW_STATE_SCHEMA,
    exportedAt: input.exportedAt.toISOString(),
    note: REVIEW_STATE_NOTE,
    workItems: input.workItems.map((w) => ({
      id: w.id, target: exportedTarget(w.target), intent: w.intent, title: w.title, status: w.status,
      priority: w.priority, notes: w.notes, checks: [...w.checks], createdAt: w.createdAt,
      ...(w.updatedAt !== undefined ? { updatedAt: w.updatedAt } : {}),
    })),
    rules: input.rules.map((r) => ({ id: r.id, from: r.from, to: r.to, rationale: r.rationale, createdAt: r.createdAt })),
    dispositions: input.dispositions.map((d) => ({
      finding: findingRef(d.fingerprint), status: d.status, ...(d.reason !== undefined ? { reason: d.reason } : {}), decidedAt: d.decidedAt,
    })),
    report: { sections: { ...input.report.sections }, note: input.report.note },
  };
  return `${JSON.stringify(data, null, 2)}\n`;
}
