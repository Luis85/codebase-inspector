// Part 5 Task 8: one valid v2 review-state document, built by the real exporter, and the
// helpers the import tests use to break it one field at a time.
import { makeEntityId } from '../../src/domain/entity-id';
import { reviewStateJson, reviewStateSource } from '../../src/ui/read-models/review-state';
import { parseReviewState, type ImportedReviewState } from '../../src/ui/read-models/review-state-import';
import { NO_CHECKS } from '../../src/ui/stores/ports/review-repository';

export const DOC_REPO = 'repo-xyz';
export const DOC_NOW = '2026-09-22T10:00:00.000Z';
export const DOC_SECTIONS = { summary: true, architecture: false, hotspots: true, security: true, plan: true };
export const docFileId = (path: string): string => makeEntityId(DOC_REPO, 'file', path);

/** The document's JSON shape, loose enough for a test to break any field. */
export interface ReviewDoc {
  schema: string;
  source?: { folder: string; repository: string } | null;
  workItems: Record<string, unknown>[];
  rules: Record<string, unknown>[];
  dispositions: Record<string, unknown>[];
  report: { sections: Record<string, unknown>; note: string };
  [key: string]: unknown;
}

export function docText(): string {
  return reviewStateJson({
    workItems: [
      { id: 'wi-1', target: { kind: 'file', entityId: docFileId('src/a.ts') }, intent: 'refactor', title: 'Split the parser', status: 'planned', priority: 'high', notes: 'Start with the lexer.', checks: NO_CHECKS, createdAt: DOC_NOW },
      { id: 'wi-2', target: { kind: 'package', name: '@scope/pkg' }, intent: 'review', title: 'Review the package', status: 'verified', priority: 'low', notes: '', checks: [true, true, true], createdAt: DOC_NOW, updatedAt: DOC_NOW },
      { id: 'wi-3', target: { kind: 'module', module: 'src' }, intent: 'documentation', title: 'Document src', status: 'investigate', priority: 'medium', notes: '', checks: NO_CHECKS, createdAt: DOC_NOW },
    ],
    rules: [{ id: 'AR-001', from: 'ui', to: 'domain', rationale: 'Layering', createdAt: DOC_NOW }],
    dispositions: [
      { fingerprint: `${docFileId('src/a.ts')}#CX-a-1`, status: 'dismissed', reason: 'Generated code', decidedAt: DOC_NOW },
      { fingerprint: `${docFileId('src/b.ts')}#DUP-2`, status: 'acknowledged', decidedAt: DOC_NOW },
    ],
    report: { sections: DOC_SECTIONS, note: 'Confirm the parser boundary.' },
    exportedAt: new Date(DOC_NOW),
    source: reviewStateSource({ repositoryId: DOC_REPO, scope: { rootPath: '/home/dev/shop-api' } }),
  });
}

/** A fresh copy of the document with one change applied. */
export function docWith(change: (doc: ReviewDoc) => void): ReviewDoc {
  const doc = JSON.parse(docText()) as ReviewDoc;
  change(doc);
  return doc;
}

/** The first work item's target, for path edits. */
export const targetOf = (doc: ReviewDoc, index = 0): Record<string, unknown> => doc.workItems[index]!.target as Record<string, unknown>;

/** "accepted", or the refusal as "<code> <detail>" (for example "invalid workItems.0.title"). */
export function outcome(doc: unknown, repositoryId = DOC_REPO): string {
  const result = parseReviewState(JSON.stringify(doc), { repositoryId });
  return result.ok ? 'accepted' : `${result.code} ${result.detail}`.trim();
}

export function accepted(doc: unknown, repositoryId = DOC_REPO): ImportedReviewState {
  const result = parseReviewState(JSON.stringify(doc), { repositoryId });
  if (!result.ok) throw new Error(`refused: ${result.code} ${result.detail}`);
  return result.state;
}
