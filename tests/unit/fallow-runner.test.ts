// Part 7 Z15/Z17/Z18 over a scripted child process and fake timers: the exact spawn call,
// the built environment, the caps, the absolute timeout (Review Focus 5), cancel, the kill
// escalation per platform, the close grace, killAll and every spawn failure.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createFallowRunner } from '../../src/adapters/fallow/fallow-runner';
import type { ProcessRequest } from '../../src/application/ports/analyzer-process';
import { createCancellationToken } from '../fixtures/cancellation-token';
import { fakeSpawn } from '../fixtures/fake-child-process';
import { killTree } from '../fixtures/real-spawn';

const REQUEST: ProcessRequest = {
  executablePath: '/opt/fallow/bin/fallow', args: ['--format', 'json', '--no-cache', '--quiet', '--root', '/repo'],
  cwd: '/repo', timeoutMs: 120_000, maxStdoutBytes: 1_000_000, maxStderrBytes: 8,
};

function setup(platform = 'linux', env: Record<string, string> = { PATH: '/usr/bin' }) {
  const spawned = fakeSpawn();
  const kills: [number, string][] = [];
  const runner = createFallowRunner({ spawn: spawned.spawn, env, platform, killProcess: (pid, signal) => { kills.push([pid, signal]); } });
  const { token, cancel } = createCancellationToken();
  return { runner, spawned, kills, token, cancel, child: () => spawned.children[0]! };
}

function throwGone(): never {
  throw Object.assign(new Error('ESRCH'), { code: 'ESRCH' });
}

function throwDenied(): never { throw Object.assign(new Error('EPERM'), { code: 'EPERM' }); }

function throwInvalid(): never {
  throw Object.assign(new Error('bad'), { code: 'EINVAL' });
}

beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); });

describe('the spawn call (Z15, Z16)', () => {
  it('spawns once, exactly as specified, with the built environment', () => {
    const s = setup('linux', { PATH: '/usr/bin', HOME: '/home/a', FALLOW_PRODUCTION: '1', NODE_OPTIONS: '--inspect' });
    void s.runner.run(REQUEST, s.token);
    expect(s.spawned.calls).toEqual([{
      command: REQUEST.executablePath, args: REQUEST.args,
      options: { cwd: '/repo', env: { PATH: '/usr/bin', HOME: '/home/a', NO_COLOR: '1' }, shell: false, windowsHide: true, detached: true, stdio: ['ignore', 'pipe', 'pipe'] },
    }]);
  });

  it('is not detached on Windows', () => {
    const s = setup('win32', { Path: 'C:\\bin' });
    void s.runner.run(REQUEST, s.token);
    expect(s.spawned.calls[0]?.options).toMatchObject({ detached: false, env: { PATH: 'C:\\bin', NO_COLOR: '1' } });
  });
});

describe('a finished process (Z17)', () => {
  it('resolves on close with the whole stdout and the stderr tail', async () => {
    const s = setup();
    const done = s.runner.run(REQUEST, s.token);
    s.child().stdout.emit('{"a":');
    s.child().stdout.emit('1}');
    s.child().stderr.emit('0123456789');
    s.child().exit(0);
    s.child().close(0);
    await expect(done).resolves.toEqual({ kind: 'exited', exitCode: 0, stdout: '{"a":1}', stdoutBytes: 7, stderrTail: '23456789' });
  });

  it('reports a signal it did not send', async () => {
    const s = setup();
    const done = s.runner.run(REQUEST, s.token);
    s.child().exit(null, 'SIGSEGV');
    s.child().close(null, 'SIGSEGV');
    await expect(done).resolves.toEqual({ kind: 'signalled', signal: 'SIGSEGV', stderrTail: '' });
  });

  it('gives up on pipes that never close 2 s after exit, and destroys them', async () => {
    const s = setup();
    const done = s.runner.run(REQUEST, s.token);
    s.child().exit(0);
    vi.advanceTimersByTime(2_000);
    await expect(done).resolves.toEqual({ kind: 'output-incomplete', stderrTail: '' });
    expect([s.child().stdout.destroyed, s.child().stderr.destroyed]).toEqual([true, true]);
  });
});

describe('stopping a process (Z17, Z18)', () => {
  it('kills the group at the stdout cap and never parses what it kept', async () => {
    const s = setup();
    const done = s.runner.run({ ...REQUEST, maxStdoutBytes: 16 }, s.token);
    s.child().stdout.emit('x'.repeat(10));
    s.child().stdout.emit('y'.repeat(10));
    expect(s.kills).toEqual([[-4242, 'SIGTERM']]);
    s.child().exit(null, 'SIGTERM');
    await expect(done).resolves.toEqual({ kind: 'stdout-too-large', stderrTail: '' });
  });

  it('Review Focus 5: the time limit is absolute: output every second does not postpone it', async () => {
    const s = setup();
    const done = s.runner.run(REQUEST, s.token);
    for (let second = 1; second < 120; second += 1) {
      vi.advanceTimersByTime(1_000);
      s.child().stdout.emit(' ');
    }
    expect(s.kills).toEqual([]);
    vi.advanceTimersByTime(1_000);
    expect(s.kills).toEqual([[-4242, 'SIGTERM']]);
    s.child().exit(null, 'SIGTERM');
    await expect(done).resolves.toEqual({ kind: 'timed-out', stderrTail: '' });
  });

  it('cancel sends SIGTERM to the group, then SIGKILL after 2 s, and resolves only at exit', async () => {
    const s = setup();
    const done = s.runner.run(REQUEST, s.token);
    let settled = false;
    void done.then(() => { settled = true; });
    s.cancel();
    expect(s.kills).toEqual([[-4242, 'SIGTERM']]);
    vi.advanceTimersByTime(2_000);
    expect(s.kills).toEqual([[-4242, 'SIGTERM'], [-4242, 'SIGKILL']]);
    await Promise.resolve();
    expect(settled).toBe(false);
    s.child().exit(null, 'SIGKILL');
    await expect(done).resolves.toEqual({ kind: 'cancelled', stderrTail: '' });
  });

  // Gap closure GRB3/E41: fallow spawns `git` (and git a second git), so on Windows a stop
  // tree-kills first, with System32 taskkill, and signals the direct child only once that
  // has ended (taskkill needs the root alive to find the tree), or after its short bound.
  describe('on Windows (E41)', () => {
    const WIN_ENV = { Path: 'C:\\bin', SystemRoot: 'C:\\Windows' };
    const TASKKILL = 'C:\\Windows\\System32\\taskkill.exe';

    it('tree-kills via System32 taskkill before the direct kill', async () => {
      const s = setup('win32', WIN_ENV);
      const done = s.runner.run(REQUEST, s.token);
      s.cancel();
      expect(s.spawned.calls).toHaveLength(2);
      expect(s.spawned.calls[1]).toEqual({ command: TASKKILL, args: ['/PID', '4242', '/T', '/F'], options: { shell: false, windowsHide: true, stdio: 'ignore' } });
      expect(s.child().kills).toEqual([]);
      s.spawned.children[1]!.exit(0);
      expect(s.child().kills).toEqual([undefined]);
      vi.advanceTimersByTime(2_000);
      expect(s.spawned.calls.map((c) => c.command)).toEqual([REQUEST.executablePath, TASKKILL, TASKKILL]);
      s.spawned.children[2]!.exit(128);
      expect(s.child().kills).toEqual([undefined, undefined]);
      expect(s.kills).toEqual([]);
      s.child().exit(1);
      await expect(done).resolves.toEqual({ kind: 'cancelled', stderrTail: '' });
      expect(vi.getTimerCount()).toBe(0);
    });

    it('a taskkill that never reports does not keep the direct kill waiting past 1 s', async () => {
      const s = setup('win32', WIN_ENV);
      const done = s.runner.run(REQUEST, s.token);
      s.cancel();
      vi.advanceTimersByTime(999);
      expect(s.child().kills).toEqual([]);
      vi.advanceTimersByTime(1);
      expect(s.child().kills).toEqual([undefined]);
      s.spawned.children[1]!.exit(0);
      expect(s.child().kills).toEqual([undefined]);
      s.child().exit(1);
      await expect(done).resolves.toEqual({ kind: 'cancelled', stderrTail: '' });
    });

    it('a taskkill that fails to start or errors still gets the direct kill', async () => {
      const s = setup('win32', WIN_ENV);
      const done = s.runner.run(REQUEST, s.token);
      s.cancel();
      s.spawned.children[1]!.emitError('ENOENT');
      expect(s.child().kills).toEqual([undefined]);
      s.child().exit(1);
      await expect(done).resolves.toEqual({ kind: 'cancelled', stderrTail: '' });

      const throwing = fakeSpawn();
      let calls = 0;
      const runner = createFallowRunner({
        spawn: (command, args, options) => { calls += 1; if (calls === 2) throw Object.assign(new Error('x'), { code: 'EACCES' }); return throwing.spawn(command, args, options); },
        env: WIN_ENV, platform: 'win32',
      });
      const second = createCancellationToken();
      const run = runner.run(REQUEST, second.token);
      second.cancel();
      expect(throwing.children[0]!.kills).toEqual([undefined]);
      throwing.children[0]!.exit(1);
      await expect(run).resolves.toEqual({ kind: 'cancelled', stderrTail: '' });
    });

    it('killAll tree-kills too, and settles at once without a timer', async () => {
      const s = setup('win32', WIN_ENV);
      const done = s.runner.run(REQUEST, s.token);
      s.runner.killAll();
      expect(s.spawned.calls[1]?.args).toEqual(['/PID', '4242', '/T', '/F']);
      await expect(done).resolves.toEqual({ kind: 'cancelled', stderrTail: '' });
      expect(vi.getTimerCount()).toBe(0);
      s.spawned.children[1]!.exit(0);
      expect(s.child().kills).toEqual([undefined]);
    });

    it('control: no usable SystemRoot means no taskkill, and the direct kill still happens at once', async () => {
      for (const systemRoot of [undefined, '', 'Windows', '\\Windows', 'C:\\Windows\\..\\Temp', 'C:\\Win/dows', '\\\\host\\share']) {
        const env: Record<string, string> = systemRoot === undefined ? { Path: 'C:\\bin' } : { Path: 'C:\\bin', SystemRoot: systemRoot };
        const s = setup('win32', env);
        const done = s.runner.run(REQUEST, s.token);
        s.cancel();
        vi.advanceTimersByTime(2_000);
        expect(s.child().kills, String(systemRoot)).toEqual([undefined, undefined]);
        expect(s.spawned.calls, String(systemRoot)).toHaveLength(1);
        s.child().exit(1);
        await expect(done).resolves.toEqual({ kind: 'cancelled', stderrTail: '' });
      }
    });

    it('SYSTEMROOT in any letter case is found (Windows environment names are case-insensitive)', () => {
      const s = setup('win32', { PATH: 'C:\\bin', SYSTEMROOT: 'D:\\WINNT\\' });
      void s.runner.run(REQUEST, s.token);
      s.cancel();
      expect(s.spawned.calls[1]?.command).toBe('D:\\WINNT\\System32\\taskkill.exe');
    });
  });

  it('a token cancelled before the call spawns nothing', async () => {
    const s = setup();
    s.cancel();
    await expect(s.runner.run(REQUEST, s.token)).resolves.toEqual({ kind: 'cancelled', stderrTail: '' });
    expect(s.spawned.calls).toEqual([]);
  });

  it('killAll sends SIGKILL at once, resolves without waiting for exit, and leaves no timer', async () => {
    const s = setup();
    const done = s.runner.run(REQUEST, s.token);
    s.runner.killAll();
    expect(s.kills).toEqual([[-4242, 'SIGKILL']]);
    await expect(done).resolves.toEqual({ kind: 'cancelled', stderrTail: '' });
    expect(vi.getTimerCount()).toBe(0);
    // Review fix 1: the killed child's late exit arms nothing after the run has settled.
    s.child().exit(null, 'SIGKILL');
    s.child().close(null, 'SIGKILL');
    expect(vi.getTimerCount()).toBe(0);
  });

  // Review fix 2 (controller ruling): a child that never exits after SIGKILL cannot hold a run
  // open forever; the run settles FALLOW_CLOSE_GRACE_MS after SIGKILL, 4 s after the stop.
  it('a timed-out child that never exits still settles 4 s after the stop, as timed-out, leaving no timer', async () => {
    const s = setup();
    const done = s.runner.run({ ...REQUEST, timeoutMs: 1_000 }, s.token);
    let settled = false;
    void done.then(() => { settled = true; });
    vi.advanceTimersByTime(1_000 + 2_000);
    expect(s.kills).toEqual([[-4242, 'SIGTERM'], [-4242, 'SIGKILL']]);
    vi.advanceTimersByTime(1_999);
    await Promise.resolve();
    expect(settled).toBe(false);
    vi.advanceTimersByTime(1);
    await expect(done).resolves.toEqual({ kind: 'timed-out', stderrTail: '' });
    expect([s.child().stdout.destroyed, s.child().stderr.destroyed]).toEqual([true, true]);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('a cancelled child that never exits still settles 4 s after the cancel, as cancelled, on POSIX and on Windows', async () => {
    for (const platform of ['linux', 'win32']) {
      const s = setup(platform);
      const done = s.runner.run(REQUEST, s.token);
      let settled = false;
      void done.then(() => { settled = true; });
      s.cancel();
      vi.advanceTimersByTime(3_999);
      await Promise.resolve();
      expect(settled, platform).toBe(false);
      vi.advanceTimersByTime(1);
      await expect(done, platform).resolves.toEqual({ kind: 'cancelled', stderrTail: '' });
      expect(vi.getTimerCount(), platform).toBe(0);
    }
  });

  it('a process group that is already gone does not throw', async () => {
    const spawned = fakeSpawn();
    const runner = createFallowRunner({ spawn: spawned.spawn, env: {}, platform: 'linux', killProcess: throwGone });
    const { token, cancel } = createCancellationToken();
    const done = runner.run(REQUEST, token);
    expect(() => { cancel(); }).not.toThrow();
    expect(spawned.children[0]!.kills).toEqual([]);
    spawned.children[0]!.exit(0);
    await expect(done).resolves.toEqual({ kind: 'cancelled', stderrTail: '' });
  });

  it('Polish A1: a group kill refused with EPERM signals the child itself, SIGTERM then SIGKILL', async () => {
    const spawned = fakeSpawn();
    const runner = createFallowRunner({ spawn: spawned.spawn, env: {}, platform: 'linux', killProcess: throwDenied });
    const { token, cancel } = createCancellationToken();
    const done = runner.run(REQUEST, token);
    cancel();
    expect(spawned.children[0]!.kills).toEqual(['SIGTERM']);
    vi.advanceTimersByTime(2_000);
    expect(spawned.children[0]!.kills).toEqual(['SIGTERM', 'SIGKILL']);
    spawned.children[0]!.exit(null, 'SIGKILL');
    await expect(done).resolves.toEqual({ kind: 'cancelled', stderrTail: '' });
  });

  it('Polish A1 (review fix 3): a child kill() that throws still escalates and settles at the final deadline, leaving no timer', async () => {
    for (const platform of ['linux', 'win32']) {
      const spawned = fakeSpawn();
      const runner = createFallowRunner({ spawn: spawned.spawn, env: {}, platform, killProcess: throwDenied });
      const { token, cancel } = createCancellationToken();
      const done = runner.run(REQUEST, token);
      spawned.children[0]!.kill = throwInvalid;
      expect(() => { cancel(); }, platform).not.toThrow();
      expect(() => { vi.advanceTimersByTime(2_000); }, platform).not.toThrow();
      vi.advanceTimersByTime(2_000);
      await expect(done, platform).resolves.toEqual({ kind: 'cancelled', stderrTail: '' });
      expect(vi.getTimerCount(), platform).toBe(0);
    }
  });

  it('Polish A2 (review fix 5): a pipe error after the run settled is swallowed, signals nothing and arms no timer', async () => {
    const s = setup();
    const done = s.runner.run(REQUEST, s.token);
    s.runner.killAll();
    await expect(done).resolves.toEqual({ kind: 'cancelled', stderrTail: '' });
    expect(() => { s.child().stdout.emitError('EPIPE'); s.child().stderr.emitError('ECONNRESET'); }).not.toThrow();
    expect(s.kills).toEqual([[-4242, 'SIGKILL']]);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('Polish A2: a stdout pipe error stops the child and ends output-incomplete, leaving no timer', async () => {
    const s = setup();
    const done = s.runner.run(REQUEST, s.token);
    s.child().stdout.emitError('EPIPE');
    expect(s.kills).toEqual([[-4242, 'SIGTERM']]);
    s.child().exit(null, 'SIGTERM');
    await expect(done).resolves.toEqual({ kind: 'output-incomplete', stderrTail: '' });
    expect(vi.getTimerCount()).toBe(0);
  });

  it('Polish A2: a stderr pipe error after exit ends output-incomplete at once and destroys both pipes', async () => {
    const s = setup();
    const done = s.runner.run(REQUEST, s.token);
    s.child().exit(0);
    s.child().stderr.emitError('ECONNRESET');
    await expect(done).resolves.toEqual({ kind: 'output-incomplete', stderrTail: '' });
    expect([s.child().stdout.destroyed, s.child().stderr.destroyed]).toEqual([true, true]);
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe('Polish A8: the runner\'s remaining edges (Z38)', () => {
  it('a stop after exit but before close settles at once, signals nothing and leaves no timer', async () => {
    const s = setup();
    const done = s.runner.run(REQUEST, s.token);
    s.child().exit(0);
    s.cancel();
    await expect(done).resolves.toEqual({ kind: 'cancelled', stderrTail: '' });
    expect(s.kills).toEqual([]);
    expect([s.child().stdout.destroyed, s.child().stderr.destroyed]).toEqual([true, true]);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('a normal close clears the time limit and the close grace', async () => {
    const s = setup();
    const done = s.runner.run(REQUEST, s.token);
    expect(vi.getTimerCount()).toBe(1);
    s.child().exit(0);
    expect(vi.getTimerCount()).toBe(2);
    s.child().close(0);
    await expect(done).resolves.toMatchObject({ kind: 'exited', exitCode: 0 });
    expect(vi.getTimerCount()).toBe(0);
  });

  it('EACCES and ENOENT before the start are both spawn-failed, each with its own code', async () => {
    for (const code of ['EACCES', 'ENOENT']) {
      const spawned = fakeSpawn(null);
      const runner = createFallowRunner({ spawn: spawned.spawn, env: {}, platform: 'linux' });
      const done = runner.run(REQUEST, createCancellationToken().token);
      spawned.children[0]!.emitError(code);
      await expect(done, code).resolves.toEqual({ kind: 'spawn-failed', errorCode: code });
    }
  });
});

describe('Polish A9: the real-process tests\' cleanup kill', () => {
  it('kills the POSIX group, then the child; on Windows the child only; a gone process is not an error', () => {
    const calls: [number, string][] = [];
    const record = (pid: number, signal: string): void => { calls.push([pid, signal]); };
    killTree(4242, 'linux', record);
    killTree(4242, 'win32', record);
    expect(calls).toEqual([[-4242, 'SIGKILL'], [4242, 'SIGKILL'], [4242, 'SIGKILL']]);
    expect(() => { killTree(4242, 'linux', throwGone); }).not.toThrow();
  });
});

describe('spawn failures (Z18)', () => {
  it('an error before the process started is spawn-failed with its code', async () => {
    const spawned = fakeSpawn(null);
    const runner = createFallowRunner({ spawn: spawned.spawn, env: {}, platform: 'linux' });
    const done = runner.run(REQUEST, createCancellationToken().token);
    spawned.children[0]!.emitError('ENOENT');
    await expect(done).resolves.toEqual({ kind: 'spawn-failed', errorCode: 'ENOENT' });
  });

  it('a synchronous throw is spawn-failed with its code', async () => {
    const runner = createFallowRunner({ spawn: throwInvalid, env: {}, platform: 'linux' });
    await expect(runner.run(REQUEST, createCancellationToken().token)).resolves.toEqual({ kind: 'spawn-failed', errorCode: 'EINVAL' });
  });

  it('without Node (not the desktop app) every run is spawn-failed UNAVAILABLE', async () => {
    await expect(createFallowRunner().run(REQUEST, createCancellationToken().token)).resolves.toEqual({ kind: 'spawn-failed', errorCode: 'UNAVAILABLE' });
  });
});
