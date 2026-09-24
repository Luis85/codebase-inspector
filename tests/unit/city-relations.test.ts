// WP-03 Task 12 (N17, N30): the city Relations section's pure read model — the file's
// neighbourhood rows and the arcs sent to the renderer, which are exactly those rows or a
// highlighted cycle's hops — over the real relations recording (tests/fixtures/fallow/README.md,
// "Relations project"). Review Focus 4 (long and vanished cycles) and 5 (stale arcs).
import { describe, expect, it } from 'vitest';
import { buildEvidenceReport } from '../../src/application/evidence/normalize-fallow';
import { evidenceIndexFor } from '../../src/ui/read-models/evidence-index';
import { fileSummariesFor, type FileSummary } from '../../src/ui/read-models/file-summaries';
import { RELATION_ARC_LIMIT, relationModelFor, type RelationModel } from '../../src/ui/read-models/relations';
import { canHighlight, cityRelationsFor } from '../../src/ui/read-models/city-relations';
import type { RelationControlDirection } from '../../src/ui/stores/relations-store';
import { fallowDoc, rawReport } from '../fixtures/fallow-fixture';
import { snapshotWithPaths } from '../fixtures/evidence-report';

const LONG = Array.from({ length: 30 }, (_, i) => `src/long/f${String(i).padStart(2, '0')}.ts`);
const PATHS = [
  'src/core/a.ts', 'src/core/b.ts', 'src/core/c.ts', 'src/barrel/index.ts', 'src/barrel/x.ts', 'src/barrel/y.ts',
  'src/ui/view.ts', 'src/data/db.ts', 'src/data/types.ts', 'src/index.ts', 'src/orphan.ts', ...LONG,
];
const snapshot = snapshotWithPaths(PATHS, 'repo-city-relations');
const files = fileSummariesFor(snapshot);
const id = (path: string): string => files.find((f: FileSummary) => f.path === path)!.id;

/** The recording plus a 30-file import cycle f00 → f01 → … → f29 → f00, each hop on line i + 1. */
const doc = fallowDoc('relations-combined-3.27.0', (d) => {
  const cycles = (d.check! as unknown as { circular_dependencies: unknown[] }).circular_dependencies;
  cycles.push({ files: LONG, length: LONG.length, line: 1, col: 0, edges: LONG.map((path, i) => ({ path, line: i + 1, col: 0 })) });
});

function modelFor(reportSnapshotId: string | null): RelationModel {
  const report = reportSnapshotId === null ? null : buildEvidenceReport({
    raw: rawReport(doc), fileName: 'relations.json', importedAt: '2026-09-24T10:00:00.000Z', snapshotId: reportSnapshotId, stripPrefix: null,
  });
  return relationModelFor(files, evidenceIndexFor(files, report, snapshot.snapshotId));
}
const model = modelFor(snapshot.snapshotId);
const coreCycle = model.cycles.find((c) => c.members.some((m) => m.path === 'src/core/a.ts'))!;
const longCycle = model.cycles.find((c) => c.members.length === 30)!;

interface Controls { direction: RelationControlDirection; hops: 1 | 2; showArcs: boolean; highlightedCycleId: string | null }
const DEFAULTS: Controls = { direction: 'both', hops: 1, showArcs: true, highlightedCycleId: null };
const A = id('src/core/a.ts');
const B = id('src/core/b.ts');
const C = id('src/core/c.ts');

describe('cityRelationsFor: the neighbourhood rows and arcs (N17, N30)', () => {
  it('for core/a.ts, both directions and 1 hop: b (out) and c (in), and exactly those arcs', () => {
    const view = cityRelationsFor(model, A, DEFAULTS);
    expect(view.state).toBe('current');
    expect(view.rows).toEqual([
      { otherId: B, otherPath: 'src/core/b.ts', direction: 'out', hop: 1, line: 1, sources: ['cycle'], importerPath: 'src/core/a.ts' },
      { otherId: C, otherPath: 'src/core/c.ts', direction: 'in', hop: 1, line: 1, sources: ['cycle'], importerPath: 'src/core/c.ts' },
    ]);
    expect(view.hidden).toBe(0);
    expect(view.arcs).toEqual([{ from: A, to: B, role: 'outgoing' }, { from: C, to: A, role: 'incoming' }]);
    expect(view.cycles.map((c) => c.findingId)).toEqual([coreCycle.findingId]);
    expect(view.highlighted).toBeNull();
    expect(view.highlightHidden).toBe(0);
  });

  it('direction out keeps only the outgoing row and arc', () => {
    const view = cityRelationsFor(model, A, { ...DEFAULTS, direction: 'out' });
    expect(view.rows.map((r) => [r.otherId, r.direction])).toEqual([[B, 'out']]);
    expect(view.arcs).toEqual([{ from: A, to: B, role: 'outgoing' }]);
  });

  it('two hops continue in the same direction, each edge once, and every row has its arc', () => {
    // b → c is hop 2 both outwards (a → b → c) and inwards (b → c → a); N17 lists it once.
    const view = cityRelationsFor(model, A, { ...DEFAULTS, hops: 2 });
    expect(view.rows.map((r) => [r.otherId, r.direction, r.hop, r.line])).toEqual([[B, 'out', 1, 1], [C, 'in', 1, 1], [C, 'out', 2, 1]]);
    expect(view.arcs).toEqual([
      { from: A, to: B, role: 'outgoing' }, { from: C, to: A, role: 'incoming' }, { from: B, to: C, role: 'outgoing' },
    ]);
  });

  it('showArcs false gives no arcs but keeps the rows', () => {
    const view = cityRelationsFor(model, A, { ...DEFAULTS, showArcs: false });
    expect(view.arcs).toBeNull();
    expect(view.rows).toHaveLength(2);
  });

  it('no selection gives no arcs; a file without evidenced edges gives no rows and no arcs to draw', () => {
    expect(cityRelationsFor(model, null, DEFAULTS).arcs).toBeNull();
    const orphan = cityRelationsFor(model, id('src/orphan.ts'), DEFAULTS);
    expect(orphan.rows).toEqual([]);
    expect(orphan.arcs).toEqual([]);
  });

  it('state none gives no rows and no arcs', () => {
    const view = cityRelationsFor(modelFor(null), A, DEFAULTS);
    expect(view.state).toBe('none');
    expect(view.rows).toEqual([]);
    expect(view.cycles).toEqual([]);
    expect(view.arcs).toBeNull();
  });
});

describe('cityRelationsFor: a highlighted cycle (N30, Review Focus 4)', () => {
  it('replaces the arcs with the cycle\'s hops (role cycle), while the rows stay the neighbourhood', () => {
    const view = cityRelationsFor(model, A, { ...DEFAULTS, highlightedCycleId: coreCycle.findingId });
    expect(view.highlighted?.findingId).toBe(coreCycle.findingId);
    expect(view.arcs).toEqual([{ from: A, to: B, role: 'cycle' }, { from: B, to: C, role: 'cycle' }, { from: C, to: A, role: 'cycle' }]);
    expect(view.rows.map((r) => r.otherId)).toEqual([B, C]);
    expect(view.highlightHidden).toBe(0);
  });

  it('with showArcs false, a highlighted cycle still sends no arcs', () => {
    const view = cityRelationsFor(model, A, { ...DEFAULTS, showArcs: false, highlightedCycleId: coreCycle.findingId });
    expect(view.highlighted?.findingId).toBe(coreCycle.findingId);
    expect(view.arcs).toBeNull();
  });

  it('vanished cycle: an unknown highlightedCycleId gives no highlight and the neighbourhood arcs', () => {
    const view = cityRelationsFor(model, A, { ...DEFAULTS, highlightedCycleId: 'CY-00000000' });
    expect(view.highlighted).toBeNull();
    expect(view.highlightHidden).toBe(0);
    expect(view.arcs).toEqual([{ from: A, to: B, role: 'outgoing' }, { from: C, to: A, role: 'incoming' }]);
  });

  it('a cycle that does not pass through the selected file is not highlighted', () => {
    const view = cityRelationsFor(model, A, { ...DEFAULTS, highlightedCycleId: longCycle.findingId });
    expect(view.highlighted).toBeNull();
    expect(view.arcs).toEqual([{ from: A, to: B, role: 'outgoing' }, { from: C, to: A, role: 'incoming' }]);
  });

  it('long cycle: 30 hops highlighted give the first 24 arcs and highlightHidden 6', () => {
    const view = cityRelationsFor(model, id(LONG[0]!), { ...DEFAULTS, highlightedCycleId: longCycle.findingId });
    expect(view.highlighted?.findingId).toBe(longCycle.findingId);
    expect(view.arcs).toHaveLength(RELATION_ARC_LIMIT);
    expect(view.arcs![0]).toEqual({ from: id(LONG[0]!), to: id(LONG[1]!), role: 'cycle' });
    expect(view.arcs![23]).toEqual({ from: id(LONG[23]!), to: id(LONG[24]!), role: 'cycle' });
    expect(view.highlightHidden).toBe(6);
  });

  it('a re-export cycle is listed but never highlighted: it has no hops to draw (N3, N6)', () => {
    const reExport = model.cycles.find((c) => c.kind === 're-export')!;
    const member = reExport.members[0]!.id!;
    expect(reExport.members[0]!.path).toBe('src/barrel/index.ts');
    const view = cityRelationsFor(model, member, { ...DEFAULTS, highlightedCycleId: reExport.findingId });
    expect(view.cycles.map((c) => c.findingId)).toContain(reExport.findingId);
    expect(view.highlighted).toBeNull();
    const X = id('src/barrel/x.ts');
    expect(view.arcs).toEqual([{ from: member, to: X, role: 'outgoing' }, { from: X, to: member, role: 'incoming' }]);
    expect(canHighlight(reExport)).toBe(false);
  });

  it('a partly unmatched import cycle is listed but never highlighted: none of its hops is drawn (N7)', () => {
    const partialFiles = files.filter((f) => f.path !== 'src/core/c.ts');
    const partial = relationModelFor(partialFiles, evidenceIndexFor(partialFiles, buildEvidenceReport({
      raw: rawReport(doc), fileName: 'relations.json', importedAt: '2026-09-24T10:00:00.000Z', snapshotId: snapshot.snapshotId, stripPrefix: null,
    }), snapshot.snapshotId));
    const core = partial.cycles.find((c) => c.members.some((m) => m.path === 'src/core/a.ts'))!;
    expect(core.kind).toBe('import');
    expect(core.matched).toBe(false);
    expect(canHighlight(core)).toBe(false);
    const view = cityRelationsFor(partial, A, { ...DEFAULTS, highlightedCycleId: core.findingId });
    expect(view.cycles.map((c) => c.findingId)).toEqual([core.findingId]);
    expect(view.highlighted).toBeNull();
    expect(view.arcs).toEqual([]);
  });
});

describe('cityRelationsFor: stale evidence (Review Focus 5)', () => {
  it('a stale model still gives rows and arcs, and says stale', () => {
    const view = cityRelationsFor(modelFor('an-older-snapshot'), A, DEFAULTS);
    expect(view.state).toBe('stale');
    expect(view.rows).toHaveLength(2);
    expect(view.arcs).toEqual([{ from: A, to: B, role: 'outgoing' }, { from: C, to: A, role: 'incoming' }]);
  });
});
