// What the harness seeds, split out of mount.ts so the ordinary suite can check it
// (mount.ts only runs in a real browser). Harness-only: nothing under src imports this.
import type { EntityId } from '../../src/domain/entity-id';
import { initialScanLifecycleState, type ScanLifecycleState } from '../../src/application/run-state';
import type { ReportSection } from '../../src/ui/stores/report-store';
import { useReviewStore } from '../../src/ui/stores/review-store';
import { REVIEW_STATE_SCHEMA_V1 } from '../../src/ui/read-models/review-state';

const AT = new Date('2026-09-17T12:00:00Z');

/** Part 4: three fixed work items on the first three files, one per status column the
 *  prototype shows. Part 5 V30: a refused add returns null, and a board with a column
 *  missing would be photographed as if it were right, so this throws unless all three
 *  were created — the page error then fails `npm run harness-shot`. */
export async function seedDemoItems(fileIds: readonly EntityId[]): Promise<void> {
  const review = useReviewStore();
  const [a, b, c] = fileIds;
  const created = [
    a ? await review.addWorkItem({ kind: 'file', entityId: a }, 'refactor', 'Separate calculation from persistence', AT, { priority: 'high', status: 'planned', checks: [true, false, false] }) : null,
    b ? await review.addWorkItem({ kind: 'file', entityId: b }, 'tests', 'Add regression tests for selection changes', AT, { status: 'in-progress', checks: [true, true, false] }) : null,
    c ? await review.addWorkItem({ kind: 'file', entityId: c }, 'documentation', 'Document the persistence boundary', AT, { priority: 'low', status: 'verified', checks: [true, true, true] }) : null,
  ].filter((item) => item !== null).length;
  if (created !== 3) throw new Error(`harness: items=demo seeded ${created} of 3 work items`);
}

/** Part 5 V6: a scan in flight, as the host's ScanCoordinator subscription would mirror
 *  it into the run store (a pure mirror), for the Cancel controls' captures. */
export function runningLifecycle(): ScanLifecycleState {
  const approval = {
    profileId: 'harness', sourceFingerprint: 'harness-source', scopeFingerprint: 'harness-scope',
    approvedAt: '2026-09-17T12:00:00.000Z', operation: 'read-only-inventory' as const,
  };
  return {
    ...initialScanLifecycleState(),
    generation: 1,
    approval,
    run: { status: 'running', runId: 'harness-run', generation: 1, approval, processedFiles: 57 },
  };
}

/** Part 5 V13: a fixed v1 review-state file for `?import=demo`. v1 carries no source, so
 *  no repository digest is needed, and the dialog shows the origin as unknown. */
export function demoImportJson(filePath: string, sections: Readonly<Record<ReportSection, boolean>>): string {
  const at = '2026-09-17T12:00:00.000Z';
  return JSON.stringify({
    schema: REVIEW_STATE_SCHEMA_V1,
    exportedAt: at,
    note: 'Harness demo import.',
    workItems: [{
      id: 'wi-1', target: { kind: 'file', path: filePath }, intent: 'refactor', title: 'Separate calculation from persistence',
      status: 'planned', priority: 'high', notes: '', checks: [true, false, false], createdAt: at,
    }],
    rules: [{ id: 'AR-001', from: 'dir-0', to: 'dir-1', rationale: 'Keep the core free of UI imports.', createdAt: at }],
    dispositions: [],
    report: { sections: { ...sections }, note: '' },
  }, null, 2);
}
