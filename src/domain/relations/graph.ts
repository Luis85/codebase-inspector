// WP-03 N16: a directed graph over string node ids, built once and queried many times.
// Pure and provider-neutral: no fallow words, no UI. Duplicate (from, to) pairs merge and
// self-loops are dropped, so every query sees each directed pair once.
export interface DirectedEdge { readonly from: string; readonly to: string }

export interface RelationIndex {
  readonly edges: readonly DirectedEdge[];
  readonly outgoing: ReadonlyMap<string, readonly string[]>;
  readonly incoming: ReadonlyMap<string, readonly string[]>;
}

function add(map: Map<string, string[]>, key: string, value: string): void {
  const list = map.get(key);
  if (list) list.push(value); else map.set(key, [value]);
}

const byId = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

export function createRelationIndex(edges: readonly DirectedEdge[]): RelationIndex {
  const seen = new Map<string, Set<string>>();
  const distinct: DirectedEdge[] = [];
  const outgoing = new Map<string, string[]>();
  const incoming = new Map<string, string[]>();
  for (const { from, to } of edges) {
    if (from === to) continue;
    let targets = seen.get(from);
    if (!targets) { targets = new Set(); seen.set(from, targets); }
    if (targets.has(to)) continue;
    targets.add(to);
    distinct.push({ from, to });
    add(outgoing, from, to);
    add(incoming, to, from);
  }
  for (const list of outgoing.values()) list.sort(byId);
  for (const list of incoming.values()) list.sort(byId);
  return { edges: distinct, outgoing, incoming };
}
