// WP-03 Task 7: module grouping and capping, independent of any relation evidence — the
// relation-driven cards, rules and cycle numbers move to architecture-relations.test.ts,
// which uses the real fallow relations recordings instead of the deleted sample edges.
import { describe, expect, it } from 'vitest';
import { buildSnapshotFixture } from '../fixtures/snapshot-builder';
import { fileSummariesFor } from '../../src/ui/read-models/file-summaries';
import { evidenceIndexFor } from '../../src/ui/read-models/evidence-index';
import { relationModelFor } from '../../src/ui/read-models/relations';
import { MAX_GRAPH_MODULES, architectureGraphFor, buildArchitectureGraph, buildModules } from '../../src/ui/read-models/architecture';

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
});
