// WP-03 N12-N13: the Quality model's fifth "Import structure" card, and file-detail's
// findings via `touching` (a finding shown on every file it involves, J14/JF23).
import { describe, expect, it } from 'vitest';
import { buildEvidenceReport } from '../../src/application/evidence/normalize-fallow';
import { evidenceIndexFor } from '../../src/ui/read-models/evidence-index';
import { fileSummariesFor, type FileSummary } from '../../src/ui/read-models/file-summaries';
import { buildQualityModel, touchingFindings } from '../../src/ui/read-models/findings';
import { QUALITY_CARD_STRUCTURE, QUALITY_CARD_STRUCTURE_CAPTION } from '../../src/ui/inspector-copy';
import { rawReport } from '../fixtures/fallow-fixture';
import { snapshotWithPaths } from '../fixtures/evidence-report';

const RELATIONS_PATHS = [
  'src/core/a.ts', 'src/core/b.ts', 'src/core/c.ts',
  'src/barrel/index.ts', 'src/barrel/x.ts', 'src/barrel/y.ts',
  'src/ui/view.ts', 'src/data/db.ts', 'src/data/types.ts',
  'src/index.ts', 'src/orphan.ts',
];

const snapshot = snapshotWithPaths(RELATIONS_PATHS, 'repo-structure');
const files = fileSummariesFor(snapshot);
const at = (path: string): FileSummary => files.find((f) => f.path === path)!;
const report = buildEvidenceReport({
  raw: rawReport('relations-combined-3.27.0'), fileName: 'relations.json', importedAt: '2026-09-24T10:00:00.000Z',
  snapshotId: snapshot.snapshotId, stripPrefix: null,
});
const index = evidenceIndexFor(files, report, snapshot.snapshotId);
const violation = report.normalized.findings.find((f) => f.category === 'boundary')!;

describe('buildQualityModel: the Import structure card (N13)', () => {
  it('has five cards, the fifth counting open cycle, boundary and unresolved-import findings', () => {
    const model = buildQualityModel(files, index, []);
    expect(model.cards).toHaveLength(5);
    const structure = model.cards.find((c) => c.id === 'structure')!;
    expect(structure).toBeDefined();
    expect(structure.label).toBe(QUALITY_CARD_STRUCTURE);
    expect(structure.caption).toBe(QUALITY_CARD_STRUCTURE_CAPTION);
    // README.md's recorded facts: 3 CY- (2 import cycles + 1 re-export cycle), 1 BV-, 1 UR-.
    expect(structure.value).toMatchObject({ state: 'collected', value: 5 });
    // A complexity/duplication/unused-exports finding never counts on this card: the
    // relations recording's only non-structure finding is its one unused export.
    const nonStructure = model.findings.filter((f) => !['cycle', 'boundary', 'unresolved-import'].includes(f.kind));
    expect(nonStructure).toHaveLength(1);
    expect(nonStructure[0]!.kind).toBe('unused-exports');
  });

  it('lists each finding once in the findings list, even one that touches several files', () => {
    const model = buildQualityModel(files, index, []);
    const cycleFindingIds = report.normalized.findings.filter((f) => f.category === 'cycle').map((f) => f.id);
    expect(cycleFindingIds.length).toBeGreaterThan(0);
    for (const id of cycleFindingIds) {
      expect(model.findings.filter((f) => f.id === id)).toHaveLength(1);
    }
  });
});

describe('touchingFindings (N12, J14/JF23)', () => {
  it('shows a finding on a related file with anchored false, the anchor fingerprint, and its related paths', () => {
    const dbFile = at('src/data/db.ts');
    const viewFile = at('src/ui/view.ts');
    const row = touchingFindings(dbFile, index).find((f) => f.id === violation.id)!;
    expect(row).toBeDefined();
    expect(row.anchored).toBe(false);
    expect(row.anchorPath).toBe(viewFile.path);
    expect(row.fingerprint).toBe(`${viewFile.id}#${violation.id}`);
    expect(row.related).toEqual(['src/data/db.ts']);
  });

  it('shows the same finding on its anchor file with anchored true', () => {
    const viewFile = at('src/ui/view.ts');
    const row = touchingFindings(viewFile, index).find((f) => f.id === violation.id)!;
    expect(row).toBeDefined();
    expect(row.anchored).toBe(true);
    expect(row.anchorPath).toBe(viewFile.path);
    expect(row.fingerprint).toBe(`${viewFile.id}#${violation.id}`);
  });
});
