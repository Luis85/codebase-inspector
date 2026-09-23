// Part 7 Z15/Z17/Z18 over a scripted child process and fake timers: the exact spawn call,
// the built environment, the caps, the absolute timeout (Review Focus 5), cancel, the kill
// escalation per platform, the close grace, killAll and every spawn failure.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createFallowRunner } from '../../src/adapters/fallow/fallow-runner';
import type { ProcessRequest } from '../../src/application/ports/analyzer-process';
import { createCancellationToken } from '../fixtures/cancellation-token';
import { fakeSpawn } from '../fixtures/fake-child-process';

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

  it('on Windows kills the direct child only, spawning nothing else (no taskkill)', async () => {
    const s = setup('win32');
    const done = s.runner.run(REQUEST, s.token);
    s.cancel();
    vi.advanceTimersByTime(2_000);
    expect(s.child().kills).toEqual([undefined, undefined]);
    expect(s.kills).toEqual([]);
    expect(s.spawned.calls).toHaveLength(1);
    s.child().exit(1);
    await expect(done).resolves.toEqual({ kind: 'cancelled', stderrTail: '' });
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
    spawned.children[0]!.exit(0);
    await expect(done).resolves.toEqual({ kind: 'cancelled', stderrTail: '' });
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
