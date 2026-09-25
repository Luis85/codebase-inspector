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
import { FINDING_CATEGORIES, type EvidenceReport } from '../../src/application/evidence/model';
import { RELATIONS_SCOPE_NOTE } from '../../src/ui/inspector-copy';
import {
  CHECKLIST_BY_KIND, NOTE_ANALYSED_AT_UNKNOWN, NOTE_EVIDENCE_STATE_TEXT, NOTE_PROVIDER_UNKNOWN, NOTE_VOCABULARY, UNCERTAINTY_BY_KIND,
  UNCERTAINTY_IMPORT_TIME, UNCERTAINTY_LINE_MATCHED, UNCERTAINTY_LINE_NOT_CHECKED, UNCERTAINTY_LINE_STALE, UNCERTAINTY_NO_LINE,
  UNCERTAINTY_NOT_RATED, UNCERTAINTY_REPORT_FAILED_RUN, UNCERTAINTY_REPORT_STALE, UNCERTAINTY_STATIC,
} from '../../src/ui/audit-copy/investigation';

const byUnit = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

function rowOfKind(rows: readonly InvestigationRow[], kind: string): InvestigationRow {
  const row = rows.find((r) => r.kind === kind);
  if (!row) throw new Error(`test setup: no ${kind} row in this synthetic report`);
  return row;
}

describe('evidenceBundleFor — relations import cycle (IN14)', () => {
  beforeEach(() => { setActivePinia(createPinia()); });

  it('gives cyclePath and cycleFiles matching the real cycle, and related the cycle’s own members minus the anchor (fix round 1, review item 10)', () => {
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

    // Derived independently from the cycle's own `members` (not from `cycleRow.related`
    // itself, which `bundle.related` is only a copy of — that comparison would be
    // tautological): the expected related set is every cycle member except the anchor.
    const expectedRelated = [...cycleRow.detail.members].filter((p) => p !== cycleRow.anchorPath).sort(byUnit);
    expect([...bundle!.related].sort(byUnit)).toEqual(expectedRelated);
    expect(expectedRelated.length).toBeGreaterThan(0);

    // unmatchedRelated: a related path missing from the `files` list evidenceBundleFor is
    // handed (independent of what `evidence` itself was built from) is unmatched.
    const missingPath = expectedRelated[0]!;
    const filesWithoutOne = files.filter((f) => f.path !== missingPath);
    const bundleMissingOne = evidenceBundleFor(cycleRow, evidence, filesWithoutOne)!;
    expect(bundleMissingOne.unmatchedRelated.has(missingPath)).toBe(true);
    expect(bundleMissingOne.unmatchedRelated.size).toBe(1);
    // The full files list (used above) matches every related member.
    expect(bundle!.unmatchedRelated.size).toBe(0);
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

  // Fix round 1, review item 6: a finding with no line at all must read UNCERTAINTY_NO_LINE
  // even with no verdict yet (before a preview is read) — not UNCERTAINTY_LINE_NOT_CHECKED,
  // which implies there is a line a preview could still check.
  it('gives UNCERTAINTY_NO_LINE, not "not checked", for a finding with no line and no verdict', () => {
    const snap = buildSnapshotFixture({ files: 8 });
    const files = fileSummariesFor(snap);
    const report = attachSyntheticReport(snap);
    const evidence = evidenceIndexFor(files, report, snap.snapshotId);
    const quality = buildQualityModel(files, evidence, []);
    const model = buildInvestigationModel(quality, EMPTY_NOTE_INDEX);
    const anyRow = rowOfKind(model.rows, 'complexity');
    const noLineRow: InvestigationRow = { ...anyRow, line: null };
    const bundle = evidenceBundleFor(anyRow, evidence, files)!;
    const out = uncertaintiesFor(noLineRow, bundle, null);
    expect(out).toContain(UNCERTAINTY_NO_LINE);
    expect(out).not.toContain(UNCERTAINTY_LINE_NOT_CHECKED);
  });

  // Fix round 1, review item 7: the line verdict's own 'report' message already says the
  // report is stale ("The report is stale, so line N may have moved."), so the standalone
  // stale-report statement must not also appear — one statement about one stale report.
  it('emits one statement about a stale report when the line verdict already names it', () => {
    const snap = buildSnapshotFixture({ files: 8 });
    const files = fileSummariesFor(snap);
    const report = attachSyntheticReport(snap);
    const staleEvidence = evidenceIndexFor(files, report, 'snapshot:other');
    const quality = buildQualityModel(files, staleEvidence, []);
    const model = buildInvestigationModel(quality, EMPTY_NOTE_INDEX);
    const row = rowOfKind(model.rows, 'complexity');
    const bundle = evidenceBundleFor(row, staleEvidence, files)!;
    expect(bundle.state).toBe('stale');
    const out = uncertaintiesFor(row, bundle, { exact: false, failed: 'report', cause: 'changed' });
    expect(out).toContain(UNCERTAINTY_LINE_STALE('report', 'changed', row.line));
    expect(out).not.toContain(UNCERTAINTY_REPORT_STALE);
    expect(out).not.toContain(UNCERTAINTY_REPORT_FAILED_RUN);
    // Sanity: a DIFFERENT failed check does not suppress the standalone stale statement.
    const otherCheck = uncertaintiesFor(row, bundle, { exact: false, failed: 'size', cause: 'changed' });
    expect(otherCheck).toContain(UNCERTAINTY_REPORT_STALE);
  });

  // WP-04 E10 (fix round 1, review item 2): staleCauseOf distinguishes a snapshot mismatch
  // from a report that belongs to this snapshot but whose run failed (evidence-index.ts
  // build(): `staleReason === undefined ? 'current' : 'stale'`).
  it('names the failed-run cause separately from a snapshot mismatch', () => {
    const snap = buildSnapshotFixture({ files: 8 });
    const files = fileSummariesFor(snap);
    const report = attachSyntheticReport(snap);

    const failedRunReport: EvidenceReport = { ...report, staleReason: 'failed-run' };
    const failedRunEvidence = evidenceIndexFor(files, failedRunReport, snap.snapshotId);
    const failedRunQuality = buildQualityModel(files, failedRunEvidence, []);
    const failedRunModel = buildInvestigationModel(failedRunQuality, EMPTY_NOTE_INDEX);
    const failedRunRow = rowOfKind(failedRunModel.rows, 'complexity');
    const failedRunBundle = evidenceBundleFor(failedRunRow, failedRunEvidence, files)!;
    expect(failedRunBundle.state).toBe('stale');
    expect(failedRunBundle.staleCause).toBe('failed-run');
    const failedRunOut = uncertaintiesFor(failedRunRow, failedRunBundle, null);
    expect(failedRunOut).toContain(UNCERTAINTY_REPORT_FAILED_RUN);
    expect(failedRunOut).not.toContain(UNCERTAINTY_REPORT_STALE);

    const mismatchEvidence = evidenceIndexFor(files, report, 'snapshot:other');
    const mismatchQuality = buildQualityModel(files, mismatchEvidence, []);
    const mismatchModel = buildInvestigationModel(mismatchQuality, EMPTY_NOTE_INDEX);
    const mismatchRow = rowOfKind(mismatchModel.rows, 'complexity');
    const mismatchBundle = evidenceBundleFor(mismatchRow, mismatchEvidence, files)!;
    expect(mismatchBundle.staleCause).toBe('snapshot');
    const mismatchOut = uncertaintiesFor(mismatchRow, mismatchBundle, null);
    expect(mismatchOut).toContain(UNCERTAINTY_REPORT_STALE);
    expect(mismatchOut).not.toContain(UNCERTAINTY_REPORT_FAILED_RUN);
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
      UNCERTAINTY_STATIC, UNCERTAINTY_REPORT_STALE, UNCERTAINTY_REPORT_FAILED_RUN, UNCERTAINTY_NOT_RATED, UNCERTAINTY_IMPORT_TIME,
      UNCERTAINTY_LINE_NOT_CHECKED, UNCERTAINTY_NO_LINE, UNCERTAINTY_LINE_MATCHED(5),
      UNCERTAINTY_LINE_STALE('report', 'changed', 5), UNCERTAINTY_LINE_STALE('size', 'unknown', null),
      UNCERTAINTY_LINE_STALE('lines', 'changed', 5), UNCERTAINTY_LINE_STALE('modified', 'unknown', null),
      UNCERTAINTY_LINE_STALE('line-range', 'changed', 5),
      NOTE_EVIDENCE_STATE_TEXT.current, NOTE_EVIDENCE_STATE_TEXT.stale, NOTE_PROVIDER_UNKNOWN, NOTE_ANALYSED_AT_UNKNOWN,
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
    expect(facts.reported).toBe(true);
    // Fix round 1, review item 9: the block's own two-word text ("Collected" here, since
    // this report is current), never the code word ('current'/'stale') bundle.state carries.
    if (facts.reported) {
      expect(facts.evidenceState).toBe(NOTE_EVIDENCE_STATE_TEXT[bundle.state]);
      expect(facts.evidenceState).toBe('Collected');
    }
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

  // Fix round 1, review item 8: with no report attached at all, provider/analysedAt must
  // read copy words, never a hard-coded 'fallow' guess or a blank rendered value.
  it('goneFactsFor uses copy words for provider and analysed-at when no report is attached', () => {
    const snap = buildSnapshotFixture({ files: 4 });
    const files = fileSummariesFor(snap);
    const evidence = evidenceIndexFor(files, null, snap.snapshotId);
    expect(evidence.report).toBeNull();
    const goneLink: NoteLink = {
      path: 'notes/gone.md', codebaseId: 'p1', fingerprint: 'gone.ts#UN-1', findingId: 'UN-1', sourcePath: 'gone.ts', snapshotId: snap.snapshotId, status: 'open',
    };
    const facts = goneFactsFor(goneLink, evidence, snap.snapshotId);
    expect(facts.reported).toBe(false);
    if (!facts.reported) {
      expect(facts.provider).toBe(NOTE_PROVIDER_UNKNOWN);
      expect(facts.analysedAt).toBe(NOTE_ANALYSED_AT_UNKNOWN);
      expect(facts.provider).not.toBe('fallow');
      expect(facts.analysedAt).not.toBe('');
    }
  });

  // Fix round 1, review item 8: with a stale report, the stale uncertainty must be
  // included, same as it would be for a listed finding.
  it('goneFactsFor includes the stale uncertainty when the current report is stale', () => {
    const snap = buildSnapshotFixture({ files: 4 });
    const files = fileSummariesFor(snap);
    const report = attachSyntheticReport(snap);
    const staleEvidence = evidenceIndexFor(files, report, 'snapshot:other');
    expect(staleEvidence.state).toBe('stale');
    const goneLink: NoteLink = {
      path: 'notes/gone.md', codebaseId: 'p1', fingerprint: 'gone.ts#UN-1', findingId: 'UN-1', sourcePath: 'gone.ts', snapshotId: snap.snapshotId, status: 'open',
    };
    const facts = goneFactsFor(goneLink, staleEvidence, snap.snapshotId);
    expect(facts.uncertainties).toContain(UNCERTAINTY_REPORT_STALE);
  });
});
