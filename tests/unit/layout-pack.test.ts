import { describe, expect, it } from 'vitest';
import { pack, type Footprint } from '../../src/domain/layout/pack';

// A mixed-size list in a deliberately non-sorted order: NFDH reorders internally (tallest first), and the
// contract is that `placed` still comes back in INPUT order, so districts.ts can map placed[i] to items[i].
const MIXED: readonly Footprint[] = [
  { key: 'a.ts', width: 10, footprintZ: 10 },
  { key: 'big', width: 40, footprintZ: 52 },
  { key: 'b.ts', width: 4, footprintZ: 4 },
  { key: 'mid', width: 22, footprintZ: 30 },
  { key: 'c.ts', width: 10, footprintZ: 10 },
  { key: 'd.ts', width: 10, footprintZ: 10 },
];

function overlaps(items: readonly Footprint[], placed: ReadonlyArray<{ x: number; z: number }>): boolean {
  for (let i = 0; i < items.length; i += 1) {
    for (let j = i + 1; j < items.length; j += 1) {
      const a = items[i]!, b = items[j]!, pa = placed[i]!, pb = placed[j]!;
      const apart = pa.x + a.width <= pb.x || pb.x + b.width <= pa.x
        || pa.z + a.footprintZ <= pb.z || pb.z + b.footprintZ <= pa.z;
      if (!apart) return true;
    }
  }
  return false;
}

describe('pack (NFDH, ruling E15)', () => {
  it('returns placed in INPUT order for a mixed-size list: placed[i] is items[i]', () => {
    const result = pack(MIXED);
    expect(result.placed).toHaveLength(MIXED.length);
    // The tallest item sits on the first shelf at the origin although it is the 2nd input item: a sorted-order
    // result would have put 'big' at placed[0] and 'a.ts' (10 x 10) at index 1.
    expect(result.placed[1]).toEqual({ x: 0, z: 0 });
    expect(overlaps(MIXED, result.placed)).toBe(false);
    for (let i = 0; i < MIXED.length; i += 1) {
      expect(result.placed[i]!.x + MIXED[i]!.width).toBeLessThanOrEqual(result.width);
      expect(result.placed[i]!.z + MIXED[i]!.footprintZ).toBeLessThanOrEqual(result.footprintZ);
    }
  });

  it('places each item identically whatever the input order (the key decides the order, not the index)', () => {
    const forward = pack(MIXED);
    const reversed = MIXED.map((_, i) => MIXED[MIXED.length - 1 - i]!);
    const backward = pack(reversed);
    expect(backward.width).toBe(forward.width);
    expect(backward.footprintZ).toBe(forward.footprintZ);
    for (let i = 0; i < MIXED.length; i += 1) {
      expect(backward.placed[MIXED.length - 1 - i]).toEqual(forward.placed[i]);
    }
  });

  it('breaks footprintZ ties by key, never by input position', () => {
    const squares: Footprint[] = ['z.ts', 'a.ts', 'm.ts'].map((key) => ({ key, width: 10, footprintZ: 10 }));
    const placed = pack(squares).placed;
    const byX = squares.map((s, i) => ({ key: s.key, p: placed[i]! })).sort((u, v) => u.p.z - v.p.z || u.p.x - v.p.x);
    expect(byX.map((e) => e.key)).toEqual(['a.ts', 'm.ts', 'z.ts']);
  });

  it('packs an empty list to nothing', () => {
    expect(pack([])).toEqual({ width: 0, footprintZ: 0, placed: [] });
  });
});
