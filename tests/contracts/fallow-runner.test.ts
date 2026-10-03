// Part 7 Z38: the REAL runner spawning real processes: `process.execPath` running the fake
// fallow. The executable is supplied through ProcessRequest (the adapter is generic), and
// real node:child_process is injected, with a real kill (PF4). Every process a test starts
// is killed in afterEach.
import { mkdir, mkdtemp, readFile, realpath, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { createFallowRunner } from '../../src/adapters/fallow/fallow-runner';
import { FALLOW_ENV_ALLOW_LIST, FALLOW_RUN_ARGS, classifyFallowExit } from '../../src/application/analysis/fallow-invocation';
import type { ProcessOutcome, ProcessRequest } from '../../src/application/ports/analyzer-process';
import { createCancellationToken } from '../fixtures/cancellation-token';
import { fallowText } from '../fixtures/fallow-fixture';
import { realKill, realSpawn } from '../fixtures/real-spawn';

const FAKE = fileURLToPath(new URL('../fixtures/fallow-runner/fake-fallow.mjs', import.meta.url));
// On Windows, libuv itself copies these from the parent into every child's environment,
// whatever env the spawn call passes (uv_spawn's "required" variables). The runner's own
// env is pinned exactly by tests/unit/fallow-runner.test.ts.
const LIBUV_WINDOWS_REQUIRED: readonly string[] = [
  'HOMEDRIVE', 'HOMEPATH', 'LOGONSERVER', 'SYSTEMDRIVE', 'SYSTEMROOT', 'TEMP', 'USERDOMAIN', 'USERNAME', 'USERPROFILE', 'WINDIR',
];
const pids: number[] = [];
const bases: string[] = [];
const runner = createFallowRunner({
  spawn: (command, args, options) => {
    const child = realSpawn(command, args, options);
    if (child.pid !== undefined) pids.push(child.pid);
    return child;
  },
  env: process.env,
  platform: process.platform,
  killProcess: realKill,
});

const alive = (pid: number): boolean => {
  try { process.kill(pid, 0); return true; } catch { return false; }
};
async function gone(pid: number, withinMs = 3_000): Promise<boolean> {
  const until = Date.now() + withinMs;
  while (Date.now() < until) {
    if (!alive(pid)) return true;
    await sleep(50);
  }
  return !alive(pid);
}
/** The grandchild's pid once the fake has written it whole: polled every 50 ms for up to 10 s. */
async function grandchildPid(file: string, withinMs = 10_000): Promise<number> {
  const until = Date.now() + withinMs;
  while (Date.now() < until) {
    const pid = Number(await readFile(file, 'utf8').catch(() => ''));
    if (Number.isInteger(pid) && pid > 0) return pid;
    await sleep(50);
  }
  throw new Error(`the fake never wrote a grandchild pid to ${file} within ${withinMs} ms`);
}
afterEach(async () => {
  runner.killAll();
  for (const pid of pids.splice(0)) if (alive(pid)) { try { process.kill(pid, 'SIGKILL'); } catch { /* already gone */ } }
  for (const base of bases.splice(0)) await rm(base, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
});

async function rootNamed(name = 'root'): Promise<string> {
  const base = await mkdtemp(join(tmpdir(), 'ci-fallow-runner-'));
  bases.push(base);
  const root = join(base, name);
  await mkdir(root);
  return root;
}
function request(mode: string, root: string, overrides: Partial<ProcessRequest> = {}): ProcessRequest {
  return {
    executablePath: process.execPath, args: [FAKE, `--mode=${mode}`, ...FALLOW_RUN_ARGS(root)], cwd: root,
    timeoutMs: 20_000, maxStdoutBytes: 16 * 1024 * 1024, maxStderrBytes: 65_536, ...overrides,
  };
}
const run = (r: ProcessRequest): Promise<ProcessOutcome> => runner.run(r, createCancellationToken().token);

describe('the real runner: exit semantics (Z18, spec §1)', () => {
  it('exit 0 with a report is read whole', async () => {
    const outcome = await run(request('ok', await rootNamed()));
    expect(outcome).toMatchObject({ kind: 'exited', exitCode: 0, stdout: fallowText('combined-3.27.0') });
    expect(classifyFallowExit(outcome, 120).kind).toBe('completed');
  });

  it('exit 1 with a report is completed; exit 2 with the error object is analyzer-error', async () => {
    const root = await rootNamed();
    expect(classifyFallowExit(await run(request('findings-exit-1', root)), 120).kind).toBe('completed');
    expect(classifyFallowExit(await run(request('error-exit-2', root)), 120)).toMatchObject({ kind: 'failed', code: 'analyzer-error' });
  });

  it('a truncated report and garbage are output-not-json', async () => {
    const root = await rootNamed();
    for (const mode of ['truncated', 'garbage']) {
      expect(classifyFallowExit(await run(request(mode, root)), 120), mode).toEqual({ kind: 'failed', code: 'output-not-json', detail: '' });
    }
  });

  it('a missing executable is spawn-failed ENOENT', async () => {
    const root = await rootNamed();
    expect(await run({ ...request('ok', root), executablePath: join(root, 'nope', 'fallow.exe') })).toEqual({ kind: 'spawn-failed', errorCode: 'ENOENT' });
  });
});

describe('the real runner: bounds (Z17)', () => {
  it('stops a 17 MB stdout at 16 MB, and the process is gone', async () => {
    const outcome = await run(request('huge', await rootNamed()));
    expect(outcome.kind).toBe('stdout-too-large');
    expect(await gone(pids[pids.length - 1]!)).toBe(true);
  });

  it('keeps only the last 64 KB of a 1 MB stderr, separate from stdout', async () => {
    const outcome = await run(request('stderr-flood', await rootNamed()));
    expect(outcome.kind).toBe('exited');
    if (outcome.kind !== 'exited') return;
    expect(outcome.stderrTail.length).toBeLessThanOrEqual(65_536);
    expect(outcome.stderrTail.endsWith('last line\n')).toBe(true);
    expect(outcome.stdout).toBe(fallowText('combined-3.27.0'));
  });

  it('keeps markup on stderr as plain text for the log excerpt', async () => {
    const outcome = await run(request('html-stderr', await rootNamed()));
    expect(outcome).toMatchObject({ kind: 'exited', exitCode: 3, stderrTail: '<img src=x onerror=alert(1)>\n' });
  });
});

describe('the real runner: time, cancel and shutdown (Z18)', () => {
  it('times out a hanging process, which is then gone', async () => {
    const outcome = await run(request('hang', await rootNamed(), { timeoutMs: 500 }));
    expect(outcome.kind).toBe('timed-out');
    expect(await gone(pids[pids.length - 1]!)).toBe(true);
  });

  it('Review Focus 5: times out a process that never stops writing', async () => {
    expect((await run(request('trickle', await rootNamed(), { timeoutMs: 500 }))).kind).toBe('timed-out');
  });

  it('cancels a hanging process', async () => {
    const { token, cancel } = createCancellationToken();
    const done = runner.run(request('hang', await rootNamed()), token);
    void sleep(200).then(cancel);
    expect((await done).kind).toBe('cancelled');
    expect(await gone(pids[pids.length - 1]!)).toBe(true);
  });

  it('killAll ends a hanging process at once', async () => {
    const done = runner.run(request('hang', await rootNamed()), createCancellationToken().token);
    await sleep(200);
    runner.killAll();
    expect((await done).kind).toBe('cancelled');
    expect(await gone(pids[pids.length - 1]!)).toBe(true);
  });

  // One plain test block with a platform branch, never a conditional skip or run variant:
  // evidence-numbers.test.ts counts this file's test blocks (K28), and a conditional
  // spelling would be missed.
  it('cancel ends the whole process group on POSIX, and the direct child only on Windows (the documented limitation)', async () => {
    const root = await rootNamed();
    const { token, cancel } = createCancellationToken();
    const done = runner.run(request('grandchild', root), token);
    // Final review: polled with a deadline, never a fixed sleep (a loaded machine starts the
    // fake late), and registered for afterEach at once, so it cannot leak if a check fails.
    const grandchild = await grandchildPid(join(root, 'grandchild.pid'));
    const direct = pids[pids.length - 1]!;
    pids.push(grandchild);
    cancel();
    expect((await done).kind).toBe('cancelled');
    expect(await gone(direct)).toBe(true);
    if (process.platform !== 'win32') expect(await gone(grandchild)).toBe(true);
  }, 20_000);
});

describe('the real runner: what the child sees (Z15, Z16)', () => {
  it('gets only the allow-listed environment plus NO_COLOR, never FALLOW_* or NODE_OPTIONS', async () => {
    process.env.FALLOW_PRODUCTION = '1';
    process.env.NODE_OPTIONS = '--max-old-space-size=64';
    try {
      const outcome = await run(request('env-dump', await rootNamed()));
      if (outcome.kind !== 'exited') throw new Error(`env-dump ended as ${outcome.kind}`);
      const keys = (JSON.parse(outcome.stdout ?? '[]') as string[]).filter((k) => !k.startsWith('='));
      const platformAdded = process.platform === 'win32' ? LIBUV_WINDOWS_REQUIRED : [];
      const allowed = [...FALLOW_ENV_ALLOW_LIST, 'NO_COLOR', ...platformAdded].map((k) => k.toUpperCase());
      expect(keys).toContain('NO_COLOR');
      expect(keys.length).toBeGreaterThan(0);
      for (const key of keys) expect(allowed, key).toContain(key.toUpperCase());
      expect(keys.map((k) => k.toUpperCase()).filter((k) => k.startsWith('FALLOW_') || k === 'NODE_OPTIONS')).toEqual([]);
    } finally {
      delete process.env.FALLOW_PRODUCTION;
      delete process.env.NODE_OPTIONS;
    }
  });

  it('Review Focus 2: a root with a space and a non-ASCII letter reaches the child unquoted, as its cwd', async () => {
    const root = await rootNamed('my repo ü');
    const argv = await run(request('argv', root));
    expect(argv.kind === 'exited' ? JSON.parse(argv.stdout ?? 'null') : null).toEqual(['--format', 'json', '--no-cache', '--quiet', '--root', root]);
    const cwd = await run(request('cwd', root));
    expect(cwd.kind === 'exited' ? await realpath(cwd.stdout ?? '') : null).toBe(await realpath(root));
  });
});
