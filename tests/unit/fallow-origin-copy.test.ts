// Part 7 Z26/Z27: every Part 6 string that named import as the only origin now takes the
// origin, defaulting to 'imported' so every Part 6 text is unchanged; the badge helper and
// the stale cause read the report.
import { describe, expect, it } from 'vitest';
import type { EvidenceReport } from '../../src/application/evidence/model';
import { evidenceBadgeFor, evidenceIndexFor, staleCauseOf } from '../../src/ui/read-models/evidence-index';
import { fileSummariesFor } from '../../src/ui/read-models/file-summaries';
import { buildSourcesModel } from '../../src/ui/read-models/sources';
import { findingsCsv, buildQualityModel } from '../../src/ui/read-models/findings';
import {
  EVIDENCE_BADGE, FALLOW_CARD_NONE, FALLOW_DIALOG_INTRO, FALLOW_NOT_ANALYSED, FALLOW_NOT_ANALYSED_BODY, FALLOW_PROVENANCE_DETAIL,
  FALLOW_REPLACE_NOTE, FALLOW_SOME_NOT_ANALYSED, FALLOW_SOURCE, FINDING_DIALOG_PROVIDER_VALUE, LENS_SUBTITLE, OVERVIEW_FALLOW_SOURCE,
  QUALITY_CARD_OPEN_CAPTION_STALE, QUALITY_FOOTNOTE, REPORT_EVIDENCE_TEXT, SOURCES_CALLOUT, SOURCES_PROVIDER,
} from '../../src/ui/inspector-copy';
import { buildSnapshotFixture } from '../fixtures/snapshot-builder';
import { collectedEvidenceReport, syntheticEvidenceReport } from '../fixtures/evidence-report';
import { initialScanLifecycleState } from '../../src/application/run-state';

const snap = buildSnapshotFixture({ files: 6, repositoryId: 'p1' });

describe('the badge (Z26)', () => {
  it('reads four ways, and adds "Untested version" for an untested collected run', () => {
    expect(EVIDENCE_BADGE('3.27.0', 'imported')).toBe('fallow 3.27.0 · Imported · Unverified source match');
    expect(EVIDENCE_BADGE('3.27.0', 'stale')).toBe('fallow 3.27.0 · Stale · Unverified source match');
    expect(EVIDENCE_BADGE('3.27.0', 'collected', 'collected')).toBe('fallow 3.27.0 · Collected · Verified source match');
    expect(EVIDENCE_BADGE('3.27.0', 'stale', 'collected')).toBe('fallow 3.27.0 · Stale · Source verified when collected');
    expect(EVIDENCE_BADGE('3.28.0', 'collected', 'collected', true)).toBe('fallow 3.28.0 · Collected · Verified source match · Untested version');
  });

  // Polish 5b fix round: through evidenceBadgeFor, the one exported badge helper (E9).
  it('evidenceBadgeFor takes the origin and the untested flag from the report', () => {
    const files = fileSummariesFor(snap);
    const badge = (report: EvidenceReport, snapshotId = snap.snapshotId) => evidenceBadgeFor(evidenceIndexFor(files, report, snapshotId));
    expect(badge(syntheticEvidenceReport(snap))).toEqual({ version: '3.27.0', state: 'imported', origin: 'imported', untested: false });
    expect(badge(collectedEvidenceReport(snap, false))).toEqual({ version: '3.27.0', state: 'collected', origin: 'collected', untested: true });
    expect(badge(collectedEvidenceReport(snap), 'another')).toEqual({ version: '3.27.0', state: 'stale', origin: 'collected', untested: false });
  });

  it('keeps evidenceBadgeOf module-private (no dead export)', async () => {
    expect(Object.keys(await import('../../src/ui/read-models/evidence-index'))).not.toContain('evidenceBadgeOf');
  });

  it('staleCauseOf says why evidence is stale', () => {
    expect(staleCauseOf(syntheticEvidenceReport(snap, { snapshotId: 'older' }))).toBe('snapshot');
    expect(staleCauseOf({ ...collectedEvidenceReport(snap), staleReason: 'failed-run' })).toBe('failed-run');
  });
});

describe('origin-aware copy (Z27, spec §2)', () => {
  it('keeps every Part 6 text for an imported report', () => {
    expect(FALLOW_PROVENANCE_DETAIL('3.27.0')).toBe('imported report 3.27.0');
    expect(OVERVIEW_FALLOW_SOURCE('3.27.0')).toBe('Imported fallow 3.27.0 report');
    expect(FALLOW_SOURCE('3.27.0')).toBe('Imported report · fallow 3.27.0');
    expect(FINDING_DIALOG_PROVIDER_VALUE('3.27.0', 'today')).toBe('fallow 3.27.0 · imported report, today');
    expect(LENS_SUBTITLE(5, 2)).toBe('5 findings · 2 files · imported evidence');
    expect(FALLOW_REPLACE_NOTE('today')).toBe('Attaching replaces the report imported today.');
  });

  it('says "collected" for a collected run', () => {
    expect(FALLOW_PROVENANCE_DETAIL('3.27.0', 'collected')).toBe('collected run 3.27.0');
    expect(OVERVIEW_FALLOW_SOURCE('3.27.0', 'collected')).toBe('Collected by fallow 3.27.0');
    expect(FALLOW_SOURCE('3.27.0', 'collected')).toBe('Collected run · fallow 3.27.0');
    expect(FINDING_DIALOG_PROVIDER_VALUE('3.27.0', 'today', 'collected')).toBe('fallow 3.27.0 · collected run, today');
    expect(LENS_SUBTITLE(5, 2, 'collected')).toBe('5 findings · 2 files · collected evidence');
    expect(FALLOW_REPLACE_NOTE('today', 'collected')).toBe('Attaching replaces the findings collected today.');
  });

  it('rewrites the strings that assumed import was the only way in', () => {
    expect(FALLOW_NOT_ANALYSED).toBe('Not analysed. No fallow evidence covers this.');
    expect(FALLOW_SOME_NOT_ANALYSED).toBe('Some finding categories were not analysed in the attached fallow evidence.');
    expect(FALLOW_NOT_ANALYSED_BODY).toBe('No fallow evidence is attached to this codebase, so its findings are unknown, not zero. Import a report or run an installed fallow to see them. Findings are kept for this session only.');
    expect(FALLOW_CARD_NONE).toBe('No findings attached. Imported and collected findings are kept for this session only, so after a restart you import or run again.');
    expect(FALLOW_DIALOG_INTRO).toBe('Keep exploring the structural city while you add analysis. Import a fallow JSON report, or run a fallow that is already installed.');
    expect(QUALITY_CARD_OPEN_CAPTION_STALE(7, 2)).toBe('7 findings in the attached evidence · 2 decided');
    expect(QUALITY_FOOTNOTE).toBe('Findings come from fallow, imported as a report or collected by a run you started, and are kept for this session only. Decisions are saved with this codebase’s review state in the plugin’s own data; the repository is never changed.');
    expect(REPORT_EVIDENCE_TEXT).toBe('File inventory collected by the built-in read-only scan. Static findings come from fallow evidence (an imported report or a run you started) when one is attached for this session, and read Not analysed otherwise. History, coverage, import edges and packages are sample data. Mutation, runtime and secret scanning were not collected.');
    expect(SOURCES_CALLOUT).toBe('The built-in read-only inventory is always available. fallow findings come from a report you import or a run of an installed fallow you start. Every other signal is sample data or not collected.');
    expect(SOURCES_PROVIDER.fallow?.description).toBe('Complexity, duplication and unused exports from a fallow JSON report you import, or from a run of an installed fallow you review and start. Nothing is installed; findings are kept for this session only.');
  });
});

describe('the read models carry the origin (Z27)', () => {
  it('the evidence index marks collected values with the collected provenance detail', () => {
    const index = evidenceIndexFor(fileSummariesFor(snap), collectedEvidenceReport(snap), snap.snapshotId);
    expect(index.totals.findings).toMatchObject({ state: 'collected', provenance: { source: 'fallow', detail: 'collected run 3.27.0' } });
  });

  it('the fallow card source and the CSV provenance say collected', () => {
    const card = buildSourcesModel(snap, initialScanLifecycleState().run, { state: 'current', version: '3.27.0', origin: 'collected' }).providers.find((p) => p.id === 'fallow');
    expect(card?.source).toBe('Collected run · fallow 3.27.0');
    const index = evidenceIndexFor(fileSummariesFor(snap), collectedEvidenceReport(snap), snap.snapshotId);
    const csv = findingsCsv(buildQualityModel(fileSummariesFor(snap), index, []).findings, index);
    expect(csv).toContain('fallow 3.27.0 collected');
  });
});
