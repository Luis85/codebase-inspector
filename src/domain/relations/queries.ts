// WP-03 N16-N19: pure queries over a RelationIndex (graph.ts). No fallow words, no UI.
import type { DirectedEdge, RelationIndex } from './graph';

const byId = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

export type RelationDirection = 'in' | 'out' | 'both';
export interface NeighbourEdge { readonly from: string; readonly to: string; readonly hop: 1 | 2; readonly direction: 'in' | 'out' }
export interface Neighbourhood { readonly edges: readonly NeighbourEdge[]; readonly hidden: number }

type Side = 'in' | 'out';
const SIDES: Readonly<Record<RelationDirection, readonly Side[]>> = { out: ['out'], in: ['in'], both: ['out', 'in'] };
const pairKey = (from: string, to: string): string => JSON.stringify([from, to]);

// N17: breadth-first from `node`. Hop 1 is the direct edges in the chosen direction(s); hop 2
// continues in the same direction from each hop-1 neighbour, never back through `node`. Order:
// hop, then direction (out first), then the other end's id. An edge reached both ways (e.g. as
// hop 2 of 'out' and hop 2 of 'in') appears once, at its lowest hop — the `seen` dedupe below.
export function neighbourhood(index: RelationIndex, node: string, opts: { direction: RelationDirection; hops: 1 | 2; limit: number }): Neighbourhood {
  const sides = SIDES[opts.direction];
  const seen = new Set<string>();
  const found: NeighbourEdge[] = [];
  const push = (from: string, to: string, hop: 1 | 2, direction: Side): void => {
    const key = pairKey(from, to);
    if (seen.has(key)) return;
    seen.add(key);
    found.push({ from, to, hop, direction });
  };
  const next = (side: Side, n: string): readonly string[] => (side === 'out' ? index.outgoing : index.incoming).get(n) ?? [];
  for (const side of sides) {
    for (const other of next(side, node)) push(side === 'out' ? node : other, side === 'out' ? other : node, 1, side);
  }
  if (opts.hops === 2) {
    for (const side of sides) {
      const layer: { near: string; far: string }[] = [];
      for (const near of next(side, node)) {
        for (const far of next(side, near)) {
          if (far !== node) layer.push({ near, far });
        }
      }
      layer.sort((a, b) => byId(a.far, b.far) || byId(a.near, b.near));
      for (const { near, far } of layer) push(side === 'out' ? near : far, side === 'out' ? far : near, 2, side);
    }
  }
  return { edges: found.slice(0, opts.limit), hidden: Math.max(0, found.length - opts.limit) };
}

/** Tarjan's strongly connected components, keeping only those with MORE than one node.
 *  Members and groups are in id order (byId, never localeCompare — J3). Moved from
 *  src/ui/read-models/architecture.ts's `cyclicComponents` (N16), same algorithm. */
export function stronglyConnected(nodes: readonly string[], edges: readonly DirectedEdge[]): string[][] {
  const adjacency = new Map(nodes.map((n) => [n, [] as string[]]));
  for (const e of edges) adjacency.get(e.from)?.push(e.to);
  let counter = 0;
  const index = new Map<string, number>();
  const low = new Map<string, number>();
  const stack: string[] = [];
  const onStack = new Set<string>();
  const out: string[][] = [];
  const visit = (v: string): void => {
    index.set(v, counter); low.set(v, counter); counter += 1;
    stack.push(v); onStack.add(v);
    for (const w of adjacency.get(v) ?? []) {
      if (!adjacency.has(w)) continue;
      if (!index.has(w)) { visit(w); low.set(v, Math.min(low.get(v)!, low.get(w)!)); }
      else if (onStack.has(w)) low.set(v, Math.min(low.get(v)!, index.get(w)!));
    }
    if (low.get(v) !== index.get(v)) return;
    const component: string[] = [];
    for (;;) {
      const w = stack.pop();
      if (w === undefined) break;
      onStack.delete(w);
      component.push(w);
      if (w === v) break;
    }
    if (component.length > 1) out.push(component.sort(byId));
  };
  for (const n of nodes) if (!index.has(n)) visit(n);
  return out.sort((a, b) => byId(a[0] ?? '', b[0] ?? ''));
}

// N19: distinct groupOf(from) !== groupOf(to) pairs; count is the number of distinct file
// edges collapsing into each group pair. Sorted by from, then to (byId).
export function aggregateEdges(edges: readonly DirectedEdge[], groupOf: (node: string) => string): { from: string; to: string; count: number }[] {
  const counts = new Map<string, { from: string; to: string; count: number }>();
  for (const { from, to } of edges) {
    const groupFrom = groupOf(from);
    const groupTo = groupOf(to);
    if (groupFrom === groupTo) continue;
    const key = pairKey(groupFrom, groupTo);
    const existing = counts.get(key);
    if (existing) existing.count += 1;
    else counts.set(key, { from: groupFrom, to: groupTo, count: 1 });
  }
  return Array.from(counts.values()).sort((a, b) => byId(a.from, b.from) || byId(a.to, b.to));
}
