// Part 7 Z38: a scriptable child process for the runner's unit tests. A test drives the
// streams and the exit/close/error events by hand, and reads back every kill() call.
import type { ChildProcessLike, ReadableLike, SpawnLike, SpawnOptionsLike } from '../../src/adapters/fallow/node-process-access';

export class FakeStream implements ReadableLike {
  destroyed = false;
  private readonly listeners: ((chunk: Uint8Array) => void)[] = [];

  on(_event: 'data', listener: (chunk: Uint8Array) => void): this {
    this.listeners.push(listener);
    return this;
  }

  destroy(): this {
    this.destroyed = true;
    return this;
  }

  emit(chunk: Uint8Array | string): void {
    const bytes = typeof chunk === 'string' ? new TextEncoder().encode(chunk) : chunk;
    for (const listener of this.listeners) listener(bytes);
  }
}

type Listener = (...args: never[]) => void;

export class FakeChildProcess implements ChildProcessLike {
  readonly stdout = new FakeStream();
  readonly stderr = new FakeStream();
  readonly kills: (string | undefined)[] = [];
  readonly pid: number | undefined;
  private readonly handlers: Record<'error' | 'exit' | 'close', Listener[]> = { error: [], exit: [], close: [] };

  /** `null`: a process that never started (no pid), as after a failed spawn. */
  constructor(pid: number | null = 4242) {
    this.pid = pid ?? undefined;
  }

  on(event: 'error' | 'exit' | 'close', listener: Listener): this {
    this.handlers[event].push(listener);
    return this;
  }

  kill(signal?: string): boolean {
    this.kills.push(signal);
    return true;
  }

  emitError(code: string): void {
    for (const l of this.handlers.error) (l as (e: Error & { code?: string }) => void)(Object.assign(new Error(code), { code }));
  }

  exit(code: number | null, signal: string | null = null): void {
    for (const l of this.handlers.exit) (l as (c: number | null, s: string | null) => void)(code, signal);
  }

  close(code: number | null, signal: string | null = null): void {
    for (const l of this.handlers.close) (l as (c: number | null, s: string | null) => void)(code, signal);
  }
}

export interface SpawnCall { command: string; args: readonly string[]; options: SpawnOptionsLike }

/** `pid` null: every child never started (an explicit `undefined` would take the default). */
export function fakeSpawn(pid: number | null = 4242): { spawn: SpawnLike; calls: SpawnCall[]; children: FakeChildProcess[] } {
  const calls: SpawnCall[] = [];
  const children: FakeChildProcess[] = [];
  const spawn: SpawnLike = (command, args, options) => {
    calls.push({ command, args, options });
    const child = new FakeChildProcess(pid);
    children.push(child);
    return child;
  };
  return { spawn, calls, children };
}
