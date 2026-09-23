// Part 7 Z20: one codebase's fallow run, as a pure reducer mirroring run-state.ts. The
// coordinator keeps one state per profile. A run publishes only while `running`, for the
// same identity, on the codebase's latest snapshot, with the evidence unchanged since it
// started: a cancelled or superseded run can never overwrite newer data (acceptance 5).
import type { FallowRunErrorCode } from './fallow-run-errors';

export interface AnalysisIdentity {
  profileId: string;
  snapshotId: string;
  rootFingerprint: string;
  /** fingerprintTrust(subject, ''): the reviewed facts, without the version. */
  subjectFingerprint: string;
  runId: string;
  generation: number;
}

/** `failed.evidenceKept`: this failure kept a report and marked it `staleReason: 'failed-run'`
 *  (operational failures only, Z23). A later import or removal replaces that report, so the
 *  banner also checks the CURRENT report still carries the mark (final review). */
export type AnalysisRunState =
  | { status: 'idle' }
  | { status: 'probing'; identity: AnalysisIdentity; rootPath: string; startedAt: string; timeoutSeconds: number }
  | { status: 'running'; identity: AnalysisIdentity; rootPath: string; startedAt: string; timeoutSeconds: number; version: string; tested: boolean }
  | { status: 'cancelling'; identity: AnalysisIdentity }
  | { status: 'completed'; runId: string; finishedAt: string; version: string; tested: boolean; matchedFindings: number; matchedFiles: number }
  | { status: 'cancelled'; runId: string }
  | { status: 'failed'; runId: string; code: FallowRunErrorCode; detail: string; logExcerpt: string; evidenceKept: boolean; finishedAt: string };

export type AnalysisAction =
  | { type: 'PROBE_STARTED'; identity: AnalysisIdentity; rootPath: string; startedAt: string; timeoutSeconds: number }
  | { type: 'PROBE_PASSED'; runId: string; version: string; tested: boolean }
  | { type: 'CANCEL_REQUESTED'; runId: string }
  | { type: 'PROCESS_STOPPED'; runId: string }
  | { type: 'RUN_COMPLETED'; runId: string; finishedAt: string; matchedFindings: number; matchedFiles: number }
  | { type: 'RUN_FAILED'; runId: string; code: FallowRunErrorCode; detail: string; logExcerpt: string; evidenceKept: boolean; finishedAt: string };

export const IDLE: AnalysisRunState = { status: 'idle' };

/** A run is in flight: probing, running or being cancelled. One per codebase. */
export function isActive(state: AnalysisRunState): boolean {
  return state.status === 'probing' || state.status === 'running' || state.status === 'cancelling';
}

/** M36's rule for the cancel command: only a probing or running analysis can be cancelled. */
export function isCancellable(state: AnalysisRunState): boolean {
  return state.status === 'probing' || state.status === 'running';
}

export function reduceAnalysis(state: AnalysisRunState, action: AnalysisAction): AnalysisRunState {
  switch (action.type) {
    case 'PROBE_STARTED':
      if (isActive(state)) return state;
      return { status: 'probing', identity: action.identity, rootPath: action.rootPath, startedAt: action.startedAt, timeoutSeconds: action.timeoutSeconds };
    case 'PROBE_PASSED':
      if (state.status !== 'probing' || state.identity.runId !== action.runId) return state;
      return {
        status: 'running', identity: state.identity, rootPath: state.rootPath, startedAt: state.startedAt,
        timeoutSeconds: state.timeoutSeconds, version: action.version, tested: action.tested,
      };
    case 'CANCEL_REQUESTED':
      if ((state.status !== 'probing' && state.status !== 'running') || state.identity.runId !== action.runId) return state;
      return { status: 'cancelling', identity: state.identity };
    case 'PROCESS_STOPPED':
      if (state.status !== 'cancelling' || state.identity.runId !== action.runId) return state;
      return { status: 'cancelled', runId: action.runId };
    case 'RUN_COMPLETED':
      if (state.status !== 'running' || state.identity.runId !== action.runId) return state;
      return {
        status: 'completed', runId: action.runId, finishedAt: action.finishedAt, version: state.version, tested: state.tested,
        matchedFindings: action.matchedFindings, matchedFiles: action.matchedFiles,
      };
    case 'RUN_FAILED':
      if ((state.status !== 'probing' && state.status !== 'running') || state.identity.runId !== action.runId) return state;
      return {
        status: 'failed', runId: action.runId, code: action.code, detail: action.detail, logExcerpt: action.logExcerpt,
        evidenceKept: action.evidenceKept, finishedAt: action.finishedAt,
      };
    default: {
      const exhaustive: never = action;
      return exhaustive;
    }
  }
}

/** Z20: validation (the Part 6 schema and the mismatch rule) is the caller's; this is the
 *  identity, cancellation and supersession half. `cancelling` forbids publication at once. */
export function mayPublish(
  identity: AnalysisIdentity, state: AnalysisRunState, current: { latestSnapshotId: string | null; evidenceUnchanged: boolean },
): boolean {
  if (state.status !== 'running') return false;
  const s = state.identity;
  return s.profileId === identity.profileId
    && s.snapshotId === identity.snapshotId
    && s.rootFingerprint === identity.rootFingerprint
    && s.subjectFingerprint === identity.subjectFingerprint
    && s.runId === identity.runId
    && s.generation === identity.generation
    && identity.snapshotId === current.latestSnapshotId
    && current.evidenceUnchanged;
}
