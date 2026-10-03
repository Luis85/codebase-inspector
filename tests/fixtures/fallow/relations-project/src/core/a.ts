import { runB } from './b';

export function runA(depth: number): number {
  if (depth > 10) return depth;
  return runB(depth + 1);
}
