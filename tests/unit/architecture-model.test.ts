import { describe, expect, it } from 'vitest';
import { buildSnapshotFixture } from '../fixtures/snapshot-builder';
import { stronglyConnected } from '../../src/domain/relations/queries';
import { fileSummariesFor } from '../../src/ui/read-models/file-summaries';
import { sampleModuleEdges } from '../../src/ui/fixtures/sample-module-edges';
import {
  MAX_GRAPH_MODULES, architectureGraphFor, buildArchitectureGraph, buildArchitectureModel, buildModules,
  cyclesValue, evaluateRules, moduleNeighbours,
} from '../../src/ui/read-models/architecture';
import type { BoundaryRule } from '../../src/ui/stores/ports/review-repository';

const rule = (from: string, to: string, id = 'AR-001'): BoundaryRule => ({ id, from, to, rationale: 'r', createdAt: '2026-09-21T00:00:00.000Z' });
const graphOf = (files: number, directories: number) => buildArchitectureGraph(fileSummariesFor(buildSnapshotFixture({ files, directories })));
const edgeOf = (from: string, to: string) => ({ from, to });
// Non-mutating reversal that never calls `Array#reverse()` (oxlint's unicorn/no-array-reverse
// fires on `.reverse()` regardless of receiver), matching tests/unit/layout-determinism.test.ts.
const toReversedArray = <T,>(arr: readonly T[]): T[] => arr.map((_, i) => arr[arr.length - 1 - i]!);

describe('sample module edges (P3)', () => {
  const names = ['app', 'domain', 'storage', 'ui', 'shared'];
  it('is deterministic and never has self-edges or foreign modules', () => {
    const edges = sampleModuleEdges(names);
    expect(sampleModuleEdges(toReversedArray(names))).toEqual(edges);
    expect(edges.length).toBeGreaterThan(0);
    for (const e of edges) {
      expect(e.from).not.toBe(e.to);
      expect(names).toContain(e.from);
      expect(names).toContain(e.to);
      expect(e.imports).toBeGreaterThanOrEqual(1);
    }
  });
  it('keeps an existing pair\'s edge when another module is added', () => {
    const before = sampleModuleEdges(names);
    const after = sampleModuleEdges([...names, 'zeta']);
    for (const e of before) expect(after).toContainEqual(e);
  });
});

describe('cyclic components (P6)', () => {
  it('finds two- and three-module cycles and ignores acyclic parts', () => {
    expect(stronglyConnected(['a', 'b', 'c'], [edgeOf('a', 'b'), edgeOf('b', 'a'), edgeOf('b', 'c')])).toEqual([['a', 'b']]);
    expect(stronglyConnected(['a', 'b', 'c'], [edgeOf('a', 'b'), edgeOf('b', 'c'), edgeOf('c', 'a')])).toEqual([['a', 'b', 'c']]);
    expect(stronglyConnected(['a', 'b', 'c'], [edgeOf('a', 'b'), edgeOf('b', 'c')])).toEqual([]);
  });
});

describe('modules', () => {
  it('groups by top-level directory, largest first, and labels the root', () => {
    const snap = buildSnapshotFixture({ files: 7, directories: 2 });
    const mods = buildModules(fileSummariesFor(snap));
    expect(mods.map((m) => [m.name, m.fileCount])).toEqual([['dir-0', 4], ['dir-1', 3]]);
    expect(mods[0]?.lines.state).toBe('collected');
    const root = buildModules(fileSummariesFor(buildSnapshotFixture({ files: 2 })));
    expect(root[0]?.label).toBe('Root files');
  });
  it('makes module lines partial when one file\'s lines are unknown', () => {
    const snap = buildSnapshotFixture({ files: 4, directories: 1, unavailable: 1 });
    expect(buildModules(fileSummariesFor(snap))[0]?.lines.state).toBe('partial');
  });
  it('caps the graph at the 12 largest modules and counts the rest (P2)', () => {
    const g = graphOf(45, 15);
    expect(g.modules).toHaveLength(MAX_GRAPH_MODULES);
    expect(g.omittedModules).toBe(3);
    for (const e of g.edges) expect(g.modules.map((m) => m.name)).toContain(e.to);
  });
  it('labels every edge as a sample source-import edge (P4)', () => {
    for (const e of graphOf(40, 6).edges) {
      expect(e.meaning).toBe('source-import');
      expect(e.imports.state).toBe('sample');
    }
  });
  it('memoizes the graph per files array', () => {
    const files = fileSummariesFor(buildSnapshotFixture({ files: 10, directories: 2 }));
    expect(architectureGraphFor(files)).toBe(architectureGraphFor(files));
  });
});

describe('rules and model', () => {
  const g = graphOf(60, 6);
  const edge = g.edges[0]!;
  const names = g.modules.map((m) => m.name);
  const free = names.flatMap((a) => names.map((b) => [a, b] as const))
    .find(([a, b]) => a !== b && !g.edges.some((e) => e.from === a && e.to === b))!;

  it('evaluates violation, passing and not-evaluated', () => {
    const [v, p, n] = evaluateRules([rule(edge.from, edge.to), rule(free[0], free[1], 'AR-002'), rule('nope', edge.to, 'AR-003')], g);
    expect(v).toMatchObject({ status: 'violation', violatingImports: { state: 'sample', value: edge.imports.value } });
    expect(p).toMatchObject({ status: 'passing', violatingImports: { state: 'sample', value: 0 } });
    expect(n?.status).toBe('not-evaluated');
    expect(n?.violatingImports.state).toBe('unknown');
  });
  it('reports violations as unknown until a rule exists, then as sample', () => {
    const none = buildArchitectureModel(g, []);
    expect(none.cards.find((c) => c.id === 'violations')?.value.state).toBe('unknown');
    const one = buildArchitectureModel(g, [rule(edge.from, edge.to)]);
    expect(one.cards.find((c) => c.id === 'violations')?.value).toMatchObject({ state: 'sample', value: edge.imports.value });
    expect(one.violatingEdgeKeys.has(`${edge.from}->${edge.to}`)).toBe(true);
  });
  it('has collected modules, sample edges and cycles, and an n×n matrix', () => {
    const m = buildArchitectureModel(g, []);
    expect(m.cards.map((c) => [c.id, c.value.state])).toEqual([['modules', 'collected'], ['edges', 'sample'], ['cycles', 'sample'], ['violations', 'unknown']]);
    expect(m.matrix).toHaveLength(names.length);
    expect(m.matrix[0]).toHaveLength(names.length);
    const cell = m.matrix[names.indexOf(edge.from)]?.[names.indexOf(edge.to)];
    expect(cell?.edge).toEqual(edge);
    expect(m.usesSample).toBe(true);
  });
  it('lists neighbours by direction', () => {
    const n = moduleNeighbours(g, edge.from);
    expect(n.outgoing).toContain(edge.to);
    expect(moduleNeighbours(g, edge.to).incoming).toContain(edge.from);
  });
  it('cycles are unknown for an empty scan', () => {
    expect(cyclesValue(graphOf(0, 0)).state).toBe('unknown');
    expect(cyclesValue(g).state).toBe('sample');
  });
});
