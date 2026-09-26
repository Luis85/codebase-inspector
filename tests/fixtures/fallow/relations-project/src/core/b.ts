import { runC } from './c';

export function runB(depth: number): number {
  if (depth > 10) return depth;
  return runC(depth + 1);
}
