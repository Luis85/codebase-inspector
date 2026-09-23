// Part 7 Z21/Z23/Z24, acceptance (4) and (5): the plugin-wide coordinator over a scripted
// process port. It probes, runs, classifies, publishes atomically as collected evidence,
// keeps old evidence on failure (marked stale), and never lets a cancelled or superseded
// run overwrite a newer snapshot or newer evidence.
import { setTimeout as delay } from 'node:timers/promises';
import { describe, expect, it } from 'vitest';
import { AnalysisCoordinator, type RunPlan } from '../../src/application/analysis/analysis-coordinator';
import { FALLOW_RUN_ARGS } from '../../src/application/analysis/fallow-invocation';
import type { TrustSubject } from '../../src/application/analysis/analyzer-trust';
import type { AnalysisRunState } from '../../src/application/analysis/analysis-state';
import type { ExecutableFacts } from '../../src/application/ports/executable-inspector';
import { createCancellationToken } from '../../src/application/scan-coordinator';
import { InMemoryEvidenceStore } from '../../src/adapters/storage/in-memory-evidence-store';
import { InMemorySnapshotStore } from '../../src/adapters/storage/in-memory-snapshot-store';
import { createFixedClock } from '../fixtures/clock';
import { createFakeProcessPort, exitedWith } from '../fixtures/fake-process-port';
import { emptyEvidenceReport, snapshotWithPaths } from '../fixtures/evidence-report';
import { FIXTURE_PROJECT_FILES } from '../fixtures/fallow-expected';
import { fallowText } from '../fixtures/fallow-fixture';

const REPORT = fallowText('combined-3.27.0');
const ERROR_JSON = JSON.stringify({ error: true, message: 'invalid root path', exit_code: 2 });
const SNAPSHOT = snapshotWithPaths(FIXTURE_PROJECT_FILES, 'p1');
const ROOT = SNAPSHOT.scope.rootPath;
const FACTS: ExecutableFacts = { executablePath: '/opt/fallow/bin/fallow', realPath: '/opt/fallow/bin/fallow', size: 1000, mtimeMs: 1, format: 'elf', insideRoot: false };
const SUBJECT: TrustSubject = { profileId: 'p1', machineId: 'm', rootPath: ROOT, args: FALLOW_RUN_ARGS(ROOT), facts: FACTS };

function setup() {
  const process = createFakeProcessPort();
  const evidence = new InMemoryEvidenceStore();
  const clock = createFixedClock('2026-09-23T10:00:00.000Z');
  const snapshots = new InMemorySnapshotStore(clock);
  snapshots.put(SNAPSHOT);
  const coordinator = new AnalysisCoordinator({ process, evidence, snapshots, clock, createCancellationToken });
  const seen: AnalysisRunState['status'][] = [];
  coordinator.subscribe((id) => { if (id === 'p1') seen.push(coordinator.stateOf('p1').status); });
  return { process, evidence, snapshots, clock, coordinator, seen };
}
const plan = (overrides: Partial<RunPlan> = {}): RunPlan => ({
  subject: SUBJECT, snapshotId: SNAPSHOT.snapshotId, timeoutSeconds: 120,
  onProbePassed: () => Promise.resolve('continue'), ...overrides,
});
async function probed(s: ReturnType<typeof setup>, p: RunPlan = plan()): Promise<void> {
  expect(s.coordinator.start(p)).toBe(true);
  await s.process.settle(exitedWith(0, 'fallow 3.27.0\n'));
}

describe('AnalysisCoordinator: the happy path (Z21)', () => {
  it('probes first (--version, 5 s, 4 KB, in the root), then runs the exact argv with the plan\'s limit and the 16 MB cap', async () => {
    const s = setup();
    await probed(s);
    expect(s.process.requests.map((r) => r.args)).toEqual([['--version'], FALLOW_RUN_ARGS(ROOT)]);
    expect(s.process.requests[0]).toMatchObject({ executablePath: FACTS.executablePath, cwd: ROOT, timeoutMs: 5_000, maxStdoutBytes: 4_096, maxStderrBytes: 65_536 });
    expect(s.process.requests[1]).toMatchObject({ executablePath: FACTS.executablePath, cwd: ROOT, timeoutMs: 120_000, maxStdoutBytes: 16 * 1024 * 1024 });
    expect(s.seen).toEqual(['probing', 'running']);
  });

  it('publishes a completed run as collected, verified evidence, and counts what matched', async () => {
    const s = setup();
    await probed(s);
    s.clock.advance(900);
    await s.process.settle(exitedWith(0, REPORT));
    const state = s.coordinator.stateOf('p1');
    expect(state).toMatchObject({ status: 'completed', version: '3.27.0', tested: true, matchedFindings: 5, matchedFiles: 4 });
    const report = s.evidence.get('p1');
    expect(report).toMatchObject({ provider: 'fallow', providerVersion: '3.27.0', reportKind: 'combined', fileName: 'fallow', snapshotId: SNAPSHOT.snapshotId, stripPrefix: null });
    expect(report?.collected).toEqual({
      origin: 'collected', sourceMatch: 'verified', runId: state.status === 'completed' ? state.runId : '', rootPath: ROOT,
      executablePath: FACTS.executablePath, args: FALLOW_RUN_ARGS(ROOT), exitCode: 0,
      startedAt: '2026-09-23T10:00:00.000Z', durationMs: 900, versionTested: true,
    });
  });

  it('exit 1 with findings is completed, and records exit code 1', async () => {
    const s = setup();
    await probed(s);
    await s.process.settle(exitedWith(1, REPORT));
    expect(s.coordinator.stateOf('p1').status).toBe('completed');
    expect(s.evidence.get('p1')?.collected?.exitCode).toBe(1);
  });

  it('labels an untested 3.x version and still runs it', async () => {
    const s = setup();
    expect(s.coordinator.start(plan())).toBe(true);
    await s.process.settle(exitedWith(0, 'fallow 3.28.0'));
    expect(s.coordinator.stateOf('p1')).toMatchObject({ status: 'running', version: '3.28.0', tested: false });
  });
});

describe('AnalysisCoordinator: failures keep old evidence (acceptance 4, Z23)', () => {
  it('an operational failure keeps the report and marks it stale', async () => {
    const s = setup();
    const old = emptyEvidenceReport(SNAPSHOT.snapshotId);
    s.evidence.put('p1', old);
    await probed(s);
    await s.process.settle({ ...exitedWith(2, ERROR_JSON), stderrTail: 'boom' });
    expect(s.coordinator.stateOf('p1')).toMatchObject({ status: 'failed', code: 'analyzer-error', detail: 'invalid root path', logExcerpt: 'boom', evidenceKept: true });
    expect(s.evidence.get('p1')).toEqual({ ...old, staleReason: 'failed-run' });
  });

  it('with no evidence it attaches nothing and says so', async () => {
    const s = setup();
    await probed(s);
    await s.process.settle({ kind: 'timed-out', stderrTail: '' });
    expect(s.coordinator.stateOf('p1')).toMatchObject({ status: 'failed', code: 'timed-out', detail: '120', evidenceKept: false });
    expect(s.evidence.get('p1')).toBeNull();
  });

  it('a probe of fallow 4 stops before the run, and is operational', async () => {
    const s = setup();
    s.evidence.put('p1', emptyEvidenceReport(SNAPSHOT.snapshotId));
    expect(s.coordinator.start(plan())).toBe(true);
    await s.process.settle(exitedWith(0, 'fallow 4.0.0'));
    expect(s.coordinator.stateOf('p1')).toMatchObject({ status: 'failed', code: 'version-unsupported', detail: '4.0.0' });
    expect(s.process.requests).toHaveLength(1);
    expect(s.evidence.get('p1')?.staleReason).toBe('failed-run');
  });

  it('Review Focus 4: a binary that vanished after the check fails as executable-missing, never runs, and keeps the evidence stale', async () => {
    const s = setup();
    s.evidence.put('p1', emptyEvidenceReport(SNAPSHOT.snapshotId));
    expect(s.coordinator.start(plan())).toBe(true);
    await s.process.settle({ kind: 'spawn-failed', errorCode: 'ENOENT' });
    expect(s.coordinator.stateOf('p1')).toMatchObject({ status: 'failed', code: 'executable-missing', evidenceKept: true });
    expect(s.process.requests).toHaveLength(1);
    expect(s.evidence.get('p1')?.staleReason).toBe('failed-run');
  });

  it('a version change or a moved binding ends the run quietly, before the analysis, evidence untouched', async () => {
    for (const verdict of ['version-changed', 'changed-since-review'] as const) {
      const s = setup();
      const old = emptyEvidenceReport(SNAPSHOT.snapshotId);
      s.evidence.put('p1', old);
      await probed(s, plan({ onProbePassed: () => Promise.resolve(verdict) }));
      expect(s.coordinator.stateOf('p1')).toMatchObject({ status: 'failed', code: verdict });
      expect(s.process.requests).toHaveLength(1);
      expect(s.evidence.get('p1')).toBe(old);
    }
  });

  it('findings that match no file are refused as source-mismatch, and attach nothing', async () => {
    const s = setup();
    const elsewhere = { ...snapshotWithPaths(['other/a.ts'], 'p1'), snapshotId: 'snapshot-elsewhere' };
    s.snapshots.put(elsewhere);
    await probed(s, plan({ snapshotId: 'snapshot-elsewhere' }));
    await s.process.settle(exitedWith(0, REPORT));
    expect(s.coordinator.stateOf('p1')).toMatchObject({ status: 'failed', code: 'source-mismatch' });
    expect(s.evidence.get('p1')).toBeNull();
  });

  it('a throwing onProbePassed ends the run as failed, never stuck', async () => {
    const s = setup();
    await probed(s, plan({ onProbePassed: () => Promise.reject(new Error('disk full')) }));
    expect(s.coordinator.stateOf('p1')).toMatchObject({ status: 'failed', code: 'spawn-failed', detail: 'internal' });
  });
});

describe('AnalysisCoordinator: cancelled or superseded runs never publish (acceptance 5)', () => {
  it('cancel while probing: cancelling at once, cancelled only when the process confirms, nothing published', async () => {
    const s = setup();
    expect(s.coordinator.start(plan())).toBe(true);
    s.coordinator.cancel('p1');
    expect(s.coordinator.stateOf('p1').status).toBe('cancelling');
    await delay(0);
    expect(s.coordinator.stateOf('p1').status).toBe('cancelled');
    expect(s.process.requests).toHaveLength(1);
    expect(s.evidence.get('p1')).toBeNull();
  });

  it('cancel while running forbids publication even if the report was already complete', async () => {
    const s = setup();
    await probed(s);
    s.coordinator.cancel('p1');
    expect(s.coordinator.stateOf('p1').status).toBe('cancelling');
    await delay(0);
    expect(s.coordinator.stateOf('p1').status).toBe('cancelled');
    expect(s.evidence.get('p1')).toBeNull();
    expect(s.seen).toEqual(['probing', 'running', 'cancelling', 'cancelled']);
  });

  it('a subscriber cancelling on PROBE_PASSED is honoured: the run is never started', async () => {
    const s = setup();
    s.coordinator.subscribe((id) => { if (s.coordinator.stateOf(id).status === 'running') s.coordinator.cancel(id); });
    await probed(s);
    expect(s.coordinator.stateOf('p1').status).toBe('cancelled');
    expect(s.process.requests).toHaveLength(1);
  });

  it('a rescan while running discards the result as snapshot-changed and leaves evidence as it was', async () => {
    const s = setup();
    const old = emptyEvidenceReport(SNAPSHOT.snapshotId);
    s.evidence.put('p1', old);
    await probed(s);
    s.snapshots.put({ ...SNAPSHOT, snapshotId: 'snapshot-newer' });
    await s.process.settle(exitedWith(0, REPORT));
    expect(s.coordinator.stateOf('p1')).toMatchObject({ status: 'failed', code: 'snapshot-changed' });
    expect(s.evidence.get('p1')).toBe(old);
  });

  it('an import while running supersedes the run: the import stays', async () => {
    const s = setup();
    await probed(s);
    const imported = emptyEvidenceReport(SNAPSHOT.snapshotId, 'imported.json');
    s.evidence.put('p1', imported);
    await s.process.settle(exitedWith(0, REPORT));
    expect(s.coordinator.stateOf('p1')).toMatchObject({ status: 'failed', code: 'superseded' });
    expect(s.evidence.get('p1')).toBe(imported);
  });

  it('one run per codebase: a second start is refused while active, another codebase may run', async () => {
    const s = setup();
    expect(s.coordinator.start(plan())).toBe(true);
    expect(s.coordinator.start(plan())).toBe(false);
    expect(s.coordinator.start(plan({ subject: { ...SUBJECT, profileId: 'p2' } }))).toBe(true);
    expect(s.process.requests).toHaveLength(2);
  });

  it('cancel is a no-op with nothing to cancel', () => {
    const s = setup();
    s.coordinator.cancel('p1');
    expect(s.coordinator.stateOf('p1').status).toBe('idle');
  });
});

describe('AnalysisCoordinator: shutdown (Z24)', () => {
  it('cancels every active run, kills every child, publishes nothing, and refuses new starts', async () => {
    const s = setup();
    await probed(s);
    expect(s.coordinator.start(plan({ subject: { ...SUBJECT, profileId: 'p2' } }))).toBe(true);
    s.coordinator.shutdown();
    expect(s.process.killAllCalls()).toBe(1);
    await delay(0);
    expect(s.coordinator.stateOf('p1').status).toBe('cancelled');
    expect(s.coordinator.stateOf('p2').status).toBe('cancelled');
    expect(s.evidence.get('p1')).toBeNull();
    expect(s.coordinator.start(plan())).toBe(false);
  });
});

/** Fix round 1: `isolate` (analysis-coordinator.ts) surfaces a listener's throw via
 *  `queueMicrotask(() => { throw e; })` — outside any promise chain, so Node reports it as
 *  an `uncaughtException`. Captured here so a deliberately misbehaving test subscriber can
 *  never crash the run (worker), only prove the throw actually happened. */
function captureUncaught(): { errors: unknown[]; restore: () => void } {
  const errors: unknown[] = [];
  const handler = (e: unknown): void => { errors.push(e); };
  process.on('uncaughtException', handler);
  return { errors, restore: () => { process.off('uncaughtException', handler); } };
}

describe('AnalysisCoordinator: a throwing subscriber never corrupts a run (fix round 1)', () => {
  it('(a) throwing on RUN_COMPLETED leaves the state completed and the evidence NOT marked stale', async () => {
    const s = setup();
    const { errors, restore } = captureUncaught();
    try {
      s.coordinator.subscribe((id) => { if (s.coordinator.stateOf(id).status === 'completed') throw new Error('boom'); });
      await probed(s);
      await s.process.settle(exitedWith(0, REPORT));
      expect(s.coordinator.stateOf('p1')).toMatchObject({ status: 'completed' });
      expect(s.evidence.get('p1')?.staleReason).toBeUndefined();
      await delay(0);
      expect(errors.length).toBeGreaterThan(0);
    } finally {
      restore();
    }
  });

  it('(b) throwing on PROBE_STARTED does not wedge the run: start still proceeds to running', async () => {
    const s = setup();
    const { errors, restore } = captureUncaught();
    try {
      s.coordinator.subscribe((id) => { if (s.coordinator.stateOf(id).status === 'probing') throw new Error('boom'); });
      expect(s.coordinator.start(plan())).toBe(true);
      await s.process.settle(exitedWith(0, 'fallow 3.27.0\n'));
      expect(s.coordinator.stateOf('p1')).toMatchObject({ status: 'running' });
      await delay(0);
      expect(errors.length).toBeGreaterThan(0);
    } finally {
      restore();
    }
  });

  it('(c) throwing during shutdown does not skip killAll or the token cancels', async () => {
    const s = setup();
    const { errors, restore } = captureUncaught();
    try {
      await probed(s);
      s.coordinator.subscribe(() => { throw new Error('boom'); });
      s.coordinator.shutdown();
      expect(s.process.killAllCalls()).toBe(1);
      await delay(0);
      expect(s.coordinator.stateOf('p1').status).toBe('cancelled');
      expect(errors.length).toBeGreaterThan(0);
    } finally {
      restore();
    }
  });

  it('an evidence subscriber throwing inside put does not mark the just-published report stale', async () => {
    const s = setup();
    const { errors, restore } = captureUncaught();
    try {
      s.evidence.subscribe(() => { throw new Error('boom'); });
      await probed(s);
      await s.process.settle(exitedWith(0, REPORT));
      expect(s.coordinator.stateOf('p1')).toMatchObject({ status: 'completed' });
      expect(s.evidence.get('p1')?.staleReason).toBeUndefined();
      await delay(0);
      expect(errors.length).toBeGreaterThan(0);
    } finally {
      restore();
    }
  });
});

describe('AnalysisCoordinator: a re-entrant cancel never leaves a run stuck (fix round 1)', () => {
  it('an evidence subscriber cancelling on put still reaches cancelled, not stuck in cancelling', async () => {
    const s = setup();
    s.evidence.subscribe(() => { s.coordinator.cancel('p1'); });
    await probed(s);
    await s.process.settle(exitedWith(0, REPORT));
    expect(s.coordinator.stateOf('p1').status).toBe('cancelled');
  });
});
