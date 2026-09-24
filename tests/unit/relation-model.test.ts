// WP-03 N5-N8, N25: the relation read model — fallow's path-level relation evidence
// (Task 4) resolved to snapshot EntityIds, matched edges (Task 2's createRelationIndex),
// cycles and fan-in/out — over the real relations recordings
// (tests/fixtures/fallow/README.md, "Relations project").
import { describe, expect, it } from 'vitest';
import { buildEvidenceReport } from '../../src/application/evidence/normalize-fallow';
import type { EvidenceReport } from '../../src/application/evidence/model';
import { evidenceIndexFor } from '../../src/ui/read-models/evidence-index';
import { fileSummariesFor, type FileSummary } from '../../src/ui/read-models/file-summaries';
import { cyclePathText, relationModelFor, relationValue } from '../../src/ui/read-models/relations';
import { FALLOW_NOT_ANALYSED, RELATION_FAN_NOT_SCORED } from '../../src/ui/inspector-copy';
import { fallowDoc, rawReport } from '../fixtures/fallow-fixture';
import { snapshotWithPaths } from '../fixtures/evidence-report';

const RELATIONS_PATHS = [
  'src/core/a.ts', 'src/core/b.ts', 'src/core/c.ts',
  'src/barrel/index.ts', 'src/barrel/x.ts', 'src/barrel/y.ts',
  'src/ui/view.ts', 'src/data/db.ts', 'src/data/types.ts',
  'src/index.ts', 'src/orphan.ts',
];
const IMPORTED_AT = '2026-09-24T10:00:00.000Z';

function reportFor(fixture: Parameters<typeof rawReport>[0], snapshotId: string): EvidenceReport {
  return buildEvidenceReport({ raw: rawReport(fixture), fileName: 'relations.json', importedAt: IMPORTED_AT, snapshotId, stripPrefix: null });
}

const snapshot = snapshotWithPaths(RELATIONS_PATHS, 'repo-relations');
const files = fileSummariesFor(snapshot);
const at = (path: string): FileSummary => files.find((f) => f.path === path)!;

const report = reportFor('relations-combined-3.27.0', snapshot.snapshotId);
const evidence = evidenceIndexFor(files, report, snapshot.snapshotId);
const model = relationModelFor(files, evidence);

const coreCycle = model.cycles.find((c) => c.kind === 'import' && c.members.length === 3)!;
const reExportCycle = model.cycles.find((c) => c.kind === 're-export')!;

describe('edges (N5, N7)', () => {
  it('holds the three matched core hops, the two barrel hops and the violation, each with its sources and line', () => {
    expect(model.edges).toHaveLength(6);
    expect(model.edges.every((e) => e.sources.length === 1)).toBe(true);
    expect(model.edge(at('src/ui/view.ts').id, at('src/data/db.ts').id)).toMatchObject({ sources: ['boundary'], line: 3 });
    expect(model.edge(at('src/core/a.ts').id, at('src/core/b.ts').id)).toMatchObject({ sources: ['cycle'], line: 1 });
    expect(model.unmatchedEdges).toBe(0);
  });

  it('one pair, two sources: a boundary violation over an existing cycle hop merges into one edge (Review Focus 2)', () => {
    const doc = fallowDoc('relations-combined-3.27.0', (d) => {
      const bv = (d.check! as unknown as { boundary_violations: Record<string, unknown>[] }).boundary_violations;
      bv.push({ from_path: 'src/core/a.ts', to_path: 'src/core/b.ts', from_zone: 'core', to_zone: 'core', import_specifier: './b', line: 9, col: 0 });
    });
    const mergedModel = relationModelFor(files, evidenceIndexFor(files, reportFor(doc, snapshot.snapshotId), snapshot.snapshotId));
    const a = at('src/core/a.ts').id;
    const b = at('src/core/b.ts').id;
    expect(mergedModel.edge(a, b)).toMatchObject({ sources: ['cycle', 'boundary'], line: 1 });
    expect(mergedModel.edges.filter((e) => e.from === a && e.to === b)).toHaveLength(1);
    expect(mergedModel.index.edges.filter((e) => e.from === a && e.to === b)).toHaveLength(1);
  });
});

describe('cycles (N7)', () => {
  it('reports 3 cycles, import cycles first then re-export, the core cycle\'s pathText matching cyclePathText(hops)', () => {
    expect(model.cycles).toHaveLength(3);
    expect(model.cycles.slice(0, 2).every((c) => c.kind === 'import')).toBe(true);
    expect(model.cycles[2]!.kind).toBe('re-export');
    expect(coreCycle.pathText).toBe(cyclePathText(coreCycle.hops));
    expect(coreCycle.pathText).toBe('src/core/a.ts:1 → src/core/b.ts:1 → src/core/c.ts:1 → src/core/a.ts');
  });

  it('gives the core cycle a fingerprint of its anchor id and its own finding id', () => {
    expect(coreCycle.fingerprint).toBe(`${at('src/core/a.ts').id}#${coreCycle.findingId}`);
  });

  it('a re-export cycle has no hop order (N3)', () => {
    expect(reExportCycle.hops).toEqual([]);
    expect(reExportCycle.matched).toBe(true);
  });

  it('pins the exact order: barrel import, core import, then the barrel re-export cycle (fix round)', () => {
    expect(model.cycles[0]).toMatchObject({ kind: 'import' });
    expect(model.cycles[0]!.members.map((m) => m.path)).toEqual(['src/barrel/index.ts', 'src/barrel/x.ts']);
    expect(model.cycles[1]).toMatchObject({ kind: 'import' });
    expect(model.cycles[1]!.members.map((m) => m.path)).toEqual(['src/core/a.ts', 'src/core/b.ts', 'src/core/c.ts']);
    expect(model.cycles[2]).toMatchObject({ kind: 're-export' });
    expect(model.cycles[2]!.members.map((m) => m.path)).toEqual(['src/barrel/index.ts', 'src/barrel/x.ts']);
  });
});

describe('unmatched members (N7)', () => {
  const reducedPaths = RELATIONS_PATHS.filter((p) => p !== 'src/core/c.ts');
  const reducedSnapshot = snapshotWithPaths(reducedPaths, 'repo-relations-reduced');
  const reducedFiles = fileSummariesFor(reducedSnapshot);
  const reducedReport = reportFor('relations-combined-3.27.0', reducedSnapshot.snapshotId);
  const reducedModel = relationModelFor(reducedFiles, evidenceIndexFor(reducedFiles, reducedReport, reducedSnapshot.snapshotId));
  const reducedCore = reducedModel.cycles.find((c) => c.kind === 'import' && c.members.some((m) => m.path === 'src/core/a.ts'))!;

  it('keeps the cycle with matched: false and the unmatched member\'s id null', () => {
    expect(reducedCore.matched).toBe(false);
    expect(reducedCore.members).toContainEqual({ path: 'src/core/c.ts', id: null });
  });

  it('draws none of the cycle\'s hops, and counts the 2 that touch c.ts as unmatched', () => {
    const a = reducedFiles.find((f) => f.path === 'src/core/a.ts')!.id;
    const b = reducedFiles.find((f) => f.path === 'src/core/b.ts')!.id;
    expect(reducedModel.edge(a, b)).toBeUndefined();
    expect(reducedModel.edges.some((e) => e.fromPath === 'src/core/a.ts' || e.fromPath === 'src/core/b.ts' || e.fromPath === 'src/core/c.ts')).toBe(false);
    expect(reducedModel.unmatchedEdges).toBe(2);
  });
});

describe('unmatched boundary violation (N7, fix round)', () => {
  const reducedPaths = RELATIONS_PATHS.filter((p) => p !== 'src/data/db.ts');
  const reducedSnapshot = snapshotWithPaths(reducedPaths, 'repo-relations-no-db');
  const reducedFiles = fileSummariesFor(reducedSnapshot);
  const reducedReport = reportFor('relations-combined-3.27.0', reducedSnapshot.snapshotId);
  const reducedModel = relationModelFor(reducedFiles, evidenceIndexFor(reducedFiles, reducedReport, reducedSnapshot.snapshotId));
  const violation = reducedModel.boundaryViolations[0]!;

  it('counts the violation as the one unmatched edge, with the barrel and core cycles still matched', () => {
    expect(reducedModel.cycles.filter((c) => c.kind === 'import').every((c) => c.matched)).toBe(true);
    expect(reducedModel.unmatchedEdges).toBe(1);
  });

  it('gives the violation view a null "to" id, and draws no edge for it', () => {
    expect(violation.to).toEqual({ path: 'src/data/db.ts', id: null });
    expect(reducedModel.edges.some((e) => e.fromPath === 'src/ui/view.ts')).toBe(false);
  });
});

describe('self-loop edges are skipped (fix round)', () => {
  it('a self-referential boundary violation never becomes an edge, keeping index.edges in step with edges', () => {
    const doc = fallowDoc('relations-combined-3.27.0', (d) => {
      const bv = (d.check! as unknown as { boundary_violations: Record<string, unknown>[] }).boundary_violations;
      bv.push({ from_path: 'src/core/a.ts', to_path: 'src/core/a.ts', from_zone: 'core', to_zone: 'core', import_specifier: './a', line: 20, col: 0 });
    });
    const selfLoopModel = relationModelFor(files, evidenceIndexFor(files, reportFor(doc, snapshot.snapshotId), snapshot.snapshotId));
    const a = at('src/core/a.ts').id;
    expect(selfLoopModel.edge(a, a)).toBeUndefined();
    expect(selfLoopModel.edges.some((e) => e.from === a && e.to === a)).toBe(false);
    expect(selfLoopModel.index.edges.some((e) => e.from === a && e.to === a)).toBe(false);
  });
});

describe('fan-in/out (N8)', () => {
  it('is collected with the recorded value for a scored file', () => {
    const recorded = report.normalized.relations.fan!.find((f) => f.path === 'src/core/a.ts')!;
    expect(model.fanIn(at('src/core/a.ts').id)).toMatchObject({ state: 'collected', value: recorded.fanIn, provenance: { source: 'fallow' } });
  });

  it('is unknown(RELATION_FAN_NOT_SCORED) for orphan.ts: the section was read but the recording never scores it', () => {
    expect(model.fanIn(at('src/orphan.ts').id)).toMatchObject({ state: 'unknown', reason: RELATION_FAN_NOT_SCORED });
  });

  it('is unknown(FALLOW_NOT_ANALYSED) without health.file_scores', () => {
    const doc = fallowDoc('relations-combined-3.27.0', (d) => { delete d.health!.file_scores; });
    const noFanModel = relationModelFor(files, evidenceIndexFor(files, reportFor(doc, snapshot.snapshotId), snapshot.snapshotId));
    expect(noFanModel.fanIn(at('src/core/a.ts').id)).toMatchObject({ state: 'unknown', reason: FALLOW_NOT_ANALYSED });
  });

  it('everything is unknown, and state is none, without a report', () => {
    const noReportModel = relationModelFor(files, evidenceIndexFor(files, null, snapshot.snapshotId));
    expect(noReportModel.state).toBe('none');
    expect(noReportModel.analysed).toBe(false);
    expect(noReportModel.boundaries).toBe('none');
    expect(noReportModel.cycles).toEqual([]);
    expect(noReportModel.edges).toEqual([]);
    expect(noReportModel.fanIn(at('src/core/a.ts').id)).toMatchObject({ state: 'unknown', reason: FALLOW_NOT_ANALYSED });
  });
});

describe('stale evidence (Review Focus 5)', () => {
  const staleModel = relationModelFor(files, evidenceIndexFor(files, reportFor('relations-combined-3.27.0', 'other-snapshot'), snapshot.snapshotId));

  it('reads stale everywhere, and still resolves the edges', () => {
    expect(staleModel.state).toBe('stale');
    expect(staleModel.fanIn(at('src/core/a.ts').id).state).toBe('stale');
    expect(staleModel.edges).toHaveLength(6);
  });
});

describe('relationModelFor is memoised per EvidenceIndex', () => {
  it('returns the same object for the same (files, index) pair', () => {
    expect(relationModelFor(files, evidence)).toBe(model);
  });
  it('rebuilds for a different files array, even over the same index (fix round)', () => {
    expect(relationModelFor(files.slice(), evidence)).not.toBe(model);
  });
});

describe('cyclePathText', () => {
  it('joins each hop\'s from with its line, ":?" for a null line, closing back on the first from', () => {
    expect(cyclePathText([{ from: 'a', to: 'b', line: 3 }, { from: 'b', to: 'a', line: null }])).toBe('a:3 → b:? → a');
  });
  it('is empty for no hops', () => {
    expect(cyclePathText([])).toBe('');
  });
});

describe('relationValue (J13, JF23)', () => {
  it('is unknown(FALLOW_NOT_ANALYSED) without a report', () => {
    const noReportModel = relationModelFor(files, evidenceIndexFor(files, null, snapshot.snapshotId));
    expect(relationValue(noReportModel, 3)).toMatchObject({ state: 'unknown', reason: FALLOW_NOT_ANALYSED });
  });
  it('is collected with fallow provenance when analysed and current', () => {
    expect(relationValue(model, 6)).toMatchObject({ state: 'collected', value: 6, provenance: { source: 'fallow' } });
  });
  it('is stale when the model is stale', () => {
    const staleModel = relationModelFor(files, evidenceIndexFor(files, reportFor('relations-combined-3.27.0', 'other-snapshot'), snapshot.snapshotId));
    expect(relationValue(staleModel, 6)).toMatchObject({ state: 'stale', value: 6 });
  });
  it('is unknown(FALLOW_NOT_ANALYSED) when the report exists but the cycle category was not analysed (fix round)', () => {
    const doc = fallowDoc('relations-combined-3.27.0', (d) => { delete d.check!.circular_dependencies; });
    const notAnalysedModel = relationModelFor(files, evidenceIndexFor(files, reportFor(doc, snapshot.snapshotId), snapshot.snapshotId));
    expect(notAnalysedModel.analysed).toBe(false);
    expect(relationValue(notAnalysedModel, 6)).toMatchObject({ state: 'unknown', reason: FALLOW_NOT_ANALYSED });
  });
});
