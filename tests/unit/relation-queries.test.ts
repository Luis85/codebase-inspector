import { describe, expect, it } from 'vitest';
import { createRelationIndex } from '../../src/domain/relations/graph';
import { aggregateEdges, neighbourhood, stronglyConnected } from '../../src/domain/relations/queries';

// a→b, b→c, c→a (a cycle); d→a; a→e; e→f; g isolated; a→b duplicated; h→h self-loop.
const E = [
  { from: 'a', to: 'b' }, { from: 'b', to: 'c' }, { from: 'c', to: 'a' }, { from: 'd', to: 'a' },
  { from: 'a', to: 'e' }, { from: 'e', to: 'f' }, { from: 'a', to: 'b' }, { from: 'h', to: 'h' },
];
const index = createRelationIndex(E);

describe('createRelationIndex (N16)', () => {
  it('merges duplicate pairs and drops self-loops', () => {
    expect(index.edges).toHaveLength(6);
    expect(index.edges.some((e) => e.from === 'h')).toBe(false);
  });
  it('sorts adjacency by id', () => {
    expect(index.outgoing.get('a')).toEqual(['b', 'e']);
    expect(index.incoming.get('a')).toEqual(['c', 'd']);
  });
});

describe('neighbourhood (N17)', () => {
  it('out, 1 hop', () => {
    expect(neighbourhood(index, 'a', { direction: 'out', hops: 1, limit: 10 }).edges)
      .toEqual([{ from: 'a', to: 'b', hop: 1, direction: 'out' }, { from: 'a', to: 'e', hop: 1, direction: 'out' }]);
  });
  it('in, 1 hop', () => {
    expect(neighbourhood(index, 'a', { direction: 'in', hops: 1, limit: 10 }).edges.map((e) => e.from)).toEqual(['c', 'd']);
  });
  it('both orders hop, then out before in, then the other end', () => {
    const got = neighbourhood(index, 'a', { direction: 'both', hops: 1, limit: 10 }).edges;
    expect(got.map((e) => `${e.direction}:${e.from}>${e.to}`)).toEqual(['out:a>b', 'out:a>e', 'in:c>a', 'in:d>a']);
  });
  it('2 hops continues in the same direction and never back through the node', () => {
    const got = neighbourhood(index, 'a', { direction: 'out', hops: 2, limit: 10 }).edges;
    expect(got.map((e) => `${e.hop}:${e.from}>${e.to}`)).toEqual(['1:a>b', '1:a>e', '2:b>c', '2:e>f']);
    // c→a is NOT hop 2 of 'out': it goes back through a.
  });
  it('limit keeps the first n and counts the rest as hidden', () => {
    const got = neighbourhood(index, 'a', { direction: 'both', hops: 2, limit: 3 });
    expect(got.edges).toHaveLength(3);
    expect(got.hidden).toBe(neighbourhood(index, 'a', { direction: 'both', hops: 2, limit: 100 }).edges.length - 3);
  });
  it('an edge reached both ways appears once, at its lowest hop', () => {
    const cyc = createRelationIndex([{ from: 'x', to: 'y' }, { from: 'y', to: 'x' }, { from: 'y', to: 'z' }]);
    const got = neighbourhood(cyc, 'x', { direction: 'both', hops: 2, limit: 10 }).edges;
    expect(got.filter((e) => e.from === 'y' && e.to === 'x')).toHaveLength(1);
  });
  it('a disconnected node has an empty neighbourhood', () => {
    expect(neighbourhood(index, 'g', { direction: 'both', hops: 2, limit: 10 })).toEqual({ edges: [], hidden: 0 });
  });

  // JF12: the two tests above ("reached both ways", "2 hops") pass even with the seen-dedupe
  // or the far!==node guard removed. These two pin each mechanism precisely.
  it('JF12: both-direction 2-hop dedupes an edge reached from both sides, keeping it at its lower hop', () => {
    const got = neighbourhood(index, 'a', { direction: 'both', hops: 2, limit: 10 }).edges;
    expect(got.map((e) => `${e.hop}:${e.direction}:${e.from}>${e.to}`)).toEqual([
      '1:out:a>b', '1:out:a>e', '1:in:c>a', '1:in:d>a', '2:out:b>c', '2:out:e>f',
    ]);
  });
  it('JF12: an "out" 2-hop walk never steps back through the origin node', () => {
    const idx = createRelationIndex([{ from: 'x', to: 'y' }, { from: 'y', to: 'x' }]);
    const got = neighbourhood(idx, 'x', { direction: 'out', hops: 2, limit: 10 }).edges;
    expect(got.map((e) => `${e.from}>${e.to}`)).toEqual(['x>y']);
  });
});

describe('stronglyConnected (N18)', () => {
  it('keeps groups of more than one node; overlapping cycles form one group', () => {
    const edges = [...E, { from: 'c', to: 'b' }];
    expect(stronglyConnected(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'], edges)).toEqual([['a', 'b', 'c']]);
  });
});

// oxlint's consistent-function-scoping: captures nothing, so it lives at module scope.
const aggregateGroup = (n: string): string => (n === 'a' || n === 'b' ? 'G1' : 'G2');

describe('aggregateEdges (N19)', () => {
  it('counts distinct file edges between different groups', () => {
    expect(aggregateEdges(index.edges, aggregateGroup)).toEqual([
      { from: 'G1', to: 'G2', count: 2 },   // b→c, a→e
      { from: 'G2', to: 'G1', count: 2 },   // c→a, d→a
    ]);
  });
});
