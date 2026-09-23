// Part 7 Z14: the ONLY place in the codebase that reaches Node's child_process, and the one
// file the process guard allows to name it (tests/unit/no-process-execution.test.ts). The
// same window.require route as node-access.ts, for the same reasons (a static import would
// trip no-nodejs-modules and be bundled). Its overloads and the minimal structural shapes
// live HERE rather than in node-globals.d.ts, so the guard's allow-list stays at two files.
// Nothing here calls spawn: fallow-runner.ts does, once.
import { Platform } from 'obsidian';

export interface ReadableLike {
  on(event: 'data', listener: (chunk: Uint8Array) => void): unknown;
  /** Polish A2: a pipe error; without a listener Node throws it as an uncaught exception. */
  on(event: 'error', listener: (error: Error) => void): unknown;
  destroy(): unknown;
}

export interface ChildProcessLike {
  readonly pid?: number | undefined;
  readonly stdout: ReadableLike | null;
  readonly stderr: ReadableLike | null;
  on(event: 'error', listener: (error: Error & { code?: string }) => void): unknown;
  on(event: 'exit' | 'close', listener: (code: number | null, signal: string | null) => void): unknown;
  kill(signal?: string): boolean;
}

/** Z15: exactly the options the runner passes; `shell` can only be `false`. */
export interface SpawnOptionsLike {
  cwd: string;
  env: Record<string, string>;
  shell: false;
  windowsHide: true;
  detached: boolean;
  stdio: ['ignore', 'pipe', 'pipe'];
}

export type SpawnLike = (command: string, args: readonly string[], options: SpawnOptionsLike) => ChildProcessLike;

export interface NodeProcessLike {
  env: Record<string, string | undefined>;
  platform: string;
  kill(pid: number, signal: string): void;
}

interface ChildProcessModuleLike { spawn: SpawnLike }

declare global {
  interface Window {
    require(id: 'node:child_process'): ChildProcessModuleLike;
    require(id: 'node:process'): NodeProcessLike;
  }
}

export const childProcess: ChildProcessModuleLike | null = Platform.isDesktopApp ? window.require('node:child_process') : null;
export const nodeProcess: NodeProcessLike | null = Platform.isDesktopApp ? window.require('node:process') : null;
