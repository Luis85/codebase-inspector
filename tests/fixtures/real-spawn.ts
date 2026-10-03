// Part 7 Z38: node:child_process's own spawn, typed as the runner's structural SpawnLike, and
// a real kill for the runner's killProcess (PF4). Tests only: nothing under src/ may name
// child_process except node-process-access.ts.
import { spawn } from 'node:child_process';
import type { ChildProcessLike, SpawnLike } from '../../src/adapters/fallow/node-process-access';

export const realSpawn: SpawnLike = (command, args, options) =>
  spawn(command, [...args], options) as unknown as ChildProcessLike;

/** PF4: the runner's default kill is the Obsidian path (null outside the app), so every
 *  real-process test passes this one. A negative pid is a POSIX process group. */
export function realKill(pid: number, signal: string): void {
  process.kill(pid, signal);
}

/** Polish A9: the real-process tests' cleanup. On POSIX the child leads its own process group
 *  (spawned detached), so the group is killed — which reaches any grandchild, even after the
 *  child itself exited — and then the child. Every error means "already gone". */
export function killTree(pid: number, platform: string = process.platform, kill: (pid: number, signal: string) => void = realKill): void {
  if (platform !== 'win32') {
    try { kill(-pid, 'SIGKILL'); } catch { /* the group is already gone */ }
  }
  try { kill(pid, 'SIGKILL'); } catch { /* the child is already gone */ }
}
