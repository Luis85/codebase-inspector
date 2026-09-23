// Part 6 Y30/Y33/Y34: the evidence index, which every findings count reads.
import { beforeEach, describe, expect, it } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { computeLayout } from '../../src/domain/layout/layout';
import { InMemoryEvidenceStore } from '../../src/adapters/storage/in-memory-evidence-store';
import { evidenceBadgeFor, evidenceIndexFor } from '../../src/ui/read-models/evidence-index';
import { fileSummariesFor } from '../../src/ui/read-models/file-summaries';
import { buildOverviewModel } from '../../src/ui/read-models/overview';
import { buildCitySummary } from '../../src/ui/read-models/city-summary';
import type { MetricValue } from '../../src/ui/evidence';
import { useReadModels } from '../../src/ui/read-models/use-read-models';
import { useCityStore } from '../../src/ui/stores/city-store';
import { useEvidenceStore } from '../../src/ui/stores/evidence-store';
import { COPY_16, FALLOW_NOT_ANALYSED, FALLOW_SOME_NOT_ANALYSED, NO_FILES_REASON, OVERVIEW_FINDINGS_CAPTION } from '../../src/ui/inspector-copy';
import { buildQualityModel } from '../../src/ui/read-models/findings';
import type { FindingDisposition } from '../../src/ui/stores/ports/review-repository';
import { buildSnapshotFixture } from '../fixtures/snapshot-builder';
import { attachSyntheticReport, syntheticEvidenceReport } from '../fixtures/evidence-report';

const snap = buildSnapshotFixture({ files: 20, directories: 2 });
const files = fileSummariesFor(snap);
const report = syntheticEvidenceReport(snap);
const FALLOW = { source: 'fallow', detail: 'imported report 3.27.0' };
const at = (i: number) => files[i]!;

describe('evidence index without a report (Y33)', () => {
  it('is state none, and every count is unknown with FALLOW_NOT_ANALYSED, never 0', () => {
    const index = evidenceIndexFor(files, null, snap.snapshotId);
    expect(index.state).toBe('none');
    expect(index.report).toBeNull();
    const own = index.perFile(at(0).id);
    expect(Object.keys(own)).toEqual(['findings', 'high', 'unused']);
    const values = [index.totals.findings, index.totals.high, index.totals.unused, own.findings, own.high, own.unused];
    expect(values).toHaveLength(6);
    for (const v of values) {
      expect(v).toMatchObject({ state: 'unknown', reason: FALLOW_NOT_ANALYSED });
      expect(v.value).toBeUndefined();
    }
    expect([index.byFile.size, index.matchedFindings, index.matchedFiles, index.unmatchedPaths.length]).toEqual([0, 0, 0, 0]);
    expect(index.category('complexity')).toBe('not-analysed');
  });
});

describe('evidence index with a current report (Y34)', () => {
  const index = evidenceIndexFor(files, report, snap.snapshotId);
  const all = report.normalized.findings;

  it('counts every resolved finding as collected fallow evidence', () => {
    expect(index.state).toBe('current');
    expect(index.report).toBe(report);
    expect(all.length).toBeGreaterThan(0);
    expect(index.totals.findings).toEqual({ state: 'collected', value: all.length, provenance: FALLOW });
    expect(index.totals.unused).toEqual({ state: 'collected', value: all.filter((f) => f.category === 'unused-exports').length, provenance: FALLOW });
    expect([index.matchedFindings, index.matchedFiles, index.unmatchedPaths.length]).toEqual([all.length, files.length, 0]);
    expect(index.category('duplication')).toBe('analysed');
  });

  it('groups the findings per file, in report order', () => {
    const own = all.filter((f) => f.path === at(4).path);
    expect(own.length).toBeGreaterThan(1);
    expect(index.byFile.get(at(4).id)).toEqual(own);
    expect(index.perFile(at(4).id).findings).toEqual({ state: 'collected', value: own.length, provenance: FALLOW });
  });

  it('`high` counts the critical and high severities only (files 0, 2 and 4 are critical, high and moderate)', () => {
    expect([0, 2, 4, 1].map((i) => index.perFile(at(i).id).high.value)).toEqual([1, 1, 0, 0]);
    expect(index.totals.high.value).toBe(all.filter((f) => f.severity === 'critical' || f.severity === 'high').length);
  });

  it('a file the report covers but found nothing in is a reported, collected 0', () => {
    const fewer = syntheticEvidenceReport(buildSnapshotFixture({ files: 10, directories: 2 }));
    const partial = evidenceIndexFor(files, fewer, snap.snapshotId);
    expect(partial.state).toBe('current');
    expect(partial.perFile(at(15).id).findings).toEqual({ state: 'collected', value: 0, provenance: FALLOW });
  });

  it('drops a finding whose path is not in the snapshot and lists the path as unmatched (Y26)', () => {
    const withGone = evidenceIndexFor(files, syntheticEvidenceReport(snap, { unmatchedPaths: ['lib/gone.ts'] }), snap.snapshotId);
    expect(withGone.unmatchedPaths).toEqual(['lib/gone.ts']);
    expect(withGone.matchedFindings).toBe(all.length);
    expect([...withGone.byFile.values()].flat().some((f) => f.path === 'lib/gone.ts')).toBe(false);
  });

  it('a category the report did not analyse is unknown, and the total says it is partial (a dead-code report)', () => {
    const deadCode = syntheticEvidenceReport(snap, { kind: 'dead-code' });
    const dc = evidenceIndexFor(files, deadCode, snap.snapshotId);
    expect(dc.category('complexity')).toBe('not-analysed');
    expect(dc.totals.high).toMatchObject({ state: 'unknown', reason: FALLOW_NOT_ANALYSED });
    expect(dc.totals.unused.state).toBe('collected');
    expect(dc.totals.findings).toMatchObject({ state: 'partial', value: deadCode.normalized.findings.length, reason: FALLOW_SOME_NOT_ANALYSED });
    // Fix round 1 (E37): the Overview fallow row does not claim full coverage for a partial report.
    expect(buildOverviewModel(snap, files, undefined, dc).coverage.find((r) => r.id === 'fallow')?.state).toBe('partial');
    expect(buildOverviewModel(snap, files, undefined, index).coverage.find((r) => r.id === 'fallow')?.state).toBe('collected');
  });

  it('an id that is not one of the files is unknown, never a collected 0 (fix round 1)', () => {
    const own = index.perFile('not-a-file-id');
    expect(Object.keys(own)).toEqual(['findings', 'high', 'unused']);
    for (const v of Object.values(own) as MetricValue[]) {
      expect(v).toMatchObject({ state: 'unknown', reason: FALLOW_NOT_ANALYSED });
      expect(v.value).toBeUndefined();
    }
  });

  it('the Overview findings card and the city unused card read the index totals (fix round 1)', () => {
    const findingsCard = buildOverviewModel(snap, files, undefined, index).cards.find((c) => c.id === 'findings')!;
    expect(findingsCard.value).toEqual(index.totals.findings);   // E48 I1: the open count, the total while nothing is decided
    expect(index.totals.high.value).toBeGreaterThan(0);
    expect(findingsCard.caption).toBe(`${index.totals.high.value} critical or high severity`);
    const unused = buildCitySummary(files, undefined, index).find((c) => c.id === 'unused')!.value;
    expect(unused).toBe(index.totals.unused);
    expect(unused.value).not.toBe(index.totals.findings.value);
  });

  it('with no files every total is unknown with its reason, never 0', () => {
    const empty = buildSnapshotFixture({ files: 0 });
    const none = evidenceIndexFor(fileSummariesFor(empty), syntheticEvidenceReport(empty), empty.snapshotId);
    const totals = Object.values(none.totals);
    expect(totals).toHaveLength(3);
    for (const v of totals) expect(v).toMatchObject({ state: 'unknown', reason: NO_FILES_REASON });
  });
});

describe('stale evidence (Y30)', () => {
  it('re-resolves a report imported against another snapshot; every value is stale, and so is the Overview row', () => {
    const newer = { ...buildSnapshotFixture({ files: 12, directories: 2 }), snapshotId: 'snapshot-newer' };
    const newerFiles = fileSummariesFor(newer);
    const index = evidenceIndexFor(newerFiles, report, newer.snapshotId);
    expect(index.state).toBe('stale');
    expect(index.matchedFiles).toBe(12);
    expect(index.unmatchedPaths).toHaveLength(8);
    expect(index.totals.findings).toMatchObject({ state: 'stale', value: index.matchedFindings, provenance: FALLOW });
    expect(buildOverviewModel(newer, newerFiles, undefined, index).coverage.find((r) => r.id === 'fallow')?.state).toBe('stale');
  });

  it('a stale report that analysed only some categories has a partial total, and so does the row (E37: partial is weaker than stale)', () => {
    const stale = evidenceIndexFor(files, syntheticEvidenceReport(snap, { kind: 'dead-code', snapshotId: 'an-older-snapshot' }), snap.snapshotId);
    expect(stale.state).toBe('stale');
    expect(stale.totals.findings).toMatchObject({ state: 'partial', reason: FALLOW_SOME_NOT_ANALYSED });
    expect(stale.totals.unused.state).toBe('stale');
    expect(buildOverviewModel(snap, files, undefined, stale).coverage.find((r) => r.id === 'fallow')?.state).toBe('partial');
  });

  it('COPY_16 says which date the evidence is from', () => {
    expect(COPY_16('Sep 23, 2026')).toBe('Showing evidence from Sep 23, 2026. It is not current for this snapshot.');
  });
});

describe('evidence index memo (Y30, E53)', () => {
  it('is one index per (files, report), rebuilt for another report or another snapshot', () => {
    const first = evidenceIndexFor(files, report, snap.snapshotId);
    expect(evidenceIndexFor(files, report, snap.snapshotId)).toBe(first);
    expect(evidenceIndexFor(files, syntheticEvidenceReport(snap), snap.snapshotId)).not.toBe(first);
    expect(evidenceIndexFor(files, null, snap.snapshotId)).toBe(evidenceIndexFor(files, null, snap.snapshotId));
    const other = buildSnapshotFixture({ files: 20, directories: 2 });
    expect(evidenceIndexFor(fileSummariesFor(other), report, other.snapshotId)).not.toBe(first);
  });
});

describe('evidence through useReadModels (E53, R7)', () => {
  beforeEach(() => { setActivePinia(createPinia()); });

  it('each leaf reads its own bound evidence, even on the same snapshot; the Overview fallow row follows it', () => {
    const layout = computeLayout(snap);
    const leafA = createPinia();
    const leafB = createPinia();
    setActivePinia(leafA);
    useCityStore().setCity(snap, layout);
    attachSyntheticReport(snap);
    const a = useReadModels();
    setActivePinia(leafB);
    useCityStore().setCity(snap, layout);
    const b = useReadModels();
    expect(a.evidence.value.state).toBe('current');
    expect(a.quality.value.findings.length).toBeGreaterThan(0);
    expect(a.overview.value!.coverage.find((r) => r.id === 'fallow')?.state).toBe('collected');
    expect(b.evidence.value.state).toBe('none');
    expect(b.quality.value.findings).toEqual([]);
    expect(b.overview.value!.coverage.find((r) => r.id === 'fallow')?.state).toBe('unknown');
  });

  it('never shows a report bound to another codebase', () => {
    useCityStore().setCity(snap, computeLayout(snap));
    const evidence = useEvidenceStore();
    evidence.setRepository(new InMemoryEvidenceStore());
    evidence.bindRepository('repo-other');
    expect(evidence.attach(report)).toBe(true);
    expect(useReadModels().evidence.value.state).toBe('none');
  });
});

describe('stale after a failed run (Part 7 Z23)', () => {
  it('a report marked after a failed run is stale even for its own snapshot, and keeps its counts', () => {
    const current = evidenceIndexFor(files, report, snap.snapshotId);
    const marked = evidenceIndexFor(files, { ...report, staleReason: 'failed-run' }, snap.snapshotId);
    expect(current.state).toBe('current');
    expect(marked.state).toBe('stale');
    expect(marked.matchedFindings).toBe(current.matchedFindings);
    expect(marked.totals.findings).toMatchObject({ state: 'stale', value: current.matchedFindings });
  });
});

describe('Polish E2: the Overview caption counts open findings only', () => {
  it('a dismissed critical finding leaves the caption as it leaves the count', () => {
    const index = evidenceIndexFor(files, report, snap.snapshotId);
    const highs = buildQualityModel(files, index, []).findings.filter((f) => f.severity === 'critical' || f.severity === 'high');
    expect(highs).toHaveLength(7);
    const dismissed: FindingDisposition[] = [{ fingerprint: highs[0]!.fingerprint, status: 'dismissed', reason: 'accepted', decidedAt: '2026-09-23T10:00:00.000Z' }];
    const card = buildOverviewModel(snap, files, undefined, index, buildQualityModel(files, index, dismissed)).cards.find((c) => c.id === 'findings')!;
    expect(card.caption).toBe(OVERVIEW_FINDINGS_CAPTION('6'));
  });
});

describe('Polish E9: one badge helper for every screen', () => {
  it('Polish E9: evidenceBadgeFor is null without a report and stale for another snapshot\'s', () => {
    expect(evidenceBadgeFor(evidenceIndexFor(files, null, snap.snapshotId))).toBeNull();
    expect(evidenceBadgeFor(evidenceIndexFor(files, report, 'another'))?.state).toBe('stale');
    expect(evidenceBadgeFor(evidenceIndexFor(files, report, snap.snapshotId))?.state).toBe('imported');
  });
});
