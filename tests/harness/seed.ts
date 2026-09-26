// What the harness seeds, split out of mount.ts so the ordinary suite can check it
// (mount.ts only runs in a real browser). Harness-only: nothing under src imports this.
import type { EntityId } from '../../src/domain/entity-id';
import { initialScanLifecycleState, type ScanLifecycleState } from '../../src/application/run-state';
import type { ReportSection } from '../../src/ui/stores/report-store';
import { useReviewStore } from '../../src/ui/stores/review-store';
import { REVIEW_STATE_SCHEMA_V1 } from '../../src/ui/read-models/review-state';
import type { CodebaseSnapshot } from '../../src/domain/model';
import type { EvidenceReport } from '../../src/application/evidence/model';
import { parseFallowReportText } from '../../src/application/evidence/read-fallow-report';
import { buildEvidenceReport } from '../../src/application/evidence/normalize-fallow';
import { snapshotWithOnlyFiles, syntheticFallowJson } from '../fixtures/evidence-report';
import { evidenceIndexFor } from '../../src/ui/read-models/evidence-index';
import { fileSummariesFor } from '../../src/ui/read-models/file-summaries';
import { FALLOW_RUN_ARGS } from '../../src/application/analysis/fallow-invocation';
import type { AnalysisRunState } from '../../src/application/analysis/analysis-state';
import type { AnalyzerBindingRead } from '../../src/application/analysis/analyzer-record';
import type { RunReview } from '../../src/application/analysis/fallow-analysis-service';
import { HARNESS_EXECUTABLE, fakeRunReview } from '../fixtures/fake-fallow-analysis';
// WP-04 Task 17 (IN40; IP36, IPF11): the Investigate harness seed.
import { createFakeVault } from '../fixtures/fake-vault';
import { createFakeInvestigationFolders } from '../fixtures/fake-investigation-folders';
import { createFakeProfileStoreHarness } from '../fixtures/fake-profile-store';
import { createFixedClock } from '../fixtures/clock';
import { fixedSourcePreview } from '../fixtures/fake-investigation';
import { stringifyYaml } from '../mocks/obsidian';
import { createInvestigationNotes } from '../../src/host/investigation-notes';
import { EVIDENCE_BEGIN, EVIDENCE_END, noteFrontmatter, renderNoteBody } from '../../src/application/investigation/note-model';
import { defaultNoteFolder, noteBaseName } from '../../src/application/investigation/note-path';
import { EMPTY_NOTE_INDEX } from '../../src/application/investigation/note-index';
import type { PreviewLine, PreviewResult, SourcePreview } from '../../src/application/investigation/source-preview';
import type { InvestigationNotesPort } from '../../src/application/ports/investigation-notes-port';
import { buildQualityModel } from '../../src/ui/read-models/findings';
import { buildInvestigationModel } from '../../src/ui/read-models/investigation';
import {
  checklistFor, evidenceBundleFor, evidenceFactsFor, noteIdentityFor, uncertaintiesFor,
} from '../../src/ui/read-models/investigation-evidence';
import { FINDING_KIND_LABEL, NOTE_VOCABULARY } from '../../src/ui/inspector-copy';

const AT = new Date('2026-09-17T12:00:00Z');

/** Part 4: three fixed work items on the first three files, one per status column the
 *  prototype shows. Part 5 V30: a refused add returns null, and a board with a column
 *  missing would be photographed as if it were right, so this throws unless all three
 *  were created — the page error then fails `npm run harness-shot`. */
export async function seedDemoItems(fileIds: readonly EntityId[]): Promise<void> {
  const review = useReviewStore();
  const [a, b, c] = fileIds;
  const created = [
    a ? await review.addWorkItem({ kind: 'file', entityId: a }, 'refactor', 'Separate calculation from persistence', AT, { priority: 'high', status: 'planned', checks: [true, false, false] }) : null,
    b ? await review.addWorkItem({ kind: 'file', entityId: b }, 'tests', 'Add regression tests for selection changes', AT, { status: 'in-progress', checks: [true, true, false] }) : null,
    c ? await review.addWorkItem({ kind: 'file', entityId: c }, 'documentation', 'Document the persistence boundary', AT, { priority: 'low', status: 'verified', checks: [true, true, true] }) : null,
  ].filter((item) => item !== null).length;
  if (created !== 3) throw new Error(`harness: items=demo seeded ${created} of 3 work items`);
}

/** Part 5 V6: a scan in flight, as the host's ScanCoordinator subscription would mirror
 *  it into the run store (a pure mirror), for the Cancel controls' captures. */
export function runningLifecycle(): ScanLifecycleState {
  const approval = {
    profileId: 'harness', sourceFingerprint: 'harness-source', scopeFingerprint: 'harness-scope',
    approvedAt: '2026-09-17T12:00:00.000Z', operation: 'read-only-inventory' as const,
  };
  return {
    ...initialScanLifecycleState(),
    generation: 1,
    approval,
    run: { status: 'running', runId: 'harness-run', generation: 1, approval, processedFiles: 57 },
  };
}

/** Part 6 Y4: the same run after Cancel was pressed, before the walk confirms it stopped. */
export function cancellingLifecycle(): ScanLifecycleState {
  return { ...runningLifecycle(), run: { status: 'cancelling', runId: 'harness-run', generation: 1 } };
}

/** Part 5 V13: a fixed v1 review-state file for `?import=demo`. v1 carries no source, so
 *  no repository digest is needed, and the dialog shows the origin as unknown. */
export function demoImportJson(filePath: string, sections: Readonly<Record<ReportSection, boolean>>): string {
  const at = '2026-09-17T12:00:00.000Z';
  return JSON.stringify({
    schema: REVIEW_STATE_SCHEMA_V1,
    exportedAt: at,
    note: 'Harness demo import.',
    workItems: [{
      id: 'wi-1', target: { kind: 'file', path: filePath }, intent: 'refactor', title: 'Separate calculation from persistence',
      status: 'planned', priority: 'high', notes: '', checks: [true, false, false], createdAt: at,
    }],
    rules: [{ id: 'AR-001', from: 'dir-0', to: 'dir-1', rationale: 'Keep the core free of UI imports.', createdAt: at }],
    dispositions: [],
    report: { sections: { ...sections }, note: '' },
  }, null, 2);
}

/** Part 6 §5: the synthetic report's own file name says what it is on every surface that
 *  shows it (the fallow card's diagnostics, the S14 review step). */
export const DEMO_FALLOW_FILE_NAME = 'synthetic-harness-fallow-report.json';
/** Not a harness path, so the review step and the fallow card show one unmatched path. */
export const DEMO_UNMATCHED_PATH = 'generated/schema.ts';
/** page.ts's caption whenever the synthetic report is on the page. */
export const HARNESS_SYNTHETIC_FOOTER = 'Harness · synthetic fallow report built from the fixture’s own paths · not a repository analysis';
const DEMO_WARNING = 'Synthetic harness diagnostic: package exports were not resolved.';
/** Ten MEASURED files (1–3 are the fixture's unavailable ones), spread over all six
 *  districts, so the lens shows reported lots among unreported ones. */
const DEMO_FILE_INDEXES: readonly number[] = [4, 10, 23, 31, 40, 57, 66, 86, 101, 120];

export function filePathsOf(snapshot: CodebaseSnapshot): string[] {
  return snapshot.entities.filter((e) => e.kind === 'file').map((e) => e.path);
}

/** The ten demo files, in DEMO_FILE_INDEXES order — the same reduced file list
 *  `demoFallowReportText` feeds `syntheticFallowJson`, so its own "file 0", "file 1", …
 *  (WP-03 N38's fixed relation evidence, tests/fixtures/evidence-report.ts) are these
 *  paths in this order. */
function demoPaths(snapshot: CodebaseSnapshot): string[] {
  const paths = filePathsOf(snapshot);
  return DEMO_FILE_INDEXES.map((i) => {
    const path = paths[i];
    if (path === undefined) throw new Error(`harness: report=demo needs a file at index ${i}`);
    return path;
  });
}

/** R5: the shared fixture's real-shaped fallow 3.27.0 JSON, for the ten demo files plus one
 *  path the snapshot does not have. It is the file `?fallow=review` picks. */
export function demoFallowReportText(snapshot: CodebaseSnapshot): string {
  return syntheticFallowJson(snapshotWithOnlyFiles(snapshot, demoPaths(snapshot)), {
    unmatchedPaths: [DEMO_UNMATCHED_PATH], warning: DEMO_WARNING,
  });
}

/** WP-03 N38: the reduced report's own "file 0" — the member every one of its fixed
 *  relation findings (the import cycle, the re-export cycle's neighbour set is files 3-4,
 *  the unresolved import) is anchored on or touches — so the relation captures
 *  (`?relations=cycle`, the Relations-section shots) can `select=` a file that actually
 *  has evidenced relations to show. scripts/harness-shot.mjs hardcodes this same path as
 *  a query literal (it is a plain script, not compiled TS); harness-evidence.test.ts pins
 *  the two against each other so a change to DEMO_FILE_INDEXES or the fixture's own path
 *  naming cannot silently break the captures. */
export function demoRelationsAnchorPath(snapshot: CodebaseSnapshot): string {
  const [first] = demoPaths(snapshot);
  if (first === undefined) throw new Error('harness: report=demo needs at least one file for the relations captures');
  return first;
}

/** What the S14 dialog attaches for that file: the real reader, then the real builder. A
 *  refusal throws, and the page error fails `npm run harness-shot`. */
export function demoEvidenceReport(snapshot: CodebaseSnapshot): EvidenceReport {
  const read = parseFallowReportText(demoFallowReportText(snapshot));
  if (!read.ok) throw new Error(`harness: report=demo was refused by the real reader (${read.code} ${read.detail})`);
  return buildEvidenceReport({
    raw: read.report, fileName: DEMO_FALLOW_FILE_NAME, importedAt: AT.toISOString(),
    snapshotId: snapshot.snapshotId, stripPrefix: null,
  });
}

/** Part 7 Z42: the demo report as a collected run attaches it (the real builder's output plus
 *  collected provenance), for `?analysis=collected`. */
export function demoCollectedReport(snapshot: CodebaseSnapshot): EvidenceReport {
  const base = demoEvidenceReport(snapshot);
  return {
    ...base, fileName: 'fallow.exe',
    collected: {
      origin: 'collected', sourceMatch: 'verified', runId: 'harness-fallow-run', rootPath: snapshot.scope.rootPath,
      executablePath: HARNESS_EXECUTABLE, args: FALLOW_RUN_ARGS(snapshot.scope.rootPath), exitCode: 0,
      startedAt: AT.toISOString(), durationMs: 1_450, versionTested: true,
    },
  };
}

/** Part 7 Z42: the installed route's review for the harness root (`?fallow=installed`). */
export function demoRunReview(snapshot: CodebaseSnapshot): RunReview {
  return fakeRunReview(snapshot.repositoryId, snapshot.snapshotId, snapshot.scope.rootPath);
}

export const HARNESS_BINDING: AnalyzerBindingRead = {
  kind: 'bound', binding: { profileId: 'harness', executablePath: HARNESS_EXECUTABLE, timeoutSeconds: 120, trust: { fingerprint: '0a1b2c3d', version: '3.27.0', grantedAt: AT.toISOString() } },
};

export function runningAnalysisState(snapshot: CodebaseSnapshot): AnalysisRunState {
  return {
    status: 'running', rootPath: snapshot.scope.rootPath, startedAt: AT.toISOString(), timeoutSeconds: 120, version: '3.27.0', tested: true,
    identity: { profileId: snapshot.repositoryId, snapshotId: snapshot.snapshotId, rootFingerprint: 'harness', subjectFingerprint: 'harness', runId: 'harness-fallow-run', generation: 0 },
  };
}

export function failedAnalysisState(): AnalysisRunState {
  return {
    status: 'failed', runId: 'harness-fallow-run', code: 'timed-out', detail: '120', evidenceKept: true, finishedAt: AT.toISOString(),
    logExcerpt: 'Synthetic harness log: analysing 142 files…\nSynthetic harness log: still analysing after 120 s.',
  };
}

/** Fix round 1: `matchedFindings`/`matchedFiles` are derived from the report the
 *  `analysis=collected` branch actually attaches (`demoCollectedReport(snapshot)`, the
 *  same findings as `demoEvidenceReport`) through the real evidence index, never a
 *  second, hand-copied pair of numbers that Task 14's fixture change could (and did)
 *  leave stale — the fallow card's "Matched" row and its live-region "attached" message
 *  read two different sources for the same count, and a literal here can silently drift
 *  from the report while both keep compiling. */
export function completedAnalysisState(snapshot: CodebaseSnapshot): AnalysisRunState {
  const index = evidenceIndexFor(fileSummariesFor(snapshot), demoCollectedReport(snapshot), snapshot.snapshotId);
  return {
    status: 'completed', runId: 'harness-fallow-run', finishedAt: AT.toISOString(), version: '3.27.0', tested: true,
    matchedFindings: index.matchedFindings, matchedFiles: index.matchedFiles,
  };
}

/** Polish H5 (L24): a headless capture cannot click, so the failed-run shot opens the banner's
 *  "Error output (last lines)" itself, and the log text is in the picture. */
export function openFailureLog(root: ParentNode): void {
  const log = root.querySelector('details.ci-fallow-run__log');
  if (log === null) throw new Error('harness: analysis=failed rendered no error output');
  log.setAttribute('open', '');
}

// WP-04 Task 17 (IN40; IP36, IPF11): `?investigate=demo|stale|create` — the Investigate
// screen's own notes port (a fake vault) and a fixed source preview.
const INVESTIGATION_PROFILE_NAME = 'Harness City';
/** Anchored on none of the demo report's ten files (DEMO_FILE_INDEXES), so a note here can
 *  never be claimed by any row's portable fingerprint — a real "finding the report does not
 *  hold" (IN34), the same shape Orphan notes covers. */
const ORPHAN_SOURCE_PATH = 'dir-0/file-0.ts';
const PREVIEW_WINDOW = 41;

function observedMetric(snapshot: CodebaseSnapshot, entityId: EntityId, metricId: 'byte-size' | 'physical-lines'): number {
  const obs = snapshot.observations.find((o) => o.entityId === entityId && o.measurement.metricId === metricId);
  return obs !== undefined && obs.status === 'measured' ? (obs.value ?? 0) : 0;
}

/** 41 plausible TypeScript lines, always numbered 1..PREVIEW_WINDOW — the window is NOT
 *  centred on `targetLine` (this preview is scripted, IP36, never the real windowing
 *  algorithm, which would centre it and clip at the file's edges). It starts at line 1
 *  regardless of where `targetLine` falls, so the caller must keep `targetLine` at or
 *  under PREVIEW_WINDOW — true for the demo report's own first finding, whose line is
 *  near the top of its file. */
function previewLines(targetLine: number, title: string): readonly PreviewLine[] {
  const lines: PreviewLine[] = [];
  for (let n = 1; n <= PREVIEW_WINDOW; n += 1) {
    const text = n === targetLine ? `export function reviewMe(): number { // ${title}`
      : n === targetLine + 1 ? '  return computeScore(this.nodes);'
        : n % 4 === 0 ? `  // checkpoint ${n}`
          : `  const value${n} = helper(${n});`;
    lines.push({ number: n, text, cut: false });
  }
  return lines;
}

/** IN40 (IP36, IPF11): the fake vault's own port — one linked note on the report's first
 *  finding (status "in progress"), one orphan note for a finding the report does not hold —
 *  and a fixed preview whose size and line count equal the anchor's real observations
 *  (`stale`: the size is one byte off, so the location check fails on `size` before it ever
 *  reads the line). The row is built through the SAME read models the real screen uses
 *  (fileSummariesFor, evidenceIndexFor, buildQualityModel, buildInvestigationModel), so "the
 *  first finding" can never silently drift from what InvestigateScreen itself shows first.
 *  The fake vault's own base path IS the codebase root, so the create dialog's default
 *  folder overlaps it and shows the Exclude checkbox (IN26/IN29). */
export function demoInvestigation(
  snapshot: CodebaseSnapshot, mode: 'demo' | 'stale' | 'create',
): { notes: InvestigationNotesPort; preview: SourcePreview; fingerprint: string } {
  const report = demoEvidenceReport(snapshot);
  const files = fileSummariesFor(snapshot);
  const evidence = evidenceIndexFor(files, report, snapshot.snapshotId);
  const quality = buildQualityModel(files, evidence, []);
  const model = buildInvestigationModel(quality, EMPTY_NOTE_INDEX);
  const row = model.rows[0];
  if (row === undefined) throw new Error('harness: investigate= needs at least one finding');
  const bundle = evidenceBundleFor(row, evidence, files);
  if (bundle === null) throw new Error('harness: investigate= found no evidence bundle');

  const vault = createFakeVault({ basePath: snapshot.scope.rootPath });
  const clock = createFixedClock(AT.toISOString());
  const profiles = createFakeProfileStoreHarness();
  void profiles.writeRaw({
    profiles: [{
      profileId: snapshot.repositoryId, name: INVESTIGATION_PROFILE_NAME, bindingId: null,
      exclusions: [], maxFileBytes: snapshot.scope.maxFileBytes,
    }],
  });
  const notes = createInvestigationNotes(vault.app, {
    folders: createFakeInvestigationFolders(), profiles: profiles.store, clock, registerEvent: () => {},
  });

  const identity = noteIdentityFor(row, snapshot.repositoryId, snapshot.snapshotId);
  const uncertainties = uncertaintiesFor(row, bundle, null);
  const body = renderNoteBody(evidenceFactsFor(row, bundle, uncertainties), checklistFor(row.kind), NOTE_VOCABULARY);
  const folder = defaultNoteFolder('');
  const fileName = `${noteBaseName(row.id, FINDING_KIND_LABEL[row.kind], row.file.name)}.md`;
  // The fake vault's own create()/createFolder() run their whole body synchronously (no
  // internal await, unlike the host port's own create(), which the void below never waits
  // for) — this function returns synchronously, so the files must exist before it does.
  void vault.app.vault.createFolder(folder);
  void vault.app.vault.create(
    `${folder}/${fileName}`,
    `---\n${stringifyYaml({ ...noteFrontmatter(identity, clock.nowIso()), status: 'in progress' })}---\n\n${body}`,
  );
  const orphanIdentity = {
    codebaseId: snapshot.repositoryId, sourcePath: ORPHAN_SOURCE_PATH, snapshotId: snapshot.snapshotId, findingId: 'orphan-finding',
  };
  void vault.app.vault.create(
    `${folder}/Orphan note.md`,
    `---\n${stringifyYaml(noteFrontmatter(orphanIdentity, clock.nowIso()))}---\n\n${EVIDENCE_BEGIN}\n${EVIDENCE_END}\n`,
  );

  const line = row.line ?? 1;
  const observedBytes = observedMetric(snapshot, row.file.id, 'byte-size');
  const observedLines = observedMetric(snapshot, row.file.id, 'physical-lines');
  const result: PreviewResult = {
    status: 'ok',
    text: {
      lines: previewLines(line, row.title),
      lineCount: observedLines,
      size: mode === 'stale' ? observedBytes + 1 : observedBytes,
      mtimeMs: AT.getTime() - 60_000,
      readAt: AT.toISOString(),
    },
  };
  return { notes, preview: fixedSourcePreview(result), fingerprint: row.fingerprint };
}
