// Part 7 Z20: the per-codebase run reducer, mirroring run-state.ts. One run per codebase;
// cancelling forbids publication immediately; only the process's own confirmation ends a
// cancel; and a result publishes only for the same identity, the latest snapshot and
// unchanged evidence.
import { describe, expect, it } from 'vitest';
import {
  IDLE, isActive, isCancellable, mayPublish, reduceAnalysis, type AnalysisIdentity, type AnalysisRunState,
} from '../../src/application/analysis/analysis-state';

const ID: AnalysisIdentity = { profileId: 'p1', snapshotId: 's1', rootFingerprint: 'aaaaaaaa', subjectFingerprint: 'bbbbbbbb', runId: 'r1', generation: 0 };
const AT = '2026-09-23T10:00:00.000Z';
const started = reduceAnalysis(IDLE, { type: 'PROBE_STARTED', identity: ID, rootPath: '/repo', startedAt: AT, timeoutSeconds: 120 });
const running = reduceAnalysis(started, { type: 'PROBE_PASSED', runId: 'r1', version: '3.27.0', tested: true });
const NOW = { latestSnapshotId: 's1', evidenceUnchanged: true };

describe('reduceAnalysis (Z20)', () => {
  it('idle → probing → running', () => {
    expect(started).toEqual({ status: 'probing', identity: ID, rootPath: '/repo', startedAt: AT, timeoutSeconds: 120 });
    expect(running).toEqual({ status: 'running', identity: ID, rootPath: '/repo', startedAt: AT, timeoutSeconds: 120, version: '3.27.0', tested: true });
  });

  it('refuses a second start while probing, running or cancelling (the same object comes back)', () => {
    const other = { type: 'PROBE_STARTED', identity: { ...ID, runId: 'r2', generation: 1 }, rootPath: '/repo', startedAt: AT, timeoutSeconds: 120 } as const;
    const cancelling = reduceAnalysis(running, { type: 'CANCEL_REQUESTED', runId: 'r1' });
    for (const state of [started, running, cancelling]) expect(reduceAnalysis(state, other)).toBe(state);
  });

  it('starts again from any finished state', () => {
    const done = reduceAnalysis(running, { type: 'RUN_COMPLETED', runId: 'r1', finishedAt: AT, matchedFindings: 5, matchedFiles: 4 });
    expect(reduceAnalysis(done, { type: 'PROBE_STARTED', identity: { ...ID, runId: 'r2' }, rootPath: '/repo', startedAt: AT, timeoutSeconds: 60 }).status).toBe('probing');
  });

  it('cancel moves probing or running to cancelling, and only PROCESS_STOPPED ends it', () => {
    for (const state of [started, running]) {
      const cancelling = reduceAnalysis(state, { type: 'CANCEL_REQUESTED', runId: 'r1' });
      expect(cancelling).toEqual({ status: 'cancelling', identity: ID });
      expect(reduceAnalysis(cancelling, { type: 'RUN_COMPLETED', runId: 'r1', finishedAt: AT, matchedFindings: 1, matchedFiles: 1 })).toBe(cancelling);
      expect(reduceAnalysis(cancelling, { type: 'RUN_FAILED', runId: 'r1', code: 'timed-out', detail: '120', logExcerpt: '', evidenceKept: false, finishedAt: AT })).toBe(cancelling);
      expect(reduceAnalysis(cancelling, { type: 'PROCESS_STOPPED', runId: 'r1' })).toEqual({ status: 'cancelled', runId: 'r1' });
    }
  });

  it('ignores every action for another run id', () => {
    expect(reduceAnalysis(started, { type: 'PROBE_PASSED', runId: 'r9', version: '3.27.0', tested: true })).toBe(started);
    expect(reduceAnalysis(running, { type: 'CANCEL_REQUESTED', runId: 'r9' })).toBe(running);
    expect(reduceAnalysis(running, { type: 'RUN_COMPLETED', runId: 'r9', finishedAt: AT, matchedFindings: 1, matchedFiles: 1 })).toBe(running);
    expect(reduceAnalysis(running, { type: 'RUN_FAILED', runId: 'r9', code: 'exit-code', detail: '3', logExcerpt: '', evidenceKept: false, finishedAt: AT })).toBe(running);
  });

  it('completes only from running, carrying the version', () => {
    expect(reduceAnalysis(started, { type: 'RUN_COMPLETED', runId: 'r1', finishedAt: AT, matchedFindings: 1, matchedFiles: 1 })).toBe(started);
    expect(reduceAnalysis(running, { type: 'RUN_COMPLETED', runId: 'r1', finishedAt: AT, matchedFindings: 5, matchedFiles: 4 }))
      .toEqual({ status: 'completed', runId: 'r1', finishedAt: AT, version: '3.27.0', tested: true, matchedFindings: 5, matchedFiles: 4 });
  });

  it('fails from probing or running', () => {
    const failure = { type: 'RUN_FAILED', runId: 'r1', code: 'version-unsupported', detail: '4.0.0', logExcerpt: 'log', evidenceKept: true, finishedAt: AT } as const;
    for (const state of [started, running]) {
      expect(reduceAnalysis(state, failure)).toEqual({ status: 'failed', runId: 'r1', code: 'version-unsupported', detail: '4.0.0', logExcerpt: 'log', evidenceKept: true, finishedAt: AT });
    }
  });

  it('isActive and isCancellable', () => {
    const cancelling = reduceAnalysis(running, { type: 'CANCEL_REQUESTED', runId: 'r1' });
    const table: [AnalysisRunState, boolean, boolean][] = [
      [IDLE, false, false], [started, true, true], [running, true, true], [cancelling, true, false],
      [{ status: 'cancelled', runId: 'r1' }, false, false],
    ];
    for (const [state, active, cancellable] of table) {
      expect(isActive(state), state.status).toBe(active);
      expect(isCancellable(state), state.status).toBe(cancellable);
    }
  });
});

describe('mayPublish (Z20)', () => {
  it('publishes the running identity on the latest snapshot with unchanged evidence', () => {
    expect(mayPublish(ID, running, NOW)).toBe(true);
  });

  it('never while probing or cancelling', () => {
    expect(mayPublish(ID, started, NOW)).toBe(false);
    expect(mayPublish(ID, reduceAnalysis(running, { type: 'CANCEL_REQUESTED', runId: 'r1' }), NOW)).toBe(false);
  });

  it.each(Object.keys(ID) as (keyof AnalysisIdentity)[])('never when the identity differs in %s', (key) => {
    const changed = { ...ID, [key]: key === 'generation' ? 5 : 'other' };
    expect(mayPublish(changed, running, key === 'snapshotId' ? { ...NOW, latestSnapshotId: 'other' } : NOW)).toBe(false);
  });

  it('never when a newer snapshot exists, or the evidence changed meanwhile', () => {
    expect(mayPublish(ID, running, { latestSnapshotId: 's2', evidenceUnchanged: true })).toBe(false);
    expect(mayPublish(ID, running, { latestSnapshotId: null, evidenceUnchanged: true })).toBe(false);
    expect(mayPublish(ID, running, { latestSnapshotId: 's1', evidenceUnchanged: false })).toBe(false);
  });
});
