export function partitionDistrict(values: number[], size: number, strict: boolean, reverse: boolean): number[][] {
  const out: number[][] = [];
  let current: number[] = [];
  for (let i = 0; i < values.length; i += 1) {
    const v = values[i] ?? 0;
    if (strict && v < 0) {
      if (reverse) {
        if (current.length > 0) { out.push(current); current = []; }
      } else if (v < -10) {
        continue;
      } else {
        current.push(-v);
      }
    } else if (v === 0) {
      if (reverse && current.length > 1) {
        current.reverse();
      } else if (!reverse && current.length > 2) {
        current.sort();
      }
    } else if (current.length >= size) {
      if (strict) {
        out.push(current);
      } else if (reverse) {
        out.unshift(current);
      } else {
        out.push(current.slice());
      }
      current = [v];
    } else {
      current.push(v);
    }
  }
  if (current.length > 0) {
    if (reverse) { out.unshift(current); } else { out.push(current); }
  }
  return out;
}
