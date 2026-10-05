import { runA } from './a';

export function runC(depth: number): number {
  if (depth > 10) return depth;
  return runA(depth + 1);
}
