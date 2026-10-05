// Part 7 Z38, acceptance (4) and (5), and G6: the REAL service, coordinator and runner
// over a REAL scan of a temporary copy of the fallow fixture project. The executable is the
// fake fallow run by Node (nodeWrapped); the inspector is scripted, because it would rightly
// refuse node as "not named fallow". Every real process gets a real kill (PF4)
// and is killed again in afterEach; every test has its own time limit (PF7).
// Task 6 (Z38, O2): the "no freeze" case (acceptance 3) that measures the 50 ms
// event-loop budget now lives alone in fallow-no-freeze.test.ts, in the 'node-serial'
// project (vitest.config.ts), so it is timed on an otherwise idle worker pool. The
// setup shared with it (world(), the tracked spawn, the afterEach cleanup) moved,
// unchanged, into fallow-analysis-world.ts.
import { setTimeout as sleep } from 'node:timers/promises';
import { describe, expect, it } from 'vitest';
import { FALLOW_RUN_ARGS } from '../../src/application/analysis/fallow-invocation';
import { normalizeAbsolutePath } from '../../src/domain/path-safety';
import { emptyEvidenceReport } from '../fixtures/evidence-report';
import { EXE, alive, pids, settled, startTrusted, trustAndRun, until, world } from './fallow-analysis-world';

describe('the real stack: trust, probe, run, publish (G6, acceptance 3)', () => {
  it('an untrusted binding starts no process at all', async () => {
    const w = await world();
    const reviewed = await w.service.review('p1', w.snapshot, EXE);
    expect(reviewed.ok).toBe(true);
    expect(w.requests).toEqual([]);
    expect(pids).toEqual([]);
  }, 15_000);

  it('a bound but untrusted run starts zero processes', async () => {
    const w = await world();
    await w.store.bind('p1', normalizeAbsolutePath(EXE));
    expect(await w.store.read('p1')).toMatchObject({ kind: 'bound', binding: { trust: null } });
    expect(await w.service.run('p1', w.snapshot)).toMatchObject({ kind: 'review', reason: 'untrusted' });
    expect(await w.service.checkTrust('p1', w.snapshot)).toMatchObject({ kind: 'review', reason: 'untrusted' });
    expect(w.service.stateOf('p1').status).toBe('idle');
    expect(w.requests).toEqual([]);
    expect(pids).toEqual([]);
  }, 15_000);

  it('Trust and run probes first, then runs the exact argv in the scanned root, and publishes collected evidence', async () => {
    const w = await world();
    await trustAndRun(w);
    expect(w.requests.map((r) => r.args)).toEqual([['--version'], FALLOW_RUN_ARGS(w.root)]);
    expect(w.service.stateOf('p1')).toMatchObject({ status: 'completed', version: '3.27.0', tested: true, matchedFindings: 5, matchedFiles: 4 });
    expect(w.evidence.get('p1')?.collected).toMatchObject({ origin: 'collected', sourceMatch: 'verified', rootPath: w.root, exitCode: 0 });
    expect(await w.service.checkTrust('p1', w.snapshot)).toEqual({ kind: 'trusted' });
  }, 30_000);

  it('exit 1 with findings is completed', async () => {
    const w = await world();
    w.mode.run = 'findings-exit-1';
    await trustAndRun(w);
    expect(w.service.stateOf('p1').status).toBe('completed');
    expect(w.evidence.get('p1')?.collected?.exitCode).toBe(1);
  }, 30_000);

  it('fallow 4 is refused after the probe; nothing runs and no trust is stored', async () => {
    const w = await world();
    w.mode.probe = 'version-4';
    await trustAndRun(w);
    expect(w.service.stateOf('p1')).toMatchObject({ status: 'failed', code: 'version-unsupported', detail: '4.0.0' });
    expect(w.requests).toHaveLength(1);
    expect(await w.service.checkTrust('p1', w.snapshot)).toMatchObject({ kind: 'review', reason: 'untrusted' });
  }, 30_000);

  it('an untested 3.x runs, labelled untested', async () => {
    const w = await world();
    w.mode.probe = 'version-untested';
    await trustAndRun(w);
    expect(w.service.stateOf('p1')).toMatchObject({ status: 'completed', tested: false });
    expect(w.evidence.get('p1')?.collected?.versionTested).toBe(false);
  }, 30_000);

  it('a version change after trust ends the next run as version-changed and revokes trust', async () => {
    const w = await world();
    await trustAndRun(w);
    w.mode.probe = 'version-untested';
    expect(await w.service.run('p1', w.snapshot)).toEqual({ kind: 'started' });
    await settled(w);
    expect(w.service.stateOf('p1')).toMatchObject({ status: 'failed', code: 'version-changed', detail: '3.28.0' });
    expect(await w.service.checkTrust('p1', w.snapshot)).toMatchObject({ kind: 'review', reason: 'untrusted' });
  }, 30_000);
});

describe('the real stack: failures keep evidence (acceptance 4)', () => {
  it('a real operational failure keeps the earlier findings, marked stale', async () => {
    const w = await world();
    await trustAndRun(w);
    const before = w.evidence.get('p1');
    expect(before).not.toBeNull();
    w.mode.run = 'error-exit-2';
    expect(await w.service.run('p1', w.snapshot)).toEqual({ kind: 'started' });
    await settled(w);
    expect(w.service.stateOf('p1')).toMatchObject({ status: 'failed', code: 'analyzer-error', evidenceKept: true });
    expect(w.evidence.get('p1')).toEqual({ ...before, staleReason: 'failed-run' });
  }, 30_000);

  it('a truncated report attaches nothing', async () => {
    const w = await world();
    w.mode.run = 'truncated';
    await trustAndRun(w);
    expect(w.service.stateOf('p1')).toMatchObject({ status: 'failed', code: 'output-not-json' });
    expect(w.evidence.get('p1')).toBeNull();
  }, 30_000);
});

describe('the real stack: cancelled or superseded runs never publish (acceptance 5)', () => {
  it('a cancelled run is cancelled, attaches nothing, and its process is gone', async () => {
    const w = await world();
    w.mode.run = 'hang';
    await startTrusted(w);
    await until(() => w.service.stateOf('p1').status === 'running' && w.requests.length >= 2, 'the run to start');
    await sleep(200);
    w.service.cancel('p1');
    expect(w.service.stateOf('p1').status).toBe('cancelling');
    await settled(w);
    expect(w.service.stateOf('p1').status).toBe('cancelled');
    expect(w.evidence.get('p1')).toBeNull();
    expect(pids).toHaveLength(2);
    expect(alive(pids[pids.length - 1]!)).toBe(false);
  }, 30_000);

  it('a rescan while fallow runs discards the result as snapshot-changed', async () => {
    const w = await world({ hold: true });
    await startTrusted(w);
    await until(() => w.service.stateOf('p1').status === 'running', 'the probe to pass');
    const rescanned = await w.rescan();
    expect(rescanned.snapshotId).not.toBe(w.snapshot.snapshotId);
    w.release();
    await settled(w);
    expect(w.service.stateOf('p1')).toMatchObject({ status: 'failed', code: 'snapshot-changed' });
    expect(w.evidence.get('p1')).toBeNull();
  }, 30_000);

  it('an import while fallow runs supersedes it: the import stays', async () => {
    const w = await world({ hold: true });
    await startTrusted(w);
    await until(() => w.service.stateOf('p1').status === 'running', 'the probe to pass');
    w.evidence.put('p1', emptyEvidenceReport(w.snapshot.snapshotId, 'imported.json'));
    const kept = w.evidence.get('p1');
    w.release();
    await settled(w);
    expect(w.service.stateOf('p1')).toMatchObject({ status: 'failed', code: 'superseded' });
    expect(w.evidence.get('p1')).toBe(kept);
  }, 30_000);

  it('shutdown ends a hanging run at once and publishes nothing', async () => {
    const w = await world();
    w.mode.run = 'hang';
    await startTrusted(w);
    await until(() => w.requests.length >= 2, 'the run request');
    await sleep(200);
    w.service.shutdown();
    await settled(w);
    expect(w.service.stateOf('p1').status).toBe('cancelled');
    expect(w.evidence.get('p1')).toBeNull();
    expect(pids).toHaveLength(2);
    // E42: shutdown settles at once, and on Windows the process dies when the taskkill it
    // spawned (then the direct kill) lands, a moment later: a deadline, never a fixed sleep.
    await until(() => !alive(pids[pids.length - 1]!), 'fallow to be gone', 5_000);
    expect(alive(pids[pids.length - 1]!)).toBe(false);
  }, 30_000);
});
