export function sumB(values: number[]): number {
  let total = 0;
  for (const value of values) {
    if (value > 10) {
      total += value * 2;
    } else if (value > 5) {
      total += value + 1;
    } else {
      total += value;
    }
  }
  const scaled = total * 3;
  const offset = scaled - 7;
  const bounded = Math.max(0, Math.min(offset, 1000));
  return bounded;
}
