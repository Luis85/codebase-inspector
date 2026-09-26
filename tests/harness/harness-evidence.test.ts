// Part 6 §5: ?report=demo and ?fallow=review. The harness report is the shared fixture's
// syntheticFallowJson (R5), cut down to ten harness files, run through the REAL reader and
// builder and attached through the real evidence store. So every capture that shows it says
// "fallow · imported report" because it took the real path. This file keeps that path alive
// under the ordinary suite, the way harness.test.ts keeps the page itself alive.
import { beforeEach, describe, expect, it } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
// Side-effect import: installs the createDiv/createEl helpers real Obsidian patches onto
// HTMLElement (polish QF6), which the H5 case builds its details element with.
import '../mocks/obsidian';
import { parseFallowReportText } from '../../src/application/evidence/read-fallow-report';
import { resolveFindings } from '../../src/application/evidence/resolve-findings';
import { InMemoryEvidenceStore } from '../../src/adapters/storage/in-memory-evidence-store';
import { useEvidenceStore } from '../../src/ui/stores/evidence-store';
import { evidenceIndexFor } from '../../src/ui/read-models/evidence-index';
import { fileSummariesFor } from '../../src/ui/read-models/file-summaries';
import { buildQualityModel } from '../../src/ui/read-models/findings';
import { buildInvestigationModel } from '../../src/ui/read-models/investigation';
import { previewRequestFor, locationInputsFor } from '../../src/ui/read-models/investigation-evidence';
import { relationModelFor } from '../../src/ui/read-models/relations';
import { EMPTY_NOTE_INDEX } from '../../src/application/investigation/note-index';
import { locationVerdict } from '../../src/application/investigation/stale-location';
import { ALL_ANALYSED, SYNTHETIC_VERSION } from '../fixtures/evidence-report';
import { FALLOW_RUN_ARGS } from '../../src/application/analysis/fallow-invocation';
import { fallowRunBannerOf } from '../../src/ui/read-models/fallow-run';
import {
  DEMO_FALLOW_FILE_NAME, DEMO_UNMATCHED_PATH, HARNESS_SYNTHETIC_FOOTER, HARNESS_BINDING,
  completedAnalysisState, demoCollectedReport, demoEvidenceReport, demoFallowReportText, demoInvestigation,
  demoRelationsAnchorPath, demoRunReview, failedAnalysisState, filePathsOf, openFailureLog, runningAnalysisState,
} from './seed';
import { harnessSnapshot } from './fixture';
import type { CodebaseSnapshot } from '../../src/domain/model';
import type { InvestigationRow } from '../../src/ui/read-models/investigation';
import type { EvidenceIndex } from '../../src/ui/read-models/evidence-index';

// WP-04 Task 17: the same read-model pipeline `demoInvestigation` itself builds its row
// from — so a test that pins "the first finding" can never silently drift from what the
// real Investigate screen would show first.
function firstRow(snapshot: CodebaseSnapshot): { row: InvestigationRow; evidence: EvidenceIndex } {
  const files = fileSummariesFor(snapshot);
  const evidence = evidenceIndexFor(files, demoEvidenceReport(snapshot), snapshot.snapshotId);
  const model = buildInvestigationModel(buildQualityModel(files, evidence, []), EMPTY_NOTE_INDEX);
  const row = model.rows[0];
  if (row === undefined) throw new Error('unreachable: the demo report always has findings');
  return { row, evidence };
}

describe('the harness fallow report (?report=demo)', () => {
  it('is a combined schema-12 fallow 3.27.0 report that the real reader accepts', () => {
    const read = parseFallowReportText(demoFallowReportText(harnessSnapshot()));
    expect(read.ok).toBe(true);
    if (!read.ok) return;
    expect([read.report.kind, read.report.schema_version, read.report.version]).toEqual(['combined', 12, SYNTHETIC_VERSION]);
  });

  it('carries no source text: no fragment, actions or suggestions anywhere', () => {
    const text = demoFallowReportText(harnessSnapshot());
    for (const key of ['"fragment"', '"actions"', '"suggestions"']) expect(text.includes(key), key).toBe(false);
  });

  // syntheticFallowJson over ten files gives:
  // - 10 unused findings (types on the 4th and 8th file);
  // - 5 complexity findings (files 0, 2, 4, 6 and 8);
  // - 4 duplication findings (clone groups at 0-1 and 5-6);
  // - WP-03 N38: 5 relation findings (one import cycle, one re-export cycle, two boundary
  //   violations, one unresolved import — ten files satisfies syntheticFallowJson's
  //   six-file floor);
  // - plus one `orphan` export on the unmatched path.
  it('matches twenty-four findings on ten harness files and leaves exactly one path unmatched', () => {
    const snapshot = harnessSnapshot();
    const report = demoEvidenceReport(snapshot);
    const { matched, unmatchedPaths } = resolveFindings(report.normalized.findings, new Set(filePathsOf(snapshot)));
    expect(unmatchedPaths).toEqual([DEMO_UNMATCHED_PATH]);
    expect(matched).toHaveLength(24);
    expect(new Set(matched.map((f) => f.path)).size).toBe(10);
    expect(report.normalized.categories).toEqual(ALL_ANALYSED);
  });

  // WP-03 N38: the harness's own relation evidence, and the edge count Task 14's brief
  // says the demo report gives (3 cycle hops + 2 boundary violations).
  it('carries relation evidence: one import cycle, one re-export cycle, two violations, one unresolved import and file scores', () => {
    const snapshot = harnessSnapshot();
    const report = demoEvidenceReport(snapshot);
    const { relations } = report.normalized;
    expect(relations.importCycles).toHaveLength(1);
    expect(relations.reExportCycles).toHaveLength(1);
    expect(relations.boundaryViolations).toHaveLength(2);
    expect(relations.unresolvedImports).toHaveLength(1);
    expect(relations.fan).not.toBeNull();
    const files = fileSummariesFor(snapshot);
    const index = evidenceIndexFor(files, report, snapshot.snapshotId);
    expect(relationModelFor(files, index).edges).toHaveLength(5);
  });

  // WP-03 N38: pins demoRelationsAnchorPath against the literal `select=` value
  // scripts/harness-shot.mjs hardcodes for the relation captures (it is a plain script,
  // not compiled TS, so it cannot import this helper) — a change to DEMO_FILE_INDEXES or
  // the fixture's own file-naming convention fails this test instead of silently
  // breaking `wp03-city-relations-*`/`wp03-city-cycle-dark`.
  it('names the file the relation captures select, matching the harness-shot.mjs literal', () => {
    expect(demoRelationsAnchorPath(harnessSnapshot())).toBe('dir-4/file-4.ts');
  });

  it('keeps its provenance, and says it is synthetic', () => {
    const snapshot = harnessSnapshot();
    expect(demoEvidenceReport(snapshot)).toMatchObject({
      provider: 'fallow', providerVersion: SYNTHETIC_VERSION, reportKind: 'combined', schemaVersion: 12,
      fileName: DEMO_FALLOW_FILE_NAME, snapshotId: snapshot.snapshotId, stripPrefix: null,
    });
    expect(DEMO_FALLOW_FILE_NAME).toMatch(/synthetic/);
    expect(HARNESS_SYNTHETIC_FOOTER).toMatch(/synthetic/i);
  });
});

describe('attaching it the way mount.ts does', () => {
  beforeEach(() => { setActivePinia(createPinia()); });

  it('reads as current, collected evidence for the harness snapshot, with most files unreported', () => {
    const snapshot = harnessSnapshot();
    const evidence = useEvidenceStore();
    evidence.setRepository(new InMemoryEvidenceStore());
    evidence.bindRepository(snapshot.repositoryId);
    expect(evidence.attach(demoEvidenceReport(snapshot))).toBe(true);
    const index = evidenceIndexFor(fileSummariesFor(snapshot), evidence.report, snapshot.snapshotId);
    expect(index.state).toBe('current');
    expect(index.matchedFindings).toBe(24);
    expect(index.matchedFiles).toBe(10);
    expect(index.totals.findings.state).toBe('collected');
  });
});

describe('the harness fallow run (?fallow=installed, ?analysis=…, Part 7 Z42)', () => {
  it('the collected demo is the real builder\'s report with verified, collected provenance', () => {
    const snapshot = harnessSnapshot();
    const report = demoCollectedReport(snapshot);
    expect(report.collected).toMatchObject({ origin: 'collected', sourceMatch: 'verified', rootPath: snapshot.scope.rootPath, exitCode: 0 });
    expect(report.fileName).toBe('fallow.exe');
    expect(report.normalized.findings.length).toBe(demoEvidenceReport(snapshot).normalized.findings.length);
  });

  it('the review shows the exact argv for the harness root and a synthetic executable', () => {
    const snapshot = harnessSnapshot();
    const review = demoRunReview(snapshot);
    expect(review.args).toEqual(FALLOW_RUN_ARGS(snapshot.scope.rootPath));
    expect(review.facts.executablePath).toBe('C:\\Tools\\fallow\\fallow.exe');
    expect(HARNESS_BINDING).toMatchObject({ kind: 'bound', binding: { executablePath: 'C:\\Tools\\fallow\\fallow.exe' } });
  });

  it('every seeded run state has a banner', () => {
    const snapshot = harnessSnapshot();
    expect(fallowRunBannerOf(runningAnalysisState(snapshot), true, false)?.tone).toBe('info');
    expect(fallowRunBannerOf(failedAnalysisState(), true, true)).toMatchObject({ tone: 'warning', kept: true });
    expect(fallowRunBannerOf(completedAnalysisState(snapshot), true, false)?.icon).toBe('check');
  });

  // Fix round 1: completedAnalysisState's matchedFindings/matchedFiles (the "fallow
  // analysis attached: N findings" live message) must never drift from the evidence
  // index's own count (the fallow card's "Matched" row) — they used to be two different
  // sources for the same number (one hand-copied, `19`/`10`, stale after Task 14's own
  // fixture change to 24), so the card and the announcement disagreed on screen.
  it('completedAnalysisState agrees with the real evidence index over the attached report', () => {
    const snapshot = harnessSnapshot();
    const index = evidenceIndexFor(fileSummariesFor(snapshot), demoCollectedReport(snapshot), snapshot.snapshotId);
    const state = completedAnalysisState(snapshot);
    if (state.status !== 'completed') throw new Error('unreachable: completedAnalysisState always returns status "completed"');
    expect(state.matchedFindings).toBe(index.matchedFindings);
    expect(state.matchedFiles).toBe(index.matchedFiles);
  });

  it('demoInvestigation lists one linked note (on the first finding) and one orphan for the harness codebase', () => {
    const snapshot = harnessSnapshot();
    const { row } = firstRow(snapshot);
    const { notes, fingerprint } = demoInvestigation(snapshot, 'demo');
    expect(fingerprint).toBe(row.fingerprint);
    const index = notes.list(snapshot.repositoryId);
    // The vault holds two notes; the raw index groups every well-formed one by its own
    // fingerprint (orphan-ness is a model-level concept, checked separately below).
    const links = Array.from(index.byFingerprint.values()).flat();
    expect(links).toHaveLength(2);
    expect(index.malformed).toBe(0);
    const onFirstFinding = index.byFingerprint.get(`${row.anchorPath}#${row.id}`) ?? [];
    expect(onFirstFinding).toHaveLength(1);
    expect(onFirstFinding[0]?.status).toBe('in progress');
    const model = buildInvestigationModel(buildQualityModel(fileSummariesFor(snapshot), evidenceIndexFor(fileSummariesFor(snapshot), demoEvidenceReport(snapshot), snapshot.snapshotId), []), index);
    expect(model.orphanNotes).toHaveLength(1);
  });

  it('demoInvestigation gives an exact locationVerdict for demo and a size failure for stale', async () => {
    const snapshot = harnessSnapshot();
    const { row, evidence } = firstRow(snapshot);

    const demo = demoInvestigation(snapshot, 'demo');
    const demoResult = await demo.preview.read(previewRequestFor(row, snapshot));
    if (demoResult.status !== 'ok') throw new Error('unreachable: the fixed preview always reads ok');
    const demoVerdict = locationVerdict(locationInputsFor(row, snapshot, evidence, demoResult.text));
    expect(demoVerdict.exact).toBe(true);

    const stale = demoInvestigation(snapshot, 'stale');
    const staleResult = await stale.preview.read(previewRequestFor(row, snapshot));
    if (staleResult.status !== 'ok') throw new Error('unreachable: the fixed preview always reads ok');
    const staleVerdict = locationVerdict(locationInputsFor(row, snapshot, evidence, staleResult.text));
    expect(staleVerdict.exact).toBe(false);
    if (!staleVerdict.exact) expect(staleVerdict.failed).toBe('size');
  });

  it('Polish H5: the failed-run shot opens its error output, and refuses to capture without one', () => {
    const root = document.body.createDiv();
    const log = root.createEl('details', { cls: 'ci-fallow-run__log' });
    log.createEl('summary', { text: 'Error output (last lines)' });
    log.createEl('pre', { text: 'Boom' });
    expect(log.open).toBe(false);
    openFailureLog(root);
    expect(log.open).toBe(true);
    const empty = document.body.createDiv();
    expect(() => { openFailureLog(empty); }).toThrow('rendered no error output');
    root.remove();
    empty.remove();
  });
});
