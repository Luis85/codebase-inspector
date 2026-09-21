import { describe, expect, it } from 'vitest';
import { MAP_H, MAP_W, edgePath, nodePositions, toPercent } from '../../src/ui/screens/architecture/map-layout';

describe('module map layout', () => {
  it('places nodes deterministically inside the canvas, the first at the top', () => {
    const ps = nodePositions(['a', 'b', 'c', 'd']);
    expect(nodePositions(['a', 'b', 'c', 'd'])).toEqual(ps);
    expect(ps[0]!.y).toBeLessThan(MAP_H / 2);
    for (const p of ps) {
      expect(p.x).toBeGreaterThan(0); expect(p.x).toBeLessThan(MAP_W);
      expect(p.y).toBeGreaterThan(0); expect(p.y).toBeLessThan(MAP_H);
    }
  });
  it('centres a single node', () => {
    expect(nodePositions(['only'])).toEqual([{ name: 'only', x: MAP_W / 2, y: MAP_H / 2 }]);
  });
  it('bends opposite edges to opposite sides', () => {
    const [a, b] = nodePositions(['a', 'b']);
    expect(edgePath(a!, b!)).not.toEqual(edgePath(b!, a!));
    expect(edgePath(a!, b!)).toMatch(/^M[\d.-]+,[\d.-]+ Q[\d.-]+,[\d.-]+ [\d.-]+,[\d.-]+$/);
  });
  it('converts to percentages of the canvas', () => {
    expect(toPercent({ name: 'x', x: MAP_W / 2, y: MAP_H / 4 })).toEqual({ left: '50.00%', top: '25.00%' });
  });
});
