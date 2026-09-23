// Part 7 Z15/Z17/Z18: THE spawn — the one process call in src/, allowed by the guard for
// this file alone. Generic: the application builds the argv; tests supply any executable.
// - One spawn per run: argument array, shell: false, windowsHide, a built environment,
//   stdio ignore/pipe/pipe, and a process group of its own on POSIX (detached).
// - stdout is capped (bytes) and parsed by nobody here; stderr keeps its tail.
// - The time limit is absolute from spawn; output never postpones it.
// - Cancel, the time limit and the cap all stop the same way: SIGTERM (the group on POSIX,
//   kill() on Windows), then SIGKILL after the grace. A stopped run resolves on `exit`,
//   after destroying the pipes, so a grandchild holding them cannot keep it open; if no
//   `exit` comes, it resolves anyway one close grace after SIGKILL. No timer outlives a run.
// - killAll (onunload) sends SIGKILL at once and resolves every run as cancelled.
// - run() never rejects.
import { childProcess, nodeProcess, type ChildProcessLike, type SpawnLike } from './node-process-access';
import { buildChildEnv, createStderrTail, createStdoutCollector } from './process-output';
import {
  FALLOW_CLOSE_GRACE_MS, FALLOW_ENV_ALLOW_LIST, FALLOW_ENV_EXTRA, FALLOW_KILL_GRACE_MS,
} from '../../application/analysis/fallow-invocation';
import type { AnalyzerProcessPort, ProcessOutcome, ProcessRequest } from '../../application/ports/analyzer-process';
import type { CancellationToken } from '../../application/ports/cancellation-token';

export interface FallowRunnerDeps {
  /** null: not the desktop app, so nothing can run. */
  spawn?: SpawnLike | null;
  env?: Readonly<Record<string, string | undefined>>;
  platform?: string;
  killProcess?: (pid: number, signal: string) => void;
  setTimer?: (fn: () => void, ms: number) => unknown;
  clearTimer?: (handle: unknown) => void;
}

type StopReason = 'cancelled' | 'timed-out' | 'stdout-too-large' | 'output-incomplete';
interface LiveRun { stop(reason: StopReason): void; shutdown(): void }

function errorCodeOf(e: unknown): string {
  if (typeof e === 'object' && e !== null && 'code' in e) {
    const code = e.code;
    if (typeof code === 'string') return code;
  }
  return 'UNKNOWN';
}

/** Polish A6 (L12): the module's own spawn, read, never wrapped in a second call: the
 *  runner's `spawn(…)` in `run` is this file's only spawn call (the guard counts them). */
function defaultSpawn(): SpawnLike | null {
  return childProcess?.spawn ?? null;
}

function defaultKill(pid: number, signal: string): void {
  nodeProcess?.kill(pid, signal);
}

// PF1 (the walker.ts pattern): the global timer functions are READ into a local binding,
// never called bare (obsidianmd/prefer-window-timers), and read at CALL time, so a test's
// fake timers are the ones used.
function defaultSetTimer(fn: () => void, ms: number): unknown {
  const schedule = setTimeout;
  return schedule(fn, ms);
}

function defaultClearTimer(handle: unknown): void {
  const unschedule = clearTimeout;
  unschedule(handle as ReturnType<typeof setTimeout>);
}

export function createFallowRunner(deps: FallowRunnerDeps = {}): AnalyzerProcessPort {
  const spawn = deps.spawn === undefined ? defaultSpawn() : deps.spawn;
  const env = deps.env ?? nodeProcess?.env ?? {};
  const platform = deps.platform ?? nodeProcess?.platform ?? 'linux';
  const killProcess = deps.killProcess ?? defaultKill;
  const setTimer = deps.setTimer ?? defaultSetTimer;
  const clearTimer = deps.clearTimer ?? defaultClearTimer;
  const live = new Set<LiveRun>();

  function run(request: ProcessRequest, token: CancellationToken): Promise<ProcessOutcome> {
    if (token.cancelled) return Promise.resolve({ kind: 'cancelled', stderrTail: '' });
    if (spawn === null) return Promise.resolve({ kind: 'spawn-failed', errorCode: 'UNAVAILABLE' });
    let child: ChildProcessLike;
    try {
      child = spawn(request.executablePath, request.args, {
        cwd: request.cwd,
        env: buildChildEnv(env, platform, FALLOW_ENV_ALLOW_LIST, FALLOW_ENV_EXTRA),
        shell: false,
        windowsHide: true,
        detached: platform !== 'win32',
        stdio: ['ignore', 'pipe', 'pipe'],
      });
    } catch (e) {
      return Promise.resolve({ kind: 'spawn-failed', errorCode: errorCodeOf(e) });
    }
    const running = child;
    return new Promise<ProcessOutcome>((resolve) => {
      const stdout = createStdoutCollector(request.maxStdoutBytes);
      const stderr = createStderrTail(request.maxStderrBytes);
      const timers = new Set<unknown>();
      let stopReason: StopReason | null = null;
      let exited = false;
      let settled = false;
      let unsubscribe: (() => void) | null = null;

      const signal = (name: 'SIGTERM' | 'SIGKILL'): void => {
        const pid = running.pid;
        if (platform !== 'win32' && pid !== undefined) {
          try {
            killProcess(-pid, name);
          } catch (e) {
            // Polish A1: ESRCH is "the group is already gone". Anything else (EPERM, EINVAL)
            // means the group was NOT signalled, so the direct child is signalled instead.
            if (errorCodeOf(e) !== 'ESRCH') running.kill(name);
          }
          return;
        }
        running.kill();
      };
      const destroyPipes = (): void => { running.stdout?.destroy(); running.stderr?.destroy(); };
      const after = (ms: number, fn: () => void): void => { timers.add(setTimer(fn, ms)); };
      const stoppedOutcome = (): ProcessOutcome => {
        const stderrTail = stderr.excerpt();
        if (stopReason === 'timed-out') return { kind: 'timed-out', stderrTail };
        if (stopReason === 'stdout-too-large') return { kind: 'stdout-too-large', stderrTail };
        if (stopReason === 'output-incomplete') return { kind: 'output-incomplete', stderrTail };
        return { kind: 'cancelled', stderrTail };
      };
      const handle: LiveRun = {
        stop(reason) {
          if (settled || stopReason !== null) return;
          stopReason = reason;
          if (exited) { destroyPipes(); finish(stoppedOutcome()); return; }
          signal('SIGTERM');
          after(FALLOW_KILL_GRACE_MS, () => {
            if (exited) return;
            signal('SIGKILL');
            // The final deadline (review fix 2): a child that never reports its exit (stuck in
            // uninterruptible I/O, a failed kill) cannot hold the run open forever.
            after(FALLOW_CLOSE_GRACE_MS, () => { destroyPipes(); finish(stoppedOutcome()); });
          });
        },
        shutdown() {
          if (settled) return;
          signal('SIGKILL');
          destroyPipes();
          finish({ kind: 'cancelled', stderrTail: stderr.excerpt() });
        },
      };
      function finish(outcome: ProcessOutcome): void {
        if (settled) return;
        settled = true;
        for (const timer of Array.from(timers)) clearTimer(timer);
        timers.clear();
        unsubscribe?.();
        unsubscribe = null;
        live.delete(handle);
        resolve(outcome);
      }

      live.add(handle);
      unsubscribe = token.onCancelled(() => { handle.stop('cancelled'); });
      running.stdout?.on('data', (chunk) => { if (!stdout.push(chunk)) handle.stop('stdout-too-large'); });
      running.stderr?.on('data', (chunk) => { stderr.push(chunk); });
      // Polish A2: a broken pipe on either stream means the output cannot be trusted. The run
      // stops the way a cancel does (the child is signalled unless it already exited) and ends
      // output-incomplete; the listener also keeps the error off Obsidian's uncaught path.
      const pipeFailed = (): void => { handle.stop('output-incomplete'); };
      running.stdout?.on('error', pipeFailed);
      running.stderr?.on('error', pipeFailed);
      running.on('error', (error) => {
        // Only a failure to start: a failed kill() also emits 'error', and is ignored.
        if (running.pid === undefined) finish({ kind: 'spawn-failed', errorCode: typeof error.code === 'string' ? error.code : 'UNKNOWN' });
      });
      running.on('exit', () => {
        exited = true;
        // Review fix 1: after killAll (or any settle) a late exit arms no timer.
        if (settled) return;
        if (stopReason !== null) { destroyPipes(); finish(stoppedOutcome()); return; }
        after(FALLOW_CLOSE_GRACE_MS, () => { destroyPipes(); finish({ kind: 'output-incomplete', stderrTail: stderr.excerpt() }); });
      });
      running.on('close', (code, signalName) => {
        if (stopReason !== null) { finish(stoppedOutcome()); return; }
        if (code === null) { finish({ kind: 'signalled', signal: signalName ?? 'UNKNOWN', stderrTail: stderr.excerpt() }); return; }
        finish({ kind: 'exited', exitCode: code, stdout: stdout.text(), stdoutBytes: stdout.bytes, stderrTail: stderr.excerpt() });
      });
      after(request.timeoutMs, () => { handle.stop('timed-out'); });
    });
  }

  return {
    run,
    killAll(): void {
      for (const liveRun of Array.from(live)) liveRun.shutdown();
    },
  };
}
