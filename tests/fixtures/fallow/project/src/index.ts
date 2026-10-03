import { formatLabel } from './text/format';
import { partitionDistrict } from './layout/partition';
import { sumA } from './text/sum-a';
import { sumB } from './text/sum-b';

export function main(input: number[]): string {
  const parts = partitionDistrict(input, 3, true, false);
  return formatLabel(String(parts.length + sumA(input) + sumB(input)));
}
