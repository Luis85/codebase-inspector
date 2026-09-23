import { describe, expect, it } from 'vitest';
import { buildSnapshotFixture } from '../fixtures/snapshot-builder';
import { syntheticEvidenceReport } from '../fixtures/evidence-report';
import { fileSummariesFor, type FileSummary } from '../../src/ui/read-models/file-summaries';
import { buildFileDetail } from '../../src/ui/read-models/file-detail';
import { evidenceIndexFor } from '../../src/ui/read-models/evidence-index';
import { unknown } from '../../src/ui/evidence';
import { FALLOW_NOT_ANALYSED, FINDING_TITLE } from '../../src/ui/inspector-copy';

const snap = buildSnapshotFixture({ files: 12, directories: 2, unavailable: 1 });
const files = fileSummariesFor(snap);

describe('file detail model', () => {
  it('is null without a selection, for an unknown id, and for a directory', () => {
    expect(buildFileDetail(snap, files, null)).toBeNull();
    expect(buildFileDetail(snap, files, 'nope')).toBeNull();
    const dir = snap.entities.find((e) => e.kind === 'directory')!;
    expect(buildFileDetail(snap, files, dir.id)).toBeNull();
  });
  it('has four sample cards, collected bytes and the entity category', () => {
    const f = files[3]!;
    const d = buildFileDetail(snap, files, f.id)!;
    expect(d.cards.map((c) => [c.id, c.value.state])).toEqual([['complexity', 'sample'], ['coverage', 'sample'], ['dependents', 'sample'], ['priority', 'sample']]);
    expect(d.bytes.state).toBe('collected');
    expect(d.category).toBe(snap.entities.find((e) => e.id === f.id)?.category);
    expect(d.moduleLabel).toBe(f.module);
    expect(d.usesSample).toBe(true);
  });
  it('ends each history series at the current value', () => {
    const f = files[3]!;
    const d = buildFileDetail(snap, files, f.id)!;
    expect(d.history.find((s) => s.id === 'complexity')?.points.at(-1)?.value).toBe(f.complexity.value);
    expect(d.history.find((s) => s.id === 'coverage')?.points.at(-1)?.value).toBe(f.branchCoverage.value);
  });
  it('omits a history series whose value is unknown', () => {
    const f: FileSummary = { ...files[3]!, branchCoverage: unknown('no report') };
    const d = buildFileDetail(snap, files.map((x) => (x.id === f.id ? f : x)), f.id)!;
    expect(d.history.map((s) => s.id)).toEqual(['complexity']);
  });
});

describe('file detail findings (Part 6 Y34)', () => {
  it('without a report the count is unknown with its reason and the list is empty, never 0', () => {
    const d = buildFileDetail(snap, files, files[0]!.id)!;
    expect(d.findingsCount).toMatchObject({ state: 'unknown', reason: FALLOW_NOT_ANALYSED });
    expect(d.findingsCount.value).toBeUndefined();
    expect(d.findings).toEqual([]);
  });
  it('lists the file\'s imported findings with their title and fingerprint, and counts them as collected', () => {
    const report = syntheticEvidenceReport(snap);
    const file = files[0]!;
    const d = buildFileDetail(snap, files, file.id, evidenceIndexFor(files, report, snap.snapshotId))!;
    const own = report.normalized.findings.filter((f) => f.path === file.path);
    expect(own.length).toBeGreaterThan(0);
    expect(d.findings.map((f) => f.id)).toEqual(own.map((f) => f.id));
    expect(d.findingsCount).toMatchObject({ state: 'collected', value: own.length, provenance: { source: 'fallow' } });
    expect(d.findings[0]).toMatchObject({ fingerprint: `${file.id}#${own[0]!.id}`, title: FINDING_TITLE[own[0]!.category] });
  });
  it('keeps the tool\'s own severity, and reads "unrated" where the tool gives none (Y35)', () => {
    const evidence = evidenceIndexFor(files, syntheticEvidenceReport(snap), snap.snapshotId);
    const d = buildFileDetail(snap, files, files[0]!.id, evidence)!;
    expect(d.findings.map((f) => [f.kind, f.severity])).toEqual([['complexity', 'critical'], ['duplication', 'unrated'], ['unused-exports', 'unrated']]);
  });
});
