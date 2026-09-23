// Part 7 Z38, acceptance (3), (4) and (5), and G6: the REAL service, coordinator and runner
// over a REAL scan of a temporary copy of the fallow fixture project. The executable is the
// fake fallow run by Node (nodeWrapped); the inspector is scripted, because it would rightly
// refuse node as "not named fallow" — Task 6 tests it against real files, and
// `npm run test:fallow` against the real binary. Every real process gets a real kill (PF4)
// and is killed again in afterEach; every test has its own time limit (PF7).
import { cp, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { clearInterval as stopSampling, setInterval as sampleEvery } from 'node:timers';
import { setTimeout as sleep } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { createFallowRunner } from '../../src/adapters/fallow/fallow-runner';
import type { SpawnLike } from '../../src/adapters/fallow/node-process-access';
import { InMemoryEvidenceStore } from '../../src/adapters/storage/in-memory-evidence-store';
import { InMemorySnapshotStore } from '../../src/adapters/storage/in-memory-snapshot-store';
import { AnalysisCoordinator } from '../../src/application/analysis/analysis-coordinator';
import { isActive } from '../../src/application/analysis/analysis-state';
import { createFallowAnalysisService, type FallowAnalysisService } from '../../src/application/analysis/fallow-analysis-service';
import { FALLOW_RUN_ARGS, FALLOW_STDERR_TAIL_BYTES, FALLOW_STDOUT_MAX_BYTES, classifyFallowExit } from '../../src/application/analysis/fallow-invocation';
import { approve } from '../../src/application/approval';
import type { AnalyzerBindingStore } from '../../src/application/ports/analyzer-binding-store';
import { ScanCoordinator, createCancellationToken } from '../../src/application/scan-coordinator';
import { normalizeAbsolutePath } from '../../src/domain/path-safety';
import type { AnalysisScope, CodebaseSnapshot } from '../../src/domain/model';
import { createFixedClock } from '../fixtures/clock';
import { emptyEvidenceReport } from '../fixtures/evidence-report';
import { createFakeExecutableInspector } from '../fixtures/fake-executable-inspector';
import { createInMemoryAnalyzerStore } from '../fixtures/in-memory-analyzer-store';
import { nodeWrapped } from '../fixtures/node-wrapped-port';
import { createRealNodePort } from '../fixtures/real-node-port';
import { realKill, realSpawn } from '../fixtures/real-spawn';

const PROJECT = fileURLToPath(new URL('../fixtures/fallow/project', import.meta.url));
const FAKE = fileURLToPath(new URL('../fixtures/fallow-runner/fake-fallow.mjs', import.meta.url));
const EXE = process.platform === 'win32' ? 'C:\\Tools\\fallow\\fallow.exe' : '/opt/fallow/bin/fallow';
const bases: string[] = [];
const pids: number[] = [];

// PF2: capture-free helpers live at module scope.
const alive = (pid: number): boolean => { try { process.kill(pid, 0); return true; } catch { return false; } };
const trackedSpawn: SpawnLike = (command, args, options) => {
  const child = realSpawn(command, args, options);
  if (child.pid !== undefined) pids.push(child.pid);
  return child;
};

afterEach(async () => {
  for (const pid of pids.splice(0)) if (alive(pid)) { try { process.kill(pid, 'SIGKILL'); } catch { /* gone */ } }
  for (const base of bases.splice(0)) await rm(base, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
});

/** PF1/PF7: a real wait with a deadline, so a regression fails instead of hanging. */
async function until(condition: () => boolean, what: string, withinMs = 15_000): Promise<void> {
  const deadline = Date.now() + withinMs;
  while (!condition()) {
    if (Date.now() > deadline) throw new Error(`timed out waiting for ${what}`);
    await sleep(25);
  }
}

interface World {
  root: string;
  snapshot: CodebaseSnapshot;
  service: FallowAnalysisService;
  store: AnalyzerBindingStore;
  evidence: InMemoryEvidenceStore;
  requests: { args: readonly string[] }[];
  mode: { run: string; probe: string };
  rescan: () => Promise<CodebaseSnapshot>;
  release: () => void;
}

async function world(options: { hold?: boolean } = {}): Promise<World> {
  const base = await mkdtemp(join(tmpdir(), 'ci-fallow-analysis-'));
  bases.push(base);
  const root = join(base, 'project');
  await cp(PROJECT, root, { recursive: true });
  const clock = createFixedClock('2026-09-23T10:00:00.000Z');
  const snapshots = new InMemorySnapshotStore(clock);
  const scope: AnalysisScope = { rootPath: root, exclusions: [], maxFileBytes: 5_000_000, followSymlinks: false };
  const scanner = new ScanCoordinator({ port: createRealNodePort(), store: snapshots, clock, createCancellationToken });
  const rescan = async (): Promise<CodebaseSnapshot> => {
    clock.advance(1_000);
    await scanner.start(approve('p1', root, scope, clock), scope);
    return snapshots.latestFor('p1')!;
  };
  const snapshot = await rescan();
  const mode = { run: 'ok', probe: 'version' };
  // PF2: a nullable handle, never a no-op initialiser.
  let release: (() => void) | null = null;
  const gate = options.hold === true ? new Promise<void>((resolve) => { release = resolve; }) : null;
  const runner = createFallowRunner({ spawn: trackedSpawn, env: process.env, platform: process.platform, killProcess: realKill });
  const port = nodeWrapped(runner, (args) => (args[0] === '--version' ? mode.probe : mode.run), gate === null ? undefined : () => gate);
  const evidence = new InMemoryEvidenceStore();
  const store = createInMemoryAnalyzerStore('m');
  const coordinator = new AnalysisCoordinator({ process: port, evidence, snapshots, clock, createCancellationToken });
  const service = createFallowAnalysisService({
    store, inspector: createFakeExecutableInspector(process.platform === 'win32' ? 'fallow.exe' : 'fallow'),
    coordinator, snapshots, getFilesystem: () => createRealNodePort(), machineId: 'm', clock,
  });
  return {
    root, snapshot, service, store, evidence, requests: port.requests, mode, rescan,
    release: () => { release?.(); },
  };
}

const settled = (w: World): Promise<void> => until(() => !isActive(w.service.stateOf('p1')), 'the run to settle');

async function trustAndRun(w: World): Promise<void> {
  const reviewed = await w.service.review('p1', w.snapshot, EXE);
  if (!reviewed.ok) throw new Error(`test setup: review refused (${reviewed.code})`);
  expect(await w.service.trustAndRun('p1', w.snapshot, reviewed.review)).toEqual({ kind: 'started' });
  await settled(w);
}

async function startTrusted(w: World): Promise<void> {
  const reviewed = await w.service.review('p1', w.snapshot, EXE);
  if (!reviewed.ok) throw new Error('test setup: review refused');
  expect(await w.service.trustAndRun('p1', w.snapshot, reviewed.review)).toEqual({ kind: 'started' });
}

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
    expect(alive(pids[pids.length - 1]!)).toBe(false);
  }, 30_000);
});

describe('no freeze (acceptance 3)', () => {
  it('the event loop never stalls for 50 ms while a child hangs or streams 12 MB; the final parse is only measured', async () => {
    const w = await world();
    const runner = createFallowRunner({ spawn: trackedSpawn, env: process.env, platform: process.platform, killProcess: realKill });
    const request = (mode: string, timeoutMs: number) => ({
      executablePath: process.execPath, args: [FAKE, `--mode=${mode}`, ...FALLOW_RUN_ARGS(w.root)], cwd: w.root,
      timeoutMs, maxStdoutBytes: FALLOW_STDOUT_MAX_BYTES, maxStderrBytes: FALLOW_STDERR_TAIL_BYTES,
    });
    for (const [mode, timeoutMs, expected] of [['hang', 2_000, 'timed-out'], ['streamed', 30_000, 'exited']] as const) {
      let last = performance.now();
      let worst = 0;
      const sampler = sampleEvery(() => { const now = performance.now(); worst = Math.max(worst, now - last); last = now; }, 10);
      const outcome = await runner.run(request(mode, timeoutMs), createCancellationToken().token);
      stopSampling(sampler);
      expect(outcome.kind, mode).toBe(expected);
      const parseStarted = performance.now();
      const classified = classifyFallowExit(outcome, 120);
      process.stdout.write(`[no-freeze] ${mode}: largest event-loop gap ${worst.toFixed(1)} ms; final parse ${(performance.now() - parseStarted).toFixed(1)} ms (${classified.kind})\n`);
      expect(worst, `${mode}: largest event-loop gap`).toBeLessThan(50);
    }
  }, 60_000);
});
