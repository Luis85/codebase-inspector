// Part 2 P3/P4: SAMPLE module import edges. No import graph is collected yet, so the
// Architecture screen draws these, labelled "sample edges, not observed imports". Each
// module gets a seeded "layer"; an edge down the layers is likely and one back up is rare,
// which gives a plausible graph with the occasional cycle. Every decision is seeded from
// the pair's own names, so adding a module never changes an existing pair's edge.
import { fnv1a, mulberry32 } from './seeded-random';

export interface SampleModuleEdge { from: string; to: string; imports: number }

const DOWN_LAYERS = 0.45;
const UP_LAYERS = 0.08;
const MAX_IMPORTS = 40;

const layer = (name: string): number => fnv1a(`layer:${name}`);

export function sampleModuleEdges(modules: readonly string[]): SampleModuleEdge[] {
  const ordered = [...new Set(modules)].sort((a, b) => layer(a) - layer(b) || a.localeCompare(b));
  const edges: SampleModuleEdge[] = [];
  ordered.forEach((from, i) => {
    ordered.forEach((to, j) => {
      if (i === j) return;
      const r = mulberry32(fnv1a(`edge:${from}->${to}`));
      if (r() < (i < j ? DOWN_LAYERS : UP_LAYERS)) edges.push({ from, to, imports: 1 + Math.floor(r() * MAX_IMPORTS) });
    });
  });
  return edges.sort((a, b) => a.from.localeCompare(b.from) || a.to.localeCompare(b.to));
}
