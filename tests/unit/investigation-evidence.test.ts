// WP-04 IN14-IN17, IN34 (IP23): the evidence bundle, the generated uncertainties, the
// verification checklist and the facts an evidence block renders from — for a listed
// finding and for one a refresh no longer finds.
import { beforeEach, describe, expect, it } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { buildSnapshotFixture } from '../fixtures/snapshot-builder';
import { attachSyntheticReport, collectedEvidenceReport, snapshotWithPaths, syntheticEvidenceReport } from '../fixtures/evidence-report';
import { attachRelationsReport, RELATIONS_PATHS } from '../fixtures/relations-report';
import { fileSummariesFor } from '../../src/ui/read-models/file-summaries';
import { evidenceIndexFor } from '../../src/ui/read-models/evidence-index';
import { buildQualityModel } from '../../src/ui/read-models/findings';
import { cyclePathText } from '../../src/ui/read-models/relations';
import { buildInvestigationModel, type InvestigationRow } from '../../src/ui/read-models/investigation';
import {
  analysedAtOf, checklistFor, evidenceBundleFor, evidenceFactsFor, goneFactsFor, noteIdentityFor, uncertaintiesFor,
} from '../../src/ui/read-models/investigation-evidence';
import { EMPTY_NOTE_INDEX, type NoteLink } from '../../src/application/investigation/note-index';
import { FINDING_CATEGORIES } from '../../src/application/evidence/model';
import { RELATIONS_SCOPE_NOTE } from '../../src/ui/inspector-copy';
import {
  CHECKLIST_BY_KIND, NOTE_VOCABULARY, UNCERTAINTY_BY_KIND, UNCERTAINTY_IMPORT_TIME, UNCERTAINTY_LINE_MATCHED,
  UNCERTAINTY_LINE_NOT_CHECKED, UNCERTAINTY_LINE_STALE, UNCERTAINTY_NO_LINE, UNCERTAINTY_NOT_RATED, UNCERTAINTY_REPORT_STALE,
  UNCERTAINTY_STATIC,
} from '../../src/ui/audit-copy/investigation';

function rowOfKind(rows: readonly InvestigationRow[], kind: string): InvestigationRow {
  const row = rows.find((r) => r.kind === kind);
  if (!row) throw new Error(`test setup: no ${kind} row in this synthetic report`);
  return row;
}

describe('evidenceBundleFor — relations import cycle (IN14)', () => {
  beforeEach(() => { setActivePinia(createPinia()); });

  it('gives cyclePath and cycleFiles matching the real cycle, and related the other members', () => {
    const snap = snapshotWithPaths(RELATIONS_PATHS);
    const report = attachRelationsReport(snap);
    const files = fileSummariesFor(snap);
    const evidence = evidenceIndexFor(files, report, snap.snapshotId);
    const quality = buildQualityModel(files, evidence, []);
    const model = buildInvestigationModel(quality, EMPTY_NOTE_INDEX);
    const cycleRow = model.rows.find((r) => r.kind === 'cycle');
    if (!cycleRow || cycleRow.detail.kind !== 'cycle' || cycleRow.detail.cycleKind !== 'import') {
      throw new Error('test setup: no import-cycle row in the relations fixture');
    }
    const hops = cycleRow.detail.hops;
    expect(hops.length).toBeGreaterThan(0);

    const bundle = evidenceBundleFor(cycleRow, evidence, files);
    expect(bundle).not.toBeNull();
    expect(bundle!.cyclePath).toBe(cyclePathText(hops));
    expect(bundle!.cycleFiles).toEqual(hops.map((h) => h.from));
    expect(bundle!.related).toEqual(cycleRow.related);
  });
});

describe('analysedAtOf (IN10)', () => {
  it('gives collected.startedAt for a collected report, and importedAt for an imported one', () => {
    const snap = buildSnapshotFixture({ files: 4 });
    const imported = syntheticEvidenceReport(snap);
    expect(analysedAtOf(imported)).toBe(imported.importedAt);
    const collected = collectedEvidenceReport(snap);
    expect(analysedAtOf(collected)).toBe(collected.collected!.startedAt);
  });
});

describe('uncertaintiesFor (IN15, IN17)', () => {
  beforeEach(() => { setActivePinia(createPinia()); });

  it('leads with UNCERTAINTY_STATIC, adds report/relation/rating/import notes as they apply, and ends with the kind caveat', () => {
    const snap = buildSnapshotFixture({ files: 8 });
    const files = fileSummariesFor(snap);
    const report = attachSyntheticReport(snap);
    const currentEvidence = evidenceIndexFor(files, report, snap.snapshotId);
    const staleEvidence = evidenceIndexFor(files, report, 'snapshot:other');
    const quality = buildQualityModel(files, currentEvidence, []);
    const model = buildInvestigationModel(quality, EMPTY_NOTE_INDEX);

    const complexityRow = rowOfKind(model.rows, 'complexity');
    const complexityBundle = evidenceBundleFor(complexityRow, currentEvidence, files)!;
    expect(complexityBundle.state).toBe('current');
    const plain = uncertaintiesFor(complexityRow, complexityBundle, null);
    expect(plain.length).toBeGreaterThan(0);
    expect(plain[0]).toBe(UNCERTAINTY_STATIC);
    expect(plain).toContain(UNCERTAINTY_LINE_NOT_CHECKED);
    expect(plain).not.toContain(UNCERTAINTY_REPORT_STALE);
    expect(plain).not.toContain(RELATIONS_SCOPE_NOTE);
    expect(complexityRow.severity).not.toBe('unrated');
    expect(plain).not.toContain(UNCERTAINTY_NOT_RATED);
    expect(plain).toContain(UNCERTAINTY_IMPORT_TIME);
    expect(plain[plain.length - 1]).toBe(UNCERTAINTY_BY_KIND.complexity);

    for (const kind of ['cycle', 'boundary', 'unresolved-import'] as const) {
      const row = rowOfKind(model.rows, kind);
      const bundle = evidenceBundleFor(row, currentEvidence, files)!;
      const out = uncertaintiesFor(row, bundle, null);
      expect(out).toContain(RELATIONS_SCOPE_NOTE);
      expect(row.severity).toBe('unrated');
      expect(out).toContain(UNCERTAINTY_NOT_RATED);
      expect(out[out.length - 1]).toBe(UNCERTAINTY_BY_KIND[kind]);
    }

    const duplicationRow = rowOfKind(model.rows, 'duplication');
    const duplicationBundle = evidenceBundleFor(duplicationRow, currentEvidence, files)!;
    expect(uncertaintiesFor(duplicationRow, duplicationBundle, null)).not.toContain(RELATIONS_SCOPE_NOTE);

    const staleBundle = evidenceBundleFor(complexityRow, staleEvidence, files)!;
    expect(staleBundle.state).toBe('stale');
    expect(uncertaintiesFor(complexityRow, staleBundle, null)).toContain(UNCERTAINTY_REPORT_STALE);

    const collectedReport = collectedEvidenceReport(snap);
    const collectedEvidence = evidenceIndexFor(files, collectedReport, snap.snapshotId);
    const collectedQuality = buildQualityModel(files, collectedEvidence, []);
    const collectedModel = buildInvestigationModel(collectedQuality, EMPTY_NOTE_INDEX);
    const collectedRow = rowOfKind(collectedModel.rows, 'complexity');
    const collectedBundle = evidenceBundleFor(collectedRow, collectedEvidence, files)!;
    expect(uncertaintiesFor(collectedRow, collectedBundle, null)).not.toContain(UNCERTAINTY_IMPORT_TIME);
  });

  it('names an exact line match, a stale one, and no reported line', () => {
    const snap = buildSnapshotFixture({ files: 4 });
    const files = fileSummariesFor(snap);
    const report = attachSyntheticReport(snap);
    const evidence = evidenceIndexFor(files, report, snap.snapshotId);
    const quality = buildQualityModel(files, evidence, []);
    const model = buildInvestigationModel(quality, EMPTY_NOTE_INDEX);
    const row = rowOfKind(model.rows, 'complexity');
    expect(row.line).not.toBeNull();
    const bundle = evidenceBundleFor(row, evidence, files)!;

    const exact = uncertaintiesFor(row, bundle, { exact: true, line: row.line! });
    expect(exact).toContain(UNCERTAINTY_LINE_MATCHED(row.line!));

    const stale = uncertaintiesFor(row, bundle, { exact: false, failed: 'size', cause: 'changed' });
    expect(stale).toContain(UNCERTAINTY_LINE_STALE('size', 'changed', row.line));

    const noLine = uncertaintiesFor(row, bundle, { exact: false, failed: 'no-line' });
    expect(noLine).toContain(UNCERTAINTY_NO_LINE);
  });
});

describe('checklistFor (IN16)', () => {
  it('has 2-4 entries for every FINDING_CATEGORIES member', () => {
    expect(FINDING_CATEGORIES.length).toBeGreaterThan(0);
    expect(FINDING_CATEGORIES.every((k) => checklistFor(k).length >= 2 && checklistFor(k).length <= 4)).toBe(true);
  });
});

describe('no fabricated confidence (IN17)', () => {
  it('never shows a percentage, a safety claim, confidence, a score or a risk word', () => {
    const forbidden = /%|\bsafe to (delete|remove)\b|\bconfidence\b|\bscore\b|\brisk\b/i;
    const values: string[] = [
      ...Object.values(UNCERTAINTY_BY_KIND),
      ...Object.values(CHECKLIST_BY_KIND).flat(),
      ...Object.values(NOTE_VOCABULARY.headings),
      ...Object.values(NOTE_VOCABULARY.prompts),
      NOTE_VOCABULARY.labels.finding, NOTE_VOCABULARY.labels.kind, NOTE_VOCABULARY.labels.rule, NOTE_VOCABULARY.labels.detail,
      NOTE_VOCABULARY.labels.severity, NOTE_VOCABULARY.labels.location, NOTE_VOCABULARY.labels.related, NOTE_VOCABULARY.labels.cyclePath,
      NOTE_VOCABULARY.labels.provider, NOTE_VOCABULARY.labels.analysed, NOTE_VOCABULARY.labels.snapshot, NOTE_VOCABULARY.labels.evidence,
      NOTE_VOCABULARY.labels.notReported, NOTE_VOCABULARY.labels.line(12, null), NOTE_VOCABULARY.labels.line(null, null), NOTE_VOCABULARY.labels.more(3),
      UNCERTAINTY_STATIC, UNCERTAINTY_REPORT_STALE, UNCERTAINTY_NOT_RATED, UNCERTAINTY_IMPORT_TIME, UNCERTAINTY_LINE_NOT_CHECKED,
      UNCERTAINTY_NO_LINE, UNCERTAINTY_LINE_MATCHED(5),
      UNCERTAINTY_LINE_STALE('report', 'changed', 5), UNCERTAINTY_LINE_STALE('size', 'unknown', null),
      UNCERTAINTY_LINE_STALE('lines', 'changed', 5), UNCERTAINTY_LINE_STALE('modified', 'unknown', null),
      UNCERTAINTY_LINE_STALE('line-range', 'changed', 5),
    ];
    expect(values.length).toBeGreaterThan(0);
    expect(values.every((v) => !forbidden.test(v))).toBe(true);
  });
});

describe('noteIdentityFor / evidenceFactsFor / goneFactsFor (IP4, IP23, Y28)', () => {
  beforeEach(() => { setActivePinia(createPinia()); });

  it('identity sourcePath is the row’s anchor path; facts never leak a collected root or executable path', () => {
    const snap = buildSnapshotFixture({ files: 4 });
    const files = fileSummariesFor(snap);
    const report = collectedEvidenceReport(snap);
    const evidence = evidenceIndexFor(files, report, snap.snapshotId);
    const quality = buildQualityModel(files, evidence, []);
    const model = buildInvestigationModel(quality, EMPTY_NOTE_INDEX);
    expect(model.rows.length).toBeGreaterThan(0);
    const row = model.rows[0]!;

    const identity = noteIdentityFor(row, 'p1', snap.snapshotId);
    expect(identity.sourcePath).toBe(row.anchorPath);
    expect(identity.codebaseId).toBe('p1');
    expect(identity.findingId).toBe(row.id);

    const bundle = evidenceBundleFor(row, evidence, files)!;
    const uncertainties = uncertaintiesFor(row, bundle, null);
    const facts = evidenceFactsFor(row, bundle, uncertainties);
    const serialised = JSON.stringify(facts);
    expect(serialised).not.toContain(report.collected!.rootPath);
    expect(serialised).not.toContain(report.collected!.executablePath);
  });

  it('goneFactsFor marks the finding not reported, and never leaks a collected root or executable path', () => {
    const snap = buildSnapshotFixture({ files: 4 });
    const files = fileSummariesFor(snap);
    const report = collectedEvidenceReport(snap);
    const evidence = evidenceIndexFor(files, report, snap.snapshotId);
    const goneLink: NoteLink = {
      path: 'notes/gone.md', codebaseId: 'p1', fingerprint: 'gone.ts#UN-1', findingId: 'UN-1', sourcePath: 'gone.ts', snapshotId: snap.snapshotId, status: 'open',
    };
    const facts = goneFactsFor(goneLink, evidence, snap.snapshotId);
    expect(facts.reported).toBe(false);
    const serialised = JSON.stringify(facts);
    expect(serialised).not.toContain(report.collected!.rootPath);
    expect(serialised).not.toContain(report.collected!.executablePath);
  });
});
