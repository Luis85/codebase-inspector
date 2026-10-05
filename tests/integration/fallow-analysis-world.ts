// Shared setup for the real-stack fallow analysis integration tests (Task 6, Z38, O2,
// PP10): the REAL service, coordinator and runner over a REAL scan of a temporary copy
// of the fallow fixture project. The executable is the fake fallow run by Node
// (nodeWrapped); the inspector is scripted, because it would rightly refuse node as
// "not named fallow" — the no-freeze case tests it against real files, and
// `npm run test:fallow` against the real binary. Every real process gets a real kill
// (PF4) and is killed again in afterEach; every test has its own time limit (PF7).
// Moved unchanged from fallow-analysis.test.ts and split across that file and
// fallow-no-freeze.test.ts. Not a *.test.ts, so vitest never collects this file.
import { cp, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { afterEach, expect } from 'vitest';
import { createFallowRunner } from '../../src/adapters/fallow/fallow-runner';
import type { SpawnLike } from '../../src/adapters/fallow/node-process-access';
import { InMemoryEvidenceStore } from '../../src/adapters/storage/in-memory-evidence-store';
import { InMemorySnapshotStore } from '../../src/adapters/storage/in-memory-snapshot-store';
import { AnalysisCoordinator } from '../../src/application/analysis/analysis-coordinator';
import { isActive } from '../../src/application/analysis/analysis-state';
import { createFallowAnalysisService, type FallowAnalysisService } from '../../src/application/analysis/fallow-analysis-service';
import { approve } from '../../src/application/approval';
import type { AnalyzerBindingStore } from '../../src/application/ports/analyzer-binding-store';
import { ScanCoordinator, createCancellationToken } from '../../src/application/scan-coordinator';
import type { AnalysisScope, CodebaseSnapshot } from '../../src/domain/model';
import { createFixedClock } from '../fixtures/clock';
import { createFakeExecutableInspector } from '../fixtures/fake-executable-inspector';
import { createInMemoryAnalyzerStore } from '../fixtures/in-memory-analyzer-store';
import { nodeWrapped } from '../fixtures/node-wrapped-port';
import { createRealNodePort } from '../fixtures/real-node-port';
import { killTree, realKill, realSpawn } from '../fixtures/real-spawn';

const PROJECT = fileURLToPath(new URL('../fixtures/fallow/project', import.meta.url));
export const FAKE = fileURLToPath(new URL('../fixtures/fallow-runner/fake-fallow.mjs', import.meta.url));
export const EXE = process.platform === 'win32' ? 'C:\\Tools\\fallow\\fallow.exe' : '/opt/fallow/bin/fallow';
const bases: string[] = [];
export const pids: number[] = [];

// PF2: capture-free helpers live at module scope.
export const alive = (pid: number): boolean => { try { process.kill(pid, 0); return true; } catch { return false; } };
export const trackedSpawn: SpawnLike = (command, args, options) => {
  const child = realSpawn(command, args, options);
  // E42: only fallow's own spawns (they carry a cwd), never the Windows taskkill a stop now causes.
  if (child.pid !== undefined && 'cwd' in options) pids.push(child.pid);
  return child;
};

afterEach(async () => {
  for (const pid of pids.splice(0)) killTree(pid);
  for (const base of bases.splice(0)) await rm(base, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
});

/** PF1/PF7: a real wait with a deadline, so a regression fails instead of hanging. */
export async function until(condition: () => boolean, what: string, withinMs = 15_000): Promise<void> {
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

export async function world(options: { hold?: boolean } = {}): Promise<World> {
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

export const settled = (w: World): Promise<void> => until(() => !isActive(w.service.stateOf('p1')), 'the run to settle');

export async function trustAndRun(w: World): Promise<void> {
  const reviewed = await w.service.review('p1', w.snapshot, EXE);
  if (!reviewed.ok) throw new Error(`test setup: review refused (${reviewed.code})`);
  expect(await w.service.trustAndRun('p1', w.snapshot, reviewed.review)).toEqual({ kind: 'started' });
  await settled(w);
}

export async function startTrusted(w: World): Promise<void> {
  const reviewed = await w.service.review('p1', w.snapshot, EXE);
  if (!reviewed.ok) throw new Error('test setup: review refused');
  expect(await w.service.trustAndRun('p1', w.snapshot, reviewed.review)).toEqual({ kind: 'started' });
}
