// WP-03 N33/N37: the dense-graph relations budget. A synthetic 5,000-file, 40-folder
// snapshot with 200 import cycles (3-8 files each) and enough boundary violations to make
// 2,000 evidenced edges in total, built as fallow JSON and pushed through the REAL parser
// and normaliser (no mocks, global-constraints.md's "no mocks for the parser"). Median of
// 20 runs (2 warm-up), timing ONLY the function under budget each time:
// - relationModelFor: a FRESH EvidenceIndex per run (evidenceIndexFor's own memo keys on
//   the files array's identity, so a fresh `files.slice()` each run forces a fresh build —
//   built ahead of the timed call, so only relationModelFor's own cost is measured, not
//   the fresh index's);
// - neighbourhood(both, 2 hops, limit 24) on the highest-degree file (a "hub" file wired
//   as every boundary violation's `to`, so its in-degree alone exceeds the limit);
// - aggregateEdges, grouped into 12 buckets (MAX_GRAPH_MODULES, architecture.ts);
// - createRelationArcs().setArcs(64 arcs) on the 5,000-lot layout (JF13: setLots and
//   setColors run first, and drawnCount() === 64 is asserted before the arcs are timed —
//   otherwise a mis-wired fixture would time an empty no-op and still look "fast"). No GL
//   context is needed: the arc geometry is plain Three.js BufferGeometry/InstancedMesh
//   construction, never attached to a WebGLRenderer.
// Truncation is asserted, not only timed (N37): EdgeList shows EDGE_LIST_LIMIT rows and
// EDGE_LIST_HIDDEN(edges - 200); cityRelationsFor on the hub gives RELATION_ARC_LIMIT rows
// with a non-zero hidden count. Medians are written to
// <tmpdir>/codebase-inspector-benchmark/relations.json (city-benchmark.test.ts's own
// convention), for Task 15 to cite.
import { mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { mount } from '@vue/test-utils';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { computeLayout } from '../../src/domain/layout/layout';
import { aggregateEdges, neighbourhood } from '../../src/domain/relations/queries';
import { buildEvidenceReport } from '../../src/application/evidence/normalize-fallow';
import { parseFallowReportText } from '../../src/application/evidence/read-fallow-report';
import type { EvidenceReport } from '../../src/application/evidence/model';
import { EDGE_LIST_HIDDEN } from '../../src/ui/inspector-copy';
import { evidenceIndexFor } from '../../src/ui/read-models/evidence-index';
import { fileSummariesFor, type FileSummary } from '../../src/ui/read-models/file-summaries';
import { cityRelationsFor } from '../../src/ui/read-models/city-relations';
import { RELATION_ARC_LIMIT, relationModelFor, type RelationModel } from '../../src/ui/read-models/relations';
import EdgeList from '../../src/ui/screens/architecture/EdgeList.vue';
import { EDGE_LIST_LIMIT } from '../../src/ui/screens/architecture/use-architecture-selection';
import { createRelationArcs } from '../../src/visualization/relation-arcs';
import type { RelationArc } from '../../src/visualization/renderer-port';
import type { CodebaseSnapshot } from '../../src/domain/model';
import type { LayoutResult } from '../../src/domain/layout/types';
import { paletteFixture } from '../fixtures/renderer-doubles';
import { snapshotWithPaths } from '../fixtures/evidence-report';

const CACHE = join(tmpdir(), 'codebase-inspector-benchmark');
const FOLDER_COUNT = 40;
const FILES_PER_FOLDER = 125;                    // 40 * 125 = 5,000
const FILE_COUNT = FOLDER_COUNT * FILES_PER_FOLDER;
const CYCLE_COUNT = 200;
const TOTAL_EDGES = 2_000;
const MODULE_BUCKETS = 12;                        // architecture.ts's MAX_GRAPH_MODULES
const RUNS = 20;
const WARMUP = 2;

function folderName(f: number): string {
  return `mod${String(f).padStart(2, '0')}`;
}

/** 5,000 file paths, 125 per folder, folder-major order (so `idx / FILES_PER_FOLDER`
 *  recovers each file's folder without a lookup). */
function densePaths(): string[] {
  const paths: string[] = [];
  for (let f = 0; f < FOLDER_COUNT; f += 1) {
    for (let i = 0; i < FILES_PER_FOLDER; i += 1) paths.push(`${folderName(f)}/file${i}.ts`);
  }
  return paths;
}

interface DenseFixture {
  hubPath: string;
  /** Every import-cycle hop is one edge (cycles of 3-8 files, no self-loop), plus one
   *  boundary violation per remaining file, from a distinct source into `hubPath` — the
   *  two sets share no path, so the model's edge count is exactly TOTAL_EDGES. */
  json: string;
}

/** N37: 200 cycles sized 3..8 (repeating), then enough boundary violations INTO one hub
 *  file to reach TOTAL_EDGES evidenced edges overall — computed from the cycles' own
 *  size, never hand-totalled, so the 2,000/1,800 figures stay exact if CYCLE_COUNT ever
 *  changes. */
function buildDenseFixture(paths: readonly string[]): DenseFixture {
  let ptr = 0;
  const circularDependencies: { files: string[]; line: number; col: number }[] = [];
  for (let i = 0; i < CYCLE_COUNT; i += 1) {
    const size = 3 + (i % 6);                     // 3, 4, 5, 6, 7, 8, repeating
    const cycleFiles = paths.slice(ptr, ptr + size);
    ptr += size;
    circularDependencies.push({ files: cycleFiles, line: 1, col: 9 });
  }
  const cycleEdgeTotal = circularDependencies.reduce((sum, c) => sum + c.files.length, 0);
  const hubPath = paths[ptr]!;
  ptr += 1;
  const boundaryCount = TOTAL_EDGES - cycleEdgeTotal;
  const boundarySources = paths.slice(ptr, ptr + boundaryCount);
  const boundaryViolations = boundarySources.map((from) => ({
    from_path: from, to_path: hubPath, from_zone: 'app', to_zone: 'core', import_specifier: `../../${hubPath}`, line: 3, col: 9,
  }));
  const doc = {
    kind: 'combined', schema_version: 12, version: '3.27.0', workspace_diagnostics: [],
    check: {
      summary: {}, unused_exports: [], unused_types: [],
      circular_dependencies: circularDependencies, re_export_cycles: [] as unknown[],
      boundary_violations: boundaryViolations, unresolved_imports: [] as unknown[],
    },
  };
  return { hubPath, json: JSON.stringify(doc) };
}

function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1]! + sorted[mid]!) / 2 : sorted[mid]!;
}

/** `warmup` untimed calls, then the median of `runs` timed ones. */
function medianOf(fn: () => void, runs = RUNS, warmup = WARMUP): number {
  for (let i = 0; i < warmup; i += 1) fn();
  const samples: number[] = [];
  for (let i = 0; i < runs; i += 1) {
    const started = performance.now();
    fn();
    samples.push(performance.now() - started);
  }
  return median(samples);
}

let snapshot: CodebaseSnapshot;
let files: readonly FileSummary[];
let layout: LayoutResult;
let report: EvidenceReport;
let model: RelationModel;
let hubId: string;
let groupOf: (id: string) => string;
const medians: Record<string, number> = {};

describe('relations budget — 5,000 files, 2,000 evidenced edges, 200 cycles (N33, N37)', () => {
  beforeAll(() => {
    const paths = densePaths();
    const fixture = buildDenseFixture(paths);
    snapshot = snapshotWithPaths(paths, 'repo-relations-budget');
    files = fileSummariesFor(snapshot);
    layout = computeLayout(snapshot);
    expect(layout.lots.length).toBe(FILE_COUNT);   // no lot dropped at scale

    const parsed = parseFallowReportText(fixture.json);
    if (!parsed.ok) throw new Error(`benchmark fixture refused: ${parsed.code} ${parsed.detail}`);
    report = buildEvidenceReport({
      raw: parsed.report, fileName: 'relations-budget.json', importedAt: '2026-09-24T10:00:00.000Z',
      snapshotId: snapshot.snapshotId, stripPrefix: null,
    });

    model = relationModelFor(files, evidenceIndexFor(files, report, snapshot.snapshotId));
    expect(model.analysed).toBe(true);
    expect(model.edges.length).toBe(TOTAL_EDGES);

    hubId = files.find((f) => f.path === fixture.hubPath)!.id;
    const folderIndexById = new Map(files.map((f, idx) => [f.id, Math.floor(idx / FILES_PER_FOLDER)]));
    groupOf = (id) => `module-${(folderIndexById.get(id) ?? 0) % MODULE_BUCKETS}`;
  }, 30_000);

  afterAll(() => {
    mkdirSync(CACHE, { recursive: true });
    writeFileSync(join(CACHE, 'relations.json'), `${JSON.stringify({
      recordedAt: new Date().toISOString(), platform: `${process.platform} ${process.arch}`, node: process.version,
      files: FILE_COUNT, evidencedEdges: TOTAL_EDGES, cycles: CYCLE_COUNT, medians,
    }, null, 2)}\n`);
  });

  it('relationModelFor builds in under 50 ms (median), a fresh EvidenceIndex bypassing every memo', () => {
    const total = RUNS + WARMUP;
    // evidenceIndexFor's own memo is keyed on the `files` ARRAY's identity, then the
    // report object; a fresh `files.slice()` per run misses both keys, so every one of
    // these builds a genuinely new EvidenceIndex — built here, ahead of the timed loop,
    // so relationModelFor's own memo (keyed on THIS object's identity) also misses every
    // time without the index's own build cost entering the timed budget.
    const freshIndexes = Array.from({ length: total }, () => evidenceIndexFor(files.slice(), report, snapshot.snapshotId));
    let i = 0;
    medians.relationModelForMs = medianOf(() => { relationModelFor(files, freshIndexes[i]!); i += 1; });
    expect(medians.relationModelForMs).toBeLessThan(50);
  }, 30_000);

  it('neighbourhood(both, 2 hops, limit 24) on the hub file is under 2 ms (median), with hidden > 0', () => {
    const hubNeighbourhood = neighbourhood(model.index, hubId, { direction: 'both', hops: 2, limit: RELATION_ARC_LIMIT });
    expect(hubNeighbourhood.hidden).toBeGreaterThan(0);
    medians.neighbourhoodMs = medianOf(
      () => neighbourhood(model.index, hubId, { direction: 'both', hops: 2, limit: RELATION_ARC_LIMIT }),
    );
    expect(medians.neighbourhoodMs).toBeLessThan(2);
  }, 30_000);

  it('aggregateEdges to 12 modules is under 10 ms (median)', () => {
    medians.aggregateEdgesMs = medianOf(() => aggregateEdges(model.index.edges, groupOf));
    expect(medians.aggregateEdgesMs).toBeLessThan(10);
  }, 30_000);

  it('createRelationArcs().setArcs(64 arcs) on the 5,000-lot layout is under 8 ms (median)', () => {
    const arcs: RelationArc[] = model.edges.slice(0, 64).map((e) => ({ from: e.from, to: e.to, role: 'outgoing' }));
    expect(arcs).toHaveLength(64);
    const relationArcs = createRelationArcs();
    relationArcs.setLots(layout.lots);
    relationArcs.setColors(paletteFixture());
    relationArcs.setArcs(arcs);
    // JF13: prove the fixture actually draws 64 arcs BEFORE timing setArcs — otherwise a
    // lot/edge mismatch would silently time an empty rebuild and still look "fast".
    expect(relationArcs.drawnCount()).toBe(64);
    medians.setArcsMs = medianOf(() => relationArcs.setArcs(arcs));
    expect(relationArcs.drawnCount()).toBe(64);
    relationArcs.dispose();
    expect(medians.setArcsMs).toBeLessThan(8);
  }, 30_000);

  it('the Edges tab stays navigable: EDGE_LIST_LIMIT rows, EDGE_LIST_HIDDEN(edges - 200)', () => {
    const w = mount(EdgeList, {
      props: { relations: model, notAnalysed: false, selectedModule: null, violating: new Set<string>(), violationsOnly: false },
    });
    const rows = w.findAll('.ci-edge-list .ci-table__row');
    expect(rows).toHaveLength(EDGE_LIST_LIMIT);
    expect(w.find('.ci-edge-list').text()).toContain(EDGE_LIST_HIDDEN(TOTAL_EDGES - EDGE_LIST_LIMIT));
    w.unmount();
  }, 30_000);

  it('the city Relations section stays navigable: RELATION_ARC_LIMIT rows on the hub, hidden > 0', () => {
    const view = cityRelationsFor(model, hubId, { direction: 'both', hops: 2, showArcs: false, highlightedCycleId: null });
    expect(view.rows).toHaveLength(RELATION_ARC_LIMIT);
    expect(view.hidden).toBeGreaterThan(0);
  }, 30_000);
});
