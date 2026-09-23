// Part 6 acceptance evidence for the Fallow Ingestion deliverable (spec §5):
// (1) a known fixture finding lands on the right file and line in the quality model
//     (the lens set is Task 11's);
// (6) with no report every structural screen still works, and nothing reads 0.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { computeLayout } from '../../src/domain/layout/layout';
import { makeEntityId } from '../../src/domain/entity-id';
import { parseFallowReportText } from '../../src/application/evidence/read-fallow-report';
import { buildEvidenceReport } from '../../src/application/evidence/normalize-fallow';
import { evidenceIndexFor } from '../../src/ui/read-models/evidence-index';
import { fileSummariesFor } from '../../src/ui/read-models/file-summaries';
import { buildQualityModel } from '../../src/ui/read-models/findings';
import { useReadModels } from '../../src/ui/read-models/use-read-models';
import { useCityStore } from '../../src/ui/stores/city-store';
import { FALLOW_NOT_ANALYSED } from '../../src/ui/inspector-copy';
import { buildSnapshotFixture } from '../fixtures/snapshot-builder';
import { snapshotWithPaths } from '../fixtures/evidence-report';

const FIXTURE = resolve(process.cwd(), 'tests', 'fixtures', 'fallow', 'combined-3.27.0.json');
const NOW = '2026-09-23T10:00:00.000Z';
type Raw = Parameters<typeof buildEvidenceReport>[0]['raw'];
/** Only the recorded fields this test reads, straight from the JSON (not through our schema). */
interface Recorded {
  check: { unused_exports: { path: string; export_name: string; line: number }[] };
  health: { findings: { path: string; name: string; line: number; severity: string }[] };
}

const reportFor = (raw: Raw, snapshotId: string) =>
  buildEvidenceReport({ raw, fileName: 'combined-3.27.0.json', importedAt: NOW, snapshotId, stripPrefix: null });

describe('acceptance (1): a known fixture finding lands on its own file and line', () => {
  const text = readFileSync(FIXTURE, 'utf8');
  const recorded = JSON.parse(text) as Recorded;
  const parsed = parseFallowReportText(text);
  if (!parsed.ok) throw new Error(`the recorded fixture no longer parses: ${parsed.code} ${parsed.detail}`);
  // A snapshot holding exactly the paths the report names, as a scan of the fixture project would.
  const paths = [...new Set(reportFor(parsed.report, 'probe').normalized.findings.map((f) => f.path))];
  const snap = snapshotWithPaths(paths);
  const files = fileSummariesFor(snap);
  const quality = buildQualityModel(files, evidenceIndexFor(files, reportFor(parsed.report, snap.snapshotId), snap.snapshotId), []);

  it('the recorded unused export: its file, line and symbol, and no severity of our own', () => {
    const known = recorded.check.unused_exports[0]!;
    const hit = quality.findings.find((f) => f.file.path === known.path && f.symbol === known.export_name);
    expect(hit).toMatchObject({ kind: 'unused-exports', rule: 'unused-export', line: known.line, severity: 'unrated' });
    expect(hit!.fingerprint).toBe(`${makeEntityId(snap.repositoryId, 'file', known.path)}#${hit!.id}`);
  });

  it('the recorded complexity finding: its file, line, function and the tool\'s own severity', () => {
    const known = recorded.health.findings[0]!;
    const hit = quality.findings.find((f) => f.file.path === known.path && f.symbol === known.name);
    expect(hit).toMatchObject({ kind: 'complexity', rule: 'complexity', line: known.line, severity: known.severity });
  });
});

/** oxlint consistent-function-scoping: it captures nothing, so it lives at module scope. */
function withSnapshot() {
  const snap = buildSnapshotFixture({ files: 30, directories: 3 });
  const store = useCityStore();
  store.setCity(snap, computeLayout(snap));
  store.select(fileSummariesFor(snap)[0]!.id);
  return useReadModels();
}

describe('acceptance (6): with no report every structural screen works and nothing reads 0', () => {
  beforeEach(() => { setActivePinia(createPinia()); });

  it('Overview, Code quality, the city summary and File detail read unknown, with the reason', () => {
    const m = withSnapshot();
    expect(m.evidence.value.state).toBe('none');
    const values = [
      m.overview.value!.cards.find((c) => c.id === 'findings')!.value,
      ...m.quality.value.cards.map((c) => c.value),
      m.citySummary.value.find((c) => c.id === 'unused')!.value,
      m.fileDetail.value!.findingsCount,
    ];
    expect(values).toHaveLength(7);
    for (const v of values) {
      expect(v).toMatchObject({ state: 'unknown', reason: FALLOW_NOT_ANALYSED });
      expect(v.value).toBeUndefined();
    }
    expect(m.quality.value.findings).toEqual([]);
    expect(m.fileDetail.value!.findings).toEqual([]);
    const rows = m.overview.value!.coverage;
    expect(rows.find((r) => r.id === 'fallow')?.state).toBe('unknown');
    expect(rows.some((r) => r.id === 'static')).toBe(false);
  });

  it('everything that does not come from fallow still reads: files, bytes, hotspots and coverage', () => {
    const m = withSnapshot();
    expect(m.overview.value!.fileCount).toBe(30);
    expect(m.overview.value!.cards.find((c) => c.id === 'coverage')!.value.value).toBeDefined();
    expect(m.citySummary.value.find((c) => c.id === 'hotspots')!.value.value).toBeDefined();
    expect(m.fileDetail.value!.bytes.state).toBe('collected');
  });
});
