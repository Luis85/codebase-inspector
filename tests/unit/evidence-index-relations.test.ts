// WP-03 N11-N12 (JF3): the evidence index's touching map, the not-configured rule and the
// category-list counter, over the real relations recordings (tests/fixtures/fallow/README.md).
import { beforeEach, describe, expect, it } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { computeLayout } from '../../src/domain/layout/layout';
import { InMemoryEvidenceStore } from '../../src/adapters/storage/in-memory-evidence-store';
import { buildEvidenceReport } from '../../src/application/evidence/normalize-fallow';
import type { EvidenceFinding, EvidenceReport } from '../../src/application/evidence/model';
import { evidenceIndexFor } from '../../src/ui/read-models/evidence-index';
import { groupByFile } from '../../src/ui/read-models/evidence-touching';
import { fileSummariesFor, type FileSummary } from '../../src/ui/read-models/file-summaries';
import { useLensView } from '../../src/ui/read-models/use-lens-view';
import { useCityStore } from '../../src/ui/stores/city-store';
import { useEvidenceStore } from '../../src/ui/stores/evidence-store';
import { useLensStore } from '../../src/ui/stores/lens-store';
import { FALLOW_BOUNDARIES_NOT_CONFIGURED, FALLOW_NOT_ANALYSED } from '../../src/ui/inspector-copy';
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
  return buildEvidenceReport({
    raw: rawReport(fixture), fileName: 'relations.json', importedAt: IMPORTED_AT, snapshotId, stripPrefix: null,
  });
}

const snapshot = snapshotWithPaths(RELATIONS_PATHS, 'repo-relations');
const files = fileSummariesFor(snapshot);
const at = (path: string): FileSummary => files.find((f) => f.path === path)!;

const report = reportFor('relations-combined-3.27.0', snapshot.snapshotId);
const index = evidenceIndexFor(files, report, snapshot.snapshotId);

const coreCycle = report.normalized.findings.find((f) => f.detail.kind === 'cycle' && f.detail.members.length === 3)!;
const violation = report.normalized.findings.find((f) => f.category === 'boundary')!;

describe('EvidenceIndex.byFile stays anchor-only (N12)', () => {
  it('lists the core cycle only under its alphabetically first member', () => {
    expect(coreCycle.path).toBe('src/core/a.ts');
    expect(index.byFile.get(at('src/core/a.ts').id)).toContain(coreCycle);
    expect(index.byFile.get(at('src/core/b.ts').id) ?? []).not.toContain(coreCycle);
    expect(index.byFile.get(at('src/core/c.ts').id) ?? []).not.toContain(coreCycle);
  });
});

describe('EvidenceIndex.touching covers every file a finding involves (N12)', () => {
  it('lists the core cycle under every member, with the same anchorId', () => {
    const aId = at('src/core/a.ts').id;
    for (const path of ['src/core/a.ts', 'src/core/b.ts', 'src/core/c.ts']) {
      const hit = index.touching.get(at(path).id)?.find((t) => t.finding.id === coreCycle.id);
      expect(hit).toBeDefined();
      expect(hit!.anchorId).toBe(aId);
    }
  });

  it('lists the boundary violation under both its ends', () => {
    const viewId = at('src/ui/view.ts').id;
    const dbTouch = index.touching.get(at('src/data/db.ts').id)?.find((t) => t.finding.id === violation.id);
    const viewTouch = index.touching.get(viewId)?.find((t) => t.finding.id === violation.id);
    expect(dbTouch).toBeDefined();
    expect(viewTouch).toBeDefined();
    expect(dbTouch!.anchorId).toBe(viewId);
    expect(viewTouch!.anchorId).toBe(viewId);
  });
});

describe('groupByFile never lists the same finding twice under one file (Step 4)', () => {
  it('a related path that repeats, or repeats the anchor itself, still touches each file once', () => {
    const dedupeFinding: EvidenceFinding = {
      id: 'CY-deadbeef', category: 'cycle', rule: 'circular-dependencies', severity: null,
      path: 'src/core/a.ts', line: null, endLine: null, symbol: null,
      detail: { kind: 'cycle', cycleKind: 'import', members: ['src/core/a.ts', 'src/core/b.ts'], hops: [] },
      related: ['src/core/b.ts', 'src/core/b.ts', 'src/core/a.ts'],
    };
    const { touching } = groupByFile(files, [dedupeFinding]);
    expect(touching.get(at('src/core/a.ts').id)).toHaveLength(1);
    expect(touching.get(at('src/core/b.ts').id)).toHaveLength(1);
  });
});

describe('Counting once, and via touching per file (N12)', () => {
  it('totals.findings counts each finding once, matching matchedFindings', () => {
    expect(index.matchedFindings).toBe(report.normalized.findings.length);
    expect(index.totals.findings).toMatchObject({ value: index.matchedFindings });
  });

  it('perFile(db.ts) counts the violation it only touches', () => {
    expect(index.perFile(at('src/data/db.ts').id).findings).toMatchObject({ state: 'collected', value: 1 });
  });
});

describe('Unmatched related paths (N12)', () => {
  it('keeps a finding whose anchor matches even when a related member is missing, and lists that path unmatched', () => {
    const reducedPaths = RELATIONS_PATHS.filter((p) => p !== 'src/core/c.ts');
    const reducedSnapshot = snapshotWithPaths(reducedPaths, 'repo-relations-reduced');
    const reducedFiles = fileSummariesFor(reducedSnapshot);
    const reducedReport = reportFor('relations-combined-3.27.0', reducedSnapshot.snapshotId);
    const reducedIndex = evidenceIndexFor(reducedFiles, reducedReport, reducedSnapshot.snapshotId);
    const aId = reducedFiles.find((f) => f.path === 'src/core/a.ts')!.id;
    expect(reducedIndex.byFile.get(aId)?.some((f) => f.detail.kind === 'cycle' && f.detail.members.length === 3)).toBe(true);
    expect(reducedIndex.unmatchedPaths).toContain('src/core/c.ts');
  });
});

describe('the not-configured rule (N11, JF3)', () => {
  const noBoundaries = reportFor('relations-no-boundaries-3.27.0', snapshot.snapshotId);
  const noBoundariesIndex = evidenceIndexFor(files, noBoundaries, snapshot.snapshotId);

  it('a single not-configured category is unknown with FALLOW_BOUNDARIES_NOT_CONFIGURED, never 0', () => {
    expect(noBoundariesIndex.count(0, 'boundary')).toMatchObject({ state: 'unknown', reason: FALLOW_BOUNDARIES_NOT_CONFIGURED });
  });

  it('the total is not partial when only the not-configured category is missing: every other category is analysed', () => {
    expect(noBoundariesIndex.totals.findings.state).not.toBe('partial');
    expect(noBoundariesIndex.totals.findings.state).toBe('collected');
  });
});

describe('a category list (N13, JF3)', () => {
  const noBoundaries = reportFor('relations-no-boundaries-3.27.0', snapshot.snapshotId);
  const noBoundariesIndex = evidenceIndexFor(files, noBoundaries, snapshot.snapshotId);
  const LIST = ['cycle', 'boundary', 'unresolved-import'] as const;

  it('is collected on the relations recording, where every member is analysed', () => {
    expect(index.count(3, LIST).state).toBe('collected');
  });

  it('is collected on the no-boundaries recording too: the not-configured member is left out, not counted against it', () => {
    expect(noBoundariesIndex.count(2, LIST).state).toBe('collected');
  });

  it('is partial when a remaining (not not-configured) member was not analysed', () => {
    const doc = fallowDoc('relations-combined-3.27.0', (d) => { delete d.check!.unresolved_imports; });
    const partialReport = reportFor(doc, snapshot.snapshotId);
    const partialIndex = evidenceIndexFor(files, partialReport, snapshot.snapshotId);
    expect(partialIndex.count(2, LIST).state).toBe('partial');
  });

  it('is unknown with FALLOW_NOT_ANALYSED when none of the list is analysed (no check section)', () => {
    const healthOnly = reportFor('health-3.27.0', snapshot.snapshotId);
    const healthIndex = evidenceIndexFor(files, healthOnly, snapshot.snapshotId);
    expect(healthIndex.count(0, LIST)).toMatchObject({ state: 'unknown', reason: FALLOW_NOT_ANALYSED });
  });
});

describe('the findings lens paints every file a finding involves (N12)', () => {
  beforeEach(() => { setActivePinia(createPinia()); });

  it('reported includes every cycle member and both ends of the boundary violation', () => {
    useCityStore().setCity(snapshot, computeLayout(snapshot));
    const store = useEvidenceStore();
    store.setRepository(new InMemoryEvidenceStore());
    store.bindRepository(snapshot.repositoryId);
    store.attach(report);
    useLensStore().setLens('findings');
    const { reported } = useLensView();
    const ids = reported.value!;
    expect(ids).not.toBeNull();
    for (const path of ['src/core/a.ts', 'src/core/b.ts', 'src/core/c.ts', 'src/barrel/index.ts', 'src/barrel/x.ts', 'src/ui/view.ts', 'src/data/db.ts']) {
      expect(ids.has(at(path).id)).toBe(true);
    }
  });
});
