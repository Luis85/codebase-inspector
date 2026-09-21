// Part 2 §2.1: the dependency map's geometry. Pure, so it is unit-tested without a DOM.
// Nodes sit on an ellipse starting at 12 o'clock. The SVG draws only the edges; the nodes
// are HTML buttons positioned by percentage over the same box (aspect-ratio 720 / 420).
export const MAP_W = 720;
export const MAP_H = 420;
const RX = 280;
const RY = 160;
const NODE_GAP = 44;
const BEND = 18;

const f = (n: number): string => n.toFixed(1);

export interface NodePos { name: string; x: number; y: number }

export function nodePositions(names: readonly string[]): NodePos[] {
  if (names.length === 1) return [{ name: names[0]!, x: MAP_W / 2, y: MAP_H / 2 }];
  return names.map((name, i) => {
    const a = -Math.PI / 2 + (2 * Math.PI * i) / names.length;
    return { name, x: MAP_W / 2 + RX * Math.cos(a), y: MAP_H / 2 + RY * Math.sin(a) };
  });
}

/** A gently bent path from `a` to `b`, trimmed so the arrowhead stops short of the node.
 *  The bend is to the right of the direction of travel, so a→b and b→a never overlap. */
export function edgePath(a: NodePos, b: NodePos): string {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  const x1 = a.x + ux * NODE_GAP; const y1 = a.y + uy * NODE_GAP;
  const x2 = b.x - ux * NODE_GAP; const y2 = b.y - uy * NODE_GAP;
  const cx = (x1 + x2) / 2 - uy * BEND; const cy = (y1 + y2) / 2 + ux * BEND;
  return `M${f(x1)},${f(y1)} Q${f(cx)},${f(cy)} ${f(x2)},${f(y2)}`;
}

export function toPercent(p: NodePos): { left: string; top: string } {
  return { left: `${((p.x / MAP_W) * 100).toFixed(2)}%`, top: `${((p.y / MAP_H) * 100).toFixed(2)}%` };
}
