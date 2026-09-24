// WP-03 Task 7: module grouping/capping (independent of relation evidence, "modules"
// below) plus the graph-shaping pieces built from real edges — a small hand-built
// RelationModel stub for the capping/omission case (no real fixture has 12+ modules), and
// the real relations recording for the matrix/neighbours/violatingEdgeKeys case. Fix round
// 1 #12 restores these pins, dropped when the old sample-edge tests were deleted; the
// relation-driven cards/rules/evidence-state tests stay in architecture-relations.test.ts.
import { describe, expect, it } from 'vitest';
import { buildSnapshotFixture } from '../fixtures/snapshot-builder';
import { createRelationIndex } from '../../src/domain/relations/graph';
import { unknown } from '../../src/ui/evidence';
import { fileSummariesFor } from '../../src/ui/read-models/file-summaries';
import { evidenceIndexFor } from '../../src/ui/read-models/evidence-index';
import { relationModelFor, type RelationModel } from '../../src/ui/read-models/relations';
import {
  MAX_GRAPH_MODULES, architectureGraphFor, buildArchitectureGraph, buildArchitectureModel, buildModules, cyclesValue,
  edgeKey, moduleNeighbours,
} from '../../src/ui/read-models/architecture';
import { buildEvidenceReport } from '../../src/application/evidence/normalize-fallow';
import { rawReport } from '../fixtures/fallow-fixture';
import { RELATIONS_PATHS, snapshotWithPaths } from '../fixtures/evidence-report';
import type { BoundaryRule } from '../../src/ui/stores/ports/review-repository';

function graphOf(files: number, directories: number) {
  const snap = buildSnapshotFixture({ files, directories });
  const fs = fileSummariesFor(snap);
  return buildArchitectureGraph(fs, relationModelFor(fs, evidenceIndexFor(fs, null, snap.snapshotId)));
}

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
  });
  it('has no edges without any relation evidence, never a fabricated sample graph', () => {
    const g = graphOf(40, 6);
    expect(g.edges).toEqual([]);
    expect(g.omittedEdges).toBe(0);
  });
  it('memoizes the graph per relation model', () => {
    const snap = buildSnapshotFixture({ files: 10, directories: 2 });
    const files = fileSummariesFor(snap);
    const relations = relationModelFor(files, evidenceIndexFor(files, null, snap.snapshotId));
    expect(architectureGraphFor(files, relations)).toBe(architectureGraphFor(files, relations));
  });
  it('cyclesValue is unknown without a report', () => {
    const snap = buildSnapshotFixture({ files: 0 });
    const fs = fileSummariesFor(snap);
    const relations = relationModelFor(fs, evidenceIndexFor(fs, null, snap.snapshotId));
    expect(cyclesValue(relations).state).toBe('unknown');
  });
});

/** A minimal hand-built RelationModel over given file-id edges, for the module-capping
 *  case: no real fixture has 12+ modules, and `buildArchitectureGraph` computes module
 *  names from the real `files` array regardless of the stub, so only `index` needs to be
 *  real (`createRelationIndex`) — the rest of the interface is unused by the code under
 *  test here (module aggregation and capping), never asserted on. */
function stubRelationModel(edges: readonly { from: string; to: string }[]): RelationModel {
  const index = createRelationIndex(edges);
  return {
    state: 'current', analysed: true, boundaries: 'configured', index,
    edges: index.edges.map((e) => ({ ...e, fromPath: e.from, toPath: e.to, sources: ['cycle'], line: null })),
    edge: () => undefined,
    cycles: [], boundaryViolations: [], unresolved: [], unmatchedEdges: 0,
    fanIn: () => unknown('stub'), fanOut: () => unknown('stub'),
  };
}

describe('fix round 1 #12: edges only between shown modules, omittedEdges', () => {
  it('keeps an edge between two shown modules, omits one shown->omitted and one omitted->omitted', () => {
    const snap = buildSnapshotFixture({ files: 45, directories: 15 });
    const files = fileSummariesFor(snap);
    const byModule = (m: string) => files.find((f) => f.module === m)!;
    // 15 modules tied at 3 files each, capped at 12 by NAME (localeCompare, not numeric):
    // dir-0, dir-1, dir-10..dir-14, dir-2..dir-6 are shown; dir-7, dir-8, dir-9 are omitted.
    const stub = stubRelationModel([
      { from: byModule('dir-0').id, to: byModule('dir-1').id },
      { from: byModule('dir-0').id, to: byModule('dir-7').id },
      { from: byModule('dir-8').id, to: byModule('dir-9').id },
    ]);
    const graph = buildArchitectureGraph(files, stub);
    expect(graph.edges).toHaveLength(1);
    expect(graph.edges[0]).toMatchObject({ from: 'dir-0', to: 'dir-1' });
    expect(graph.omittedEdges).toBe(2);
  });
});

const rule = (from: string, to: string): BoundaryRule => ({ id: 'AR-001', from, to, rationale: 'r', createdAt: '2026-09-24T10:00:00.000Z' });

describe('fix round 1 #12: matrix, neighbours and violatingEdgeKeys, over the real relations recording', () => {
  const snap = snapshotWithPaths(RELATIONS_PATHS, 'repo-arch-model-matrix');
  const files = fileSummariesFor(snap);
  const report = buildEvidenceReport({
    raw: rawReport('relations-combined-3.27.0'), fileName: 'relations.json', importedAt: '2026-09-24T10:00:00.000Z',
    snapshotId: snap.snapshotId, stripPrefix: 'src/',
  });
  const relations = relationModelFor(files, evidenceIndexFor(files, report, snap.snapshotId));
  const graph = architectureGraphFor(files, relations);
  const edge = graph.edges[0]!;

  it('lists neighbours by direction', () => {
    const n = moduleNeighbours(graph, edge.from);
    expect(n.outgoing).toContain(edge.to);
    expect(moduleNeighbours(graph, edge.to).incoming).toContain(edge.from);
  });

  it('has an n×n matrix whose cell links to the real edge', () => {
    const model = buildArchitectureModel(graph, []);
    const names = graph.modules.map((m) => m.name);
    expect(model.matrix).toHaveLength(names.length);
    expect(model.matrix[0]).toHaveLength(names.length);
    const cell = model.matrix[names.indexOf(edge.from)]?.[names.indexOf(edge.to)];
    expect(cell?.edge).toEqual(edge);
  });

  it('violatingEdgeKeys holds the (from, to) of every violated rule', () => {
    const model = buildArchitectureModel(graph, [rule(edge.from, edge.to)]);
    expect(model.violatingEdgeKeys.has(edgeKey(edge.from, edge.to))).toBe(true);
    expect(model.violatingEdgeKeys.size).toBe(1);
  });
});
