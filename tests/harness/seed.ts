// What the harness seeds, split out of mount.ts so the ordinary suite can check it
// (mount.ts only runs in a real browser). Harness-only: nothing under src imports this.
import type { EntityId } from '../../src/domain/entity-id';
import { initialScanLifecycleState, type ScanLifecycleState } from '../../src/application/run-state';
import type { ReportSection } from '../../src/ui/stores/report-store';
import { useReviewStore } from '../../src/ui/stores/review-store';
import { REVIEW_STATE_SCHEMA_V1 } from '../../src/ui/read-models/review-state';
import type { CodebaseSnapshot } from '../../src/domain/model';
import type { EvidenceReport } from '../../src/application/evidence/model';
import { parseFallowReportText } from '../../src/application/evidence/read-fallow-report';
import { buildEvidenceReport } from '../../src/application/evidence/normalize-fallow';
import { snapshotWithOnlyFiles, syntheticFallowJson } from '../fixtures/evidence-report';
import { FALLOW_RUN_ARGS } from '../../src/application/analysis/fallow-invocation';
import type { AnalysisRunState } from '../../src/application/analysis/analysis-state';
import type { AnalyzerBindingRead } from '../../src/application/analysis/analyzer-record';
import type { RunReview } from '../../src/application/analysis/fallow-analysis-service';
import { HARNESS_EXECUTABLE, fakeRunReview } from '../fixtures/fake-fallow-analysis';

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

/** Part 6 Y4: the same run after Cancel was pressed, before the walk confirms it stopped. */
export function cancellingLifecycle(): ScanLifecycleState {
  return { ...runningLifecycle(), run: { status: 'cancelling', runId: 'harness-run', generation: 1 } };
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

/** Part 6 §5: the synthetic report's own file name says what it is on every surface that
 *  shows it (the fallow card's diagnostics, the S14 review step). */
export const DEMO_FALLOW_FILE_NAME = 'synthetic-harness-fallow-report.json';
/** Not a harness path, so the review step and the fallow card show one unmatched path. */
export const DEMO_UNMATCHED_PATH = 'generated/schema.ts';
/** page.ts's caption whenever the synthetic report is on the page. */
export const HARNESS_SYNTHETIC_FOOTER = 'Harness · synthetic fallow report built from the fixture’s own paths · not a repository analysis';
const DEMO_WARNING = 'Synthetic harness diagnostic: package exports were not resolved.';
/** Ten MEASURED files (1–3 are the fixture's unavailable ones), spread over all six
 *  districts, so the lens shows reported lots among unreported ones. */
const DEMO_FILE_INDEXES: readonly number[] = [4, 10, 23, 31, 40, 57, 66, 86, 101, 120];

export function filePathsOf(snapshot: CodebaseSnapshot): string[] {
  return snapshot.entities.filter((e) => e.kind === 'file').map((e) => e.path);
}

/** R5: the shared fixture's real-shaped fallow 3.27.0 JSON, for the ten demo files plus one
 *  path the snapshot does not have. It is the file `?fallow=review` picks. */
export function demoFallowReportText(snapshot: CodebaseSnapshot): string {
  const paths = filePathsOf(snapshot);
  const demoPaths = DEMO_FILE_INDEXES.map((i) => {
    const path = paths[i];
    if (path === undefined) throw new Error(`harness: report=demo needs a file at index ${i}`);
    return path;
  });
  return syntheticFallowJson(snapshotWithOnlyFiles(snapshot, demoPaths), {
    unmatchedPaths: [DEMO_UNMATCHED_PATH], warning: DEMO_WARNING,
  });
}

/** What the S14 dialog attaches for that file: the real reader, then the real builder. A
 *  refusal throws, and the page error fails `npm run harness-shot`. */
export function demoEvidenceReport(snapshot: CodebaseSnapshot): EvidenceReport {
  const read = parseFallowReportText(demoFallowReportText(snapshot));
  if (!read.ok) throw new Error(`harness: report=demo was refused by the real reader (${read.code} ${read.detail})`);
  return buildEvidenceReport({
    raw: read.report, fileName: DEMO_FALLOW_FILE_NAME, importedAt: AT.toISOString(),
    snapshotId: snapshot.snapshotId, stripPrefix: null,
  });
}

/** Part 7 Z42: the demo report as a collected run attaches it (the real builder's output plus
 *  collected provenance), for `?analysis=collected`. */
export function demoCollectedReport(snapshot: CodebaseSnapshot): EvidenceReport {
  const base = demoEvidenceReport(snapshot);
  return {
    ...base, fileName: 'fallow.exe',
    collected: {
      origin: 'collected', sourceMatch: 'verified', runId: 'harness-fallow-run', rootPath: snapshot.scope.rootPath,
      executablePath: HARNESS_EXECUTABLE, args: FALLOW_RUN_ARGS(snapshot.scope.rootPath), exitCode: 0,
      startedAt: AT.toISOString(), durationMs: 1_450, versionTested: true,
    },
  };
}

/** Part 7 Z42: the installed route's review for the harness root (`?fallow=installed`). */
export function demoRunReview(snapshot: CodebaseSnapshot): RunReview {
  return fakeRunReview(snapshot.repositoryId, snapshot.snapshotId, snapshot.scope.rootPath);
}

export const HARNESS_BINDING: AnalyzerBindingRead = {
  kind: 'bound', binding: { profileId: 'harness', executablePath: HARNESS_EXECUTABLE, timeoutSeconds: 120, trust: { fingerprint: '0a1b2c3d', version: '3.27.0', grantedAt: AT.toISOString() } },
};

export function runningAnalysisState(snapshot: CodebaseSnapshot): AnalysisRunState {
  return {
    status: 'running', rootPath: snapshot.scope.rootPath, startedAt: AT.toISOString(), timeoutSeconds: 120, version: '3.27.0', tested: true,
    identity: { profileId: snapshot.repositoryId, snapshotId: snapshot.snapshotId, rootFingerprint: 'harness', subjectFingerprint: 'harness', runId: 'harness-fallow-run', generation: 0 },
  };
}

export function failedAnalysisState(): AnalysisRunState {
  return {
    status: 'failed', runId: 'harness-fallow-run', code: 'timed-out', detail: '120', evidenceKept: true, finishedAt: AT.toISOString(),
    logExcerpt: 'Synthetic harness log: analysing 142 files…\nSynthetic harness log: still analysing after 120 s.',
  };
}

export function completedAnalysisState(): AnalysisRunState {
  return { status: 'completed', runId: 'harness-fallow-run', finishedAt: AT.toISOString(), version: '3.27.0', tested: true, matchedFindings: 19, matchedFiles: 10 };
}
