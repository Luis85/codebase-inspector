// WP-04 Task 12 fix round 1: shared setup for the source preview panel's tests, split
// across investigate-preview.test.ts (IN13/E19/E20 reads, IN10 the highlight and the
// stale-location callout) and investigate-preview-io.test.ts (IN9 unavailable reasons,
// IN8 markup safety, IN11 Reload, IN12 Open in Obsidian) — both files over the 450-line
// cap as one. Not itself a `*.test.ts`, so vitest never collects it as a suite.
import { mount, flushPromises } from '@vue/test-utils';
import { nextTick } from 'vue';
import InvestigateScreen from '../../src/ui/screens/InvestigateScreen.vue';
import { useCityStore } from '../../src/ui/stores/city-store';
import { useInvestigationStore } from '../../src/ui/stores/investigation-store';
import { useReviewStore } from '../../src/ui/stores/review-store';
import { useEvidenceStore } from '../../src/ui/stores/evidence-store';
import { useReadModels } from '../../src/ui/read-models/use-read-models';
import { analysedAtOf } from '../../src/ui/read-models/investigation-evidence';
import type { InvestigationRow } from '../../src/ui/read-models/investigation';
import { createInMemoryReviewRepository } from '../../src/ui/stores/ports/review-repository';
import { computeLayout } from '../../src/domain/layout/layout';
import type { CodebaseSnapshot } from '../../src/domain/model';
import type { EvidenceReport, FindingCategory } from '../../src/application/evidence/model';
import type { InvestigationNotesPort } from '../../src/application/ports/investigation-notes-port';
import type { PreviewResult, PreviewText } from '../../src/application/investigation/source-preview';
import { parseFallowReportText } from '../../src/application/evidence/read-fallow-report';
import { buildEvidenceReport } from '../../src/application/evidence/normalize-fallow';
import { buildSnapshotFixture } from '../fixtures/snapshot-builder';
import { attachSyntheticReport, syntheticFallowJson, type SyntheticReportOptions } from '../fixtures/evidence-report';
import { inertInvestigationNotes, scriptedSourcePreview, type ScriptedSourcePreview } from '../fixtures/fake-investigation';

export function mountScreen() {
  return mount(InvestigateScreen, { attachTo: document.body });
}

export function stubNotesPort(
  sourcePath: string | null, opened: string[], openResult: (path: string) => Promise<boolean> = () => Promise.resolve(true),
): InvestigationNotesPort {
  return {
    ...inertInvestigationNotes(),
    sourceNotePath: () => sourcePath,
    open: (path: string) => { opened.push(path); return openResult(path); },
  };
}

export async function withReport(
  fileCount: number, options: SyntheticReportOptions = {}, notes: InvestigationNotesPort = inertInvestigationNotes(),
  spec: Partial<Parameters<typeof buildSnapshotFixture>[0]> = {},
): Promise<{ snap: CodebaseSnapshot; preview: ScriptedSourcePreview }> {
  const snap = buildSnapshotFixture({ files: fileCount, directories: 2, ...spec });
  useCityStore().setCity(snap, computeLayout(snap));
  attachSyntheticReport(snap, options);
  const preview = scriptedSourcePreview();
  useInvestigationStore().setPorts(notes, preview);
  useReviewStore().setRepositoryFactory(() => createInMemoryReviewRepository());
  await useReviewStore().bindRepository(snap.repositoryId);
  useCityStore().navigate('investigate');
  return { snap, preview };
}

export function findingOfKind(kind: FindingCategory): InvestigationRow {
  const { investigation } = useReadModels();
  const row = investigation.value.rows.find((r) => r.kind === kind);
  if (!row) throw new Error(`no ${kind} finding in the synthetic report`);
  return row;
}

/** Minor 11: the synthetic report's re-export cycle carries no line (relations-report
 *  fixture doc, evidence-report.ts). */
export function findingWithNoLine(): InvestigationRow {
  const { investigation } = useReadModels();
  const row = investigation.value.rows.find((r) => r.line === null);
  if (!row) throw new Error('no line-less finding in the synthetic report');
  return row;
}

export async function select(row: InvestigationRow): Promise<InvestigationRow> {
  useInvestigationStore().open(row.fingerprint);
  await nextTick();
  return row;
}

/** Resolves the scripted preview's read and lets the store's async readPreview (an await
 *  past the scripted promise, then a `.catch`, IP39) and Vue's own render both settle, so
 *  the DOM reflects the result before the next assertion. */
export async function resolve(
  preview: ScriptedSourcePreview, result: PreviewResult, request?: Parameters<ScriptedSourcePreview['resolveNext']>[1],
) {
  preview.resolveNext(result, request);
  await flushPromises();
  await nextTick();
}

export function observedOf(snap: CodebaseSnapshot, entityId: string, metricId: 'byte-size' | 'physical-lines'): number {
  const obs = snap.observations.find((o) => o.entityId === entityId && o.measurement.metricId === metricId);
  return obs?.value ?? -1;
}

/** A snapshot whose ANCHOR entity's byte-size observation is `unavailable` — a non-null
 *  leftover value (never real production data, IP16, but exactly what proves `observedValue`
 *  reads `status`, not just `value`). */
export function withUnavailableByteSize(snap: CodebaseSnapshot, entityId: string): CodebaseSnapshot {
  const observations = snap.observations.map((o) => (
    o.entityId === entityId && o.measurement.metricId === 'byte-size'
      ? { ...o, status: 'unavailable' as const, value: 4096, reason: 'not measured (test fixture)' }
      : o
  ));
  return { ...snap, observations };
}

/** Fix round 1 (review Important 1, E19): re-attaches a synthetic report whose complexity
 *  finding at `path` now reports `newLine` — through the REAL parser and normaliser (no
 *  mocks). The finding's id (and so its fingerprint) is `path|symbol|occurrence` (Y24,
 *  normalize-fallow.ts): `line` plays no part in it, so the SAME finding keeps the SAME
 *  fingerprint after this move. */
export function attachMovedLineReport(snap: CodebaseSnapshot, path: string, newLine: number): EvidenceReport {
  const raw = JSON.parse(syntheticFallowJson(snap)) as { health: { findings: { path: string; line: number }[] } };
  const finding = raw.health.findings.find((f) => f.path === path);
  if (!finding) throw new Error(`test setup: no complexity finding for ${path}`);
  finding.line = newLine;
  const parsed = parseFallowReportText(JSON.stringify(raw));
  if (!parsed.ok) throw new Error(`test setup: the mutated synthetic report was refused (${parsed.code} ${parsed.detail})`);
  const report = buildEvidenceReport({
    raw: parsed.report, fileName: 'synthetic-fallow.json', importedAt: '2026-09-23T10:00:00.000Z', snapshotId: snap.snapshotId, stripPrefix: null,
  });
  if (!useEvidenceStore().attach(report)) throw new Error('test setup: the evidence store refused the report');
  return report;
}

/** A reported-line-matching read: the anchor's real observed size/lines, an mtime before
 *  the analysis time — IN10's exact case, unless a test perturbs one field. */
export function matchingText(snap: CodebaseSnapshot, row: InvestigationRow): PreviewText {
  const { investigation } = useReadModels();
  const analysedAt = Date.parse(analysedAtOf(investigation.value.evidence.report!));
  return {
    lines: [
      { number: 1, text: 'const a = 1;', cut: false },
      { number: 2, text: 'function fn() { return a; }', cut: false },
      { number: 3, text: 'const b = 2;', cut: false },
    ],
    lineCount: observedOf(snap, row.file.id, 'physical-lines'),
    size: observedOf(snap, row.file.id, 'byte-size'),
    mtimeMs: analysedAt - 60_000,
    readAt: '2026-09-25T12:00:00.000Z',
  };
}

export const preLines = (w: ReturnType<typeof mountScreen>): string[] => {
  const text = w.find('.ci-source-preview__text').element.textContent ?? '';
  const parts = text.split('\n');
  parts.pop(); // the trailing "\n" of the last line leaves one empty entry
  return parts;
};

/** Minor 9: the stale-location words scoped to the panel's own Callout, never a generic
 *  `.ci-callout` that some other panel on screen could also render. */
export const staleCalloutText = (w: ReturnType<typeof mountScreen>): string => w.find('.ci-source-preview__stale .ci-callout__title').text();
export const staleCalloutExists = (w: ReturnType<typeof mountScreen>): boolean => w.find('.ci-source-preview__stale').exists();
export const uncertaintyItems = (w: ReturnType<typeof mountScreen>): string[] =>
  w.findAll('.ci-uncertainty-panel__list li').map((li) => li.text());
