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
