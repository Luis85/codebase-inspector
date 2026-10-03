import { describe, expect, it } from 'vitest';
import {
  MAP_H, MAP_W, NODE_HALF_H, NODE_HALF_W, NODE_PAD, edgePath, nodePositions, toPercent, type NodePos,
} from '../../src/ui/screens/architecture/map-layout';

/** How far a point sits outside a node's box: > 0 outside, <= 0 inside. */
const outside = (c: NodePos, x: number, y: number): number => Math.max(Math.abs(x - c.x) - NODE_HALF_W, Math.abs(y - c.y) - NODE_HALF_H);
const ends = (d: string): number[] => d.replace(/[MQ]/g, '').split(/[ ,]/).map(Number);

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
  it('keeps every node box inside the canvas, for any module count (F5)', () => {
    for (let n = 2; n <= 12; n += 1) {
      for (const p of nodePositions(Array.from({ length: n }, (_, i) => `m${i}`))) {
        expect(p.y - NODE_HALF_H).toBeGreaterThan(0); expect(p.y + NODE_HALF_H).toBeLessThan(MAP_H);
        expect(p.x - NODE_HALF_W).toBeGreaterThan(0); expect(p.x + NODE_HALF_W).toBeLessThan(MAP_W);
      }
    }
  });
  it('ends every edge at the node box border, from any direction (F5)', () => {
    const c: NodePos = { name: 'c', x: 360, y: 210 };
    const others: NodePos[] = [
      { name: 'e', x: 600, y: 210 }, { name: 's', x: 360, y: 400 }, { name: 'w', x: 100, y: 230 },
      { name: 'n', x: 380, y: 20 }, { name: 'ne', x: 560, y: 60 }, { name: 'sw', x: 150, y: 380 },
    ];
    for (const o of others) {
      const [x1, y1, , , x2, y2] = ends(edgePath(c, o));
      for (const [node, x, y] of [[c, x1!, y1!], [o, x2!, y2!]] as const) {
        const gap = outside(node, x, y);
        expect(gap).toBeGreaterThan(0);
        expect(gap).toBeLessThanOrEqual(NODE_PAD + 0.1);
      }
    }
  });
  it('converts to percentages of the canvas', () => {
    expect(toPercent({ name: 'x', x: MAP_W / 2, y: MAP_H / 4 })).toEqual({ left: '50.00%', top: '25.00%' });
  });
});
