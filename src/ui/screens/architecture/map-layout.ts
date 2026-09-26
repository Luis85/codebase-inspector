// Part 2 §2.1: the dependency map's geometry. Pure, so it is unit-tested without a DOM.
// Nodes sit on an ellipse starting at 12 o'clock. The SVG draws only the edges; the nodes
// are HTML buttons positioned by percentage over the same box (aspect-ratio 720 / 420).
export const MAP_W = 720;
export const MAP_H = 420;
const RX = 280;
/** F5: leaves room above and below for a node's box, so none touches the canvas edge. */
const RY = 140;
/** F5: a node button's half-size in viewBox units (about 7.5em × two lines at the 720-wide
 *  canvas, with room for a longer label). Edges are trimmed to this box, not a circle. */
export const NODE_HALF_W = 60;
export const NODE_HALF_H = 26;
/** Clear space between an arrowhead's tip and the node's border. */
export const NODE_PAD = 3;
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

/** Distance from a node's centre to its box edge along the unit direction (ux, uy),
 *  plus the pad. */
function toBoxEdge(ux: number, uy: number): number {
  const tx = Math.abs(ux) > 1e-9 ? NODE_HALF_W / Math.abs(ux) : Infinity;
  const ty = Math.abs(uy) > 1e-9 ? NODE_HALF_H / Math.abs(uy) : Infinity;
  return Math.min(tx, ty) + NODE_PAD;
}

function unit(dx: number, dy: number): { ux: number; uy: number } {
  const len = Math.hypot(dx, dy) || 1;
  return { ux: dx / len, uy: dy / len };
}

/** A gently bent path from `a` to `b`. The bend is to the right of the direction of
 *  travel, so a→b and b→a never overlap. Each end is trimmed to its node's box along the
 *  curve's own tangent there, so the arrowhead stops at the node's border from any side. */
export function edgePath(a: NodePos, b: NodePos): string {
  const d = unit(b.x - a.x, b.y - a.y);
  const cx = (a.x + b.x) / 2 - d.uy * BEND;
  const cy = (a.y + b.y) / 2 + d.ux * BEND;
  const s = unit(cx - a.x, cy - a.y);
  const e = unit(b.x - cx, b.y - cy);
  const ts = toBoxEdge(s.ux, s.uy);
  const te = toBoxEdge(e.ux, e.uy);
  const x1 = a.x + s.ux * ts; const y1 = a.y + s.uy * ts;
  const x2 = b.x - e.ux * te; const y2 = b.y - e.uy * te;
  return `M${f(x1)},${f(y1)} Q${f(cx)},${f(cy)} ${f(x2)},${f(y2)}`;
}

export function toPercent(p: NodePos): { left: string; top: string } {
  return { left: `${((p.x / MAP_W) * 100).toFixed(2)}%`, top: `${((p.y / MAP_H) * 100).toFixed(2)}%` };
}
