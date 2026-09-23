// Part 7 Z40/Z41 (G6 "Verify analyzer cache/report/log side effects against the tested
// version"): OPT-IN. Runs the real, pinned fallow — fetched by `npm run test:fallow` into
// the git-ignored .fallow-bin/, or the binary named by FALLOW_BIN — through the real
// inspector and runner, on a temporary copy of the fixture project. Collected only by
// vitest.fallow.config.ts; skipped (never failed, never downloaded) when no binary is there.
import { existsSync, readFileSync } from 'node:fs';
import * as fsPromises from 'node:fs/promises';
import { cp, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { createExecutableInspector } from '../../src/adapters/fallow/executable-inspector';
import { createFallowRunner } from '../../src/adapters/fallow/fallow-runner';
import type { NodeFsPromisesLike } from '../../src/adapters/filesystem/node-globals';
import {
  FALLOW_RUN_ARGS, FALLOW_STDERR_TAIL_BYTES, FALLOW_STDOUT_MAX_BYTES, FALLOW_VERSION_ARGS, classifyFallowExit, classifyVersionProbe,
} from '../../src/application/analysis/fallow-invocation';
import { normalizeFallow } from '../../src/application/evidence/normalize-fallow';
import type { ProcessOutcome, ProcessRequest } from '../../src/application/ports/analyzer-process';
import { createCancellationToken } from '../fixtures/cancellation-token';
import { FALLOW_FIXTURES, rawReport, type FallowFixture } from '../fixtures/fallow-fixture';
import { realKill, realSpawn } from '../fixtures/real-spawn';
import { hashTree } from '../fixtures/temp-tree';

function resolveFallowBin(): string | null {
  const fromEnv = process.env.FALLOW_BIN;
  if (fromEnv !== undefined && fromEnv !== '') return fromEnv;
  const file = fileURLToPath(new URL('../../.fallow-bin/bin-path.txt', import.meta.url));
  return existsSync(file) ? readFileSync(file, 'utf8').trim() : null;
}

const BIN = resolveFallowBin();
const PROJECT = fileURLToPath(new URL('../fixtures/fallow/project', import.meta.url));
const TITLE = BIN === null ? 'fallow binary not fetched: run npm run test:fallow' : `the real fallow at ${BIN}`;

// PF2: capture-free helpers live at module scope.
const alive = (pid: number): boolean => { try { process.kill(pid, 0); return true; } catch { return false; } };
const shape = (findings: readonly { id: string; path: string; line: number | null }[]): string[] =>
  findings.map((f) => `${f.id} ${f.path}:${f.line ?? '-'}`).sort();

describe.skipIf(BIN === null)(TITLE, () => {
  const bin = BIN ?? '';
  const pids: number[] = [];
  const bases: string[] = [];
  const runner = createFallowRunner({
    spawn: (command, args, options) => {
      const child = realSpawn(command, args, options);
      if (child.pid !== undefined) pids.push(child.pid);
      return child;
    },
    env: process.env, platform: process.platform, killProcess: realKill,
  });
  const inspector = createExecutableInspector({ fsPromises: fsPromises as unknown as NodeFsPromisesLike, platform: process.platform });

  afterEach(async () => {
    runner.killAll();
    for (const pid of pids.splice(0)) if (alive(pid)) { try { process.kill(pid, 'SIGKILL'); } catch { /* gone */ } }
    for (const base of bases.splice(0)) await rm(base, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  });

  async function projectCopy(): Promise<string> {
    const base = await mkdtemp(join(tmpdir(), 'ci-fallow-real-'));
    bases.push(base);
    const root = join(base, 'project');
    await cp(PROJECT, root, { recursive: true });
    return root;
  }
  const request = (root: string, args: readonly string[] = FALLOW_RUN_ARGS(root), overrides: Partial<ProcessRequest> = {}): ProcessRequest => ({
    executablePath: bin, args, cwd: root, timeoutMs: 60_000, maxStdoutBytes: FALLOW_STDOUT_MAX_BYTES, maxStderrBytes: FALLOW_STDERR_TAIL_BYTES, ...overrides,
  });
  const go = (r: ProcessRequest): Promise<ProcessOutcome> => runner.run(r, createCancellationToken().token);
  const lastPidGone = (): boolean => pids.length > 0 && !alive(pids[pids.length - 1]!);

  it('1. the inspector accepts it as this platform\'s native binary', async () => {
    const root = await projectCopy();
    expect(await inspector.inspect(bin, root)).toMatchObject({ ok: true, facts: { insideRoot: false } });
  }, 30_000);

  it('2. the probe reports a 3.x version (3.27.0 unless FALLOW_BIN names another)', async () => {
    const root = await projectCopy();
    const probe = classifyVersionProbe(await go(request(root, FALLOW_VERSION_ARGS, { timeoutMs: 5_000, maxStdoutBytes: 4_096 })));
    process.stdout.write(`[fallow-real] ${bin} on ${process.platform}: ${JSON.stringify(probe)}\n`);
    expect(probe.ok).toBe(true);
    if (process.env.FALLOW_BIN === undefined && probe.ok) expect(probe.version).toBe('3.27.0');
  }, 30_000);

  it('3. the exact run completes and reproduces the committed recording of its version', async () => {
    const root = await projectCopy();
    const probe = classifyVersionProbe(await go(request(root, FALLOW_VERSION_ARGS, { timeoutMs: 5_000, maxStdoutBytes: 4_096 })));
    const outcome = await go(request(root));
    expect(outcome.kind).toBe('exited');
    if (outcome.kind === 'exited') expect([0, 1]).toContain(outcome.exitCode);
    const result = classifyFallowExit(outcome, 60);
    expect(result.kind).toBe('completed');
    const fixture = probe.ok ? (`combined-${probe.version}` as FallowFixture) : null;
    if (result.kind !== 'completed' || fixture === null || !FALLOW_FIXTURES.includes(fixture)) return;
    const expected = shape(normalizeFallow(rawReport(fixture), { stripPrefix: null }).findings);
    expect(expected.length).toBeGreaterThan(0);
    expect(shape(normalizeFallow(result.report, { stripPrefix: null }).findings)).toEqual(expected);
  }, 60_000);

  it('4. fs-diff: the exact run writes nothing under the root (no .fallow/ cache, no report, no log)', async () => {
    const root = await projectCopy();
    const before = await hashTree(root);
    expect(Object.keys(before).length).toBeGreaterThan(0);
    expect(classifyFallowExit(await go(request(root)), 60).kind).toBe('completed');
    expect(await hashTree(root)).toEqual(before);
  }, 60_000);

  it('5. control: the same run WITHOUT --no-cache does write .fallow/, so the diff above can see writes', async () => {
    const root = await projectCopy();
    await go(request(root, ['--format', 'json', '--quiet', '--root', root]));
    expect(existsSync(join(root, '.fallow'))).toBe(true);
  }, 60_000);

  it('6. a root that does not exist exits 2 with fallow\'s error object: analyzer-error', async () => {
    const root = await projectCopy();
    const outcome = await go(request(root, FALLOW_RUN_ARGS(join(root, 'nope'))));
    expect(outcome).toMatchObject({ kind: 'exited', exitCode: 2 });
    expect(classifyFallowExit(outcome, 60)).toMatchObject({ kind: 'failed', code: 'analyzer-error' });
  }, 60_000);

  // Observed on fallow 3.27.0: the bare (combined) command ignores --fail-on-issues here (its
  // `error-severity-findings` gate reports `enforced: false`) and exits 0, so the exit-1
  // control uses the `dead-code` command, which honours the flag on this project.
  it('7. control: dead-code --fail-on-issues exits 1 on this project, and exit 1 with a report still completes', async () => {
    const root = await projectCopy();
    const outcome = await go(request(root, ['dead-code', ...FALLOW_RUN_ARGS(root), '--fail-on-issues']));
    expect(outcome).toMatchObject({ kind: 'exited', exitCode: 1 });
    expect(classifyFallowExit(outcome, 60).kind).toBe('completed');
  }, 60_000);

  it('8. a 1 ms limit times the run out, and the process is gone', async () => {
    const root = await projectCopy();
    expect((await go(request(root, FALLOW_RUN_ARGS(root), { timeoutMs: 1 }))).kind).toBe('timed-out');
    expect(lastPidGone()).toBe(true);
  }, 30_000);

  it('9. a cancel right after the spawn cancels it, and the process is gone', async () => {
    const root = await projectCopy();
    const { token, cancel } = createCancellationToken();
    const done = runner.run(request(root), token);
    cancel();
    expect((await done).kind).toBe('cancelled');
    expect(lastPidGone()).toBe(true);
  }, 30_000);

  it('10. a 1,000-byte stdout cap stops it, and the process is gone', async () => {
    const root = await projectCopy();
    expect((await go(request(root, FALLOW_RUN_ARGS(root), { maxStdoutBytes: 1_000 }))).kind).toBe('stdout-too-large');
    expect(lastPidGone()).toBe(true);
  }, 60_000);
});
