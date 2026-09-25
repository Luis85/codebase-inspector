// WP-04 Task 16 (IN38, IN39; IP35, IP44): the shared setup for the acceptance spine
// (investigation-spine.test.ts) and the safety cases (investigation-safety.test.ts). Not
// itself a `*.test.ts`, so vitest never collects it as a suite. Everything here is real
// except the vault: the relations project is copied to a temp folder and scanned with the
// real Node port, reports go through the real parser and normaliser, the notes port is the
// host's own over the in-memory fake vault (Task 7), and the source preview reads the
// copied files from disk.
import { cpSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { flushPromises, mount } from '@vue/test-utils';
import '../mocks/obsidian';
import InvestigateScreen from '../../src/ui/screens/InvestigateScreen.vue';
import { useCityStore } from '../../src/ui/stores/city-store';
import { useInvestigationStore } from '../../src/ui/stores/investigation-store';
import { useReviewStore } from '../../src/ui/stores/review-store';
import { useEvidenceStore } from '../../src/ui/stores/evidence-store';
import { useReadModels } from '../../src/ui/read-models/use-read-models';
import type { InvestigationRow } from '../../src/ui/read-models/investigation';
import { createInMemoryReviewRepository } from '../../src/ui/stores/ports/review-repository';
import { InMemoryEvidenceStore } from '../../src/adapters/storage/in-memory-evidence-store';
import { computeLayout } from '../../src/domain/layout/layout';
import type { AnalysisScope, CodebaseSnapshot } from '../../src/domain/model';
import { collectInventory } from '../../src/application/inventory-collector';
import { approve } from '../../src/application/approval';
import { parseFallowReportText } from '../../src/application/evidence/read-fallow-report';
import { buildEvidenceReport } from '../../src/application/evidence/normalize-fallow';
import type { EvidenceReport } from '../../src/application/evidence/model';
import { createSourcePreview } from '../../src/application/investigation/source-preview';
import type { SourcePreview } from '../../src/application/investigation/source-preview';
import { EVIDENCE_BEGIN, EVIDENCE_END } from '../../src/application/investigation/note-model';
import { createInvestigationNotes } from '../../src/host/investigation-notes';
import { createRealNodePort } from '../fixtures/real-node-port';
import { createCancellationToken } from '../fixtures/cancellation-token';
import { createFixedClock } from '../fixtures/clock';
import { createFakeVault, type FakeVault } from '../fixtures/fake-vault';
import { createFakeProfileStoreHarness } from '../fixtures/fake-profile-store';
import { createFakeInvestigationFolders } from '../fixtures/fake-investigation-folders';

export const PROFILE_ID = 'p1';
/** IN38: the import cycle through src/core/a.ts → b.ts → c.ts, reported on line 1. */
export const CYCLE_ANCHOR = 'src/core/a.ts';

/** `RELATIONS_PROJECT_DIR`'s folder, by a cwd-relative path: fallow-fixture.ts resolves it
 *  from `import.meta.url`, which throws at import under this jsdom project ("The URL must be
 *  of scheme file"), the reason relations-report.ts reads its recording the same way. */
const RELATIONS_PROJECT = join(process.cwd(), 'tests/fixtures/fallow/relations-project');

const temps: string[] = [];

/** Removes every temp folder this module made (call from afterEach). */
export async function cleanupTemps(): Promise<void> {
  await Promise.all(temps.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
}

async function tempDir(prefix: string): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), prefix));
  temps.push(dir);
  return dir;
}

/** IP35: the WP-03 relations project, copied whole to its own temp folder. */
export async function copyRelationsProject(): Promise<string> {
  const root = await tempDir('ci-spine-code-');
  cpSync(RELATIONS_PROJECT, root, { recursive: true });
  return root;
}

/** A real vault base path, separate from the codebase root (so no note overlaps it, IN29). */
export async function vaultBase(): Promise<string> {
  return tempDir('ci-spine-vault-');
}

const clock = createFixedClock('2026-09-26T08:00:00.000Z');

/** A full scan of `root` through the real Node port; each call is a new snapshot id. */
export async function scanRoot(root: string): Promise<CodebaseSnapshot> {
  clock.advance(60_000);
  const scope: AnalysisScope = { rootPath: root, exclusions: [], maxFileBytes: 1_000_000, followSymlinks: false };
  const { token } = createCancellationToken();
  return collectInventory(createRealNodePort(), scope, approve(PROFILE_ID, root, scope, clock), token, clock);
}

/** IP35: report JSON through the real parser and normaliser, with no strip prefix — the
 *  recording's `src/…` paths are the scanned project's own. `importedAt` is now, after a
 *  short wait, so every copied file's mtime strictly precedes the analysis time (IN10). */
export async function reportFor(snapshot: CodebaseSnapshot, json: string, fileName = 'relations-combined-3.27.0.json'): Promise<EvidenceReport> {
  await delay(20);
  const parsed = parseFallowReportText(json);
  if (!parsed.ok) throw new Error(`test setup: the report was refused (${parsed.code} ${parsed.detail})`);
  return buildEvidenceReport({
    raw: parsed.report, fileName, stripPrefix: null, importedAt: new Date().toISOString(), snapshotId: snapshot.snapshotId,
  });
}

/** The snapshot on screen and its report attached, as a rescan and re-import leave them. */
export async function show(snapshot: CodebaseSnapshot, report: EvidenceReport): Promise<void> {
  useCityStore().setCity(snapshot, computeLayout(snapshot));
  if (!useEvidenceStore().attach(report)) throw new Error('test setup: the evidence store refused the report');
  await flushPromises();
}

export interface WorldOptions {
  readonly snapshot: CodebaseSnapshot;
  readonly report: EvidenceReport;
  readonly root: string | null;       // the codebase root the real preview reads; null: an inert preview
  readonly vaultPath: string;
}

/** Binds every store to `snapshot`'s codebase, wires the real notes port over a fresh fake
 *  vault and mounts the Investigate screen. */
export async function mountWorld(options: WorldOptions) {
  const { snapshot, report, root, vaultPath } = options;
  const fake = createFakeVault({ basePath: vaultPath });
  const harness = createFakeProfileStoreHarness();
  await harness.writeRaw({ profiles: [{ profileId: snapshot.repositoryId, name: 'Relations', bindingId: null, exclusions: [], maxFileBytes: 1_000_000 }] });
  const notes = createInvestigationNotes(fake.app, {
    folders: createFakeInvestigationFolders(), profiles: harness.store, clock: createFixedClock('2026-09-26T09:00:00.000Z'),
    registerEvent: () => undefined,
  });
  const preview: SourcePreview = root === null
    ? { read: () => new Promise(() => undefined) }
    : createSourcePreview({ getFilesystem: () => createRealNodePort(), resolveRoot: () => Promise.resolve(root), clock: createFixedClock() });
  const evidence = useEvidenceStore();
  evidence.setRepository(new InMemoryEvidenceStore());
  evidence.bindRepository(snapshot.repositoryId);
  useInvestigationStore().setPorts(notes, preview);
  useReviewStore().setRepositoryFactory(() => createInMemoryReviewRepository());
  await useReviewStore().bindRepository(snapshot.repositoryId);
  await show(snapshot, report);
  useCityStore().navigate('investigate');
  const w = mount(InvestigateScreen, { attachTo: document.body });
  await flushPromises();
  return { fake, w };
}

export type Mounted = Awaited<ReturnType<typeof mountWorld>>['w'];

export function rowWhere(test: (row: InvestigationRow) => boolean, what: string): InvestigationRow {
  const row = useReadModels().investigation.value.rows.find(test);
  if (!row) throw new Error(`test setup: no ${what} row`);
  return row;
}

/** Selects a finding the way a person does: a click on its row in the list. */
export async function selectRow(w: Mounted, row: InvestigationRow): Promise<void> {
  const button = w.findAll('.ci-investigate-row').find((b) => b.attributes('data-fingerprint') === row.fingerprint);
  if (!button) throw new Error(`no listed row for ${row.fingerprint}`);
  await button.trigger('click');
  await flushPromises();
}

export async function click(w: Mounted, selector: string): Promise<void> {
  await w.find(selector).trigger('click');
  await flushPromises();
}

/** Create investigation note… → (optional folder and name) → Create note; returns the path
 *  the dialog showed. The fake vault fires `changed` on a microtask (E12): flushed here. */
export async function createThroughDialog(w: Mounted, edit: { folder?: string; name?: string } = {}): Promise<string> {
  await click(w, '.ci-notes-panel__create');
  if (edit.folder !== undefined) await w.find('.ci-create-note__folder').setValue(edit.folder);
  if (edit.name !== undefined) await w.find('.ci-create-note__name').setValue(edit.name);
  const path = w.find('.ci-create-note__path').text();
  await click(w, '.ci-create-note__confirm');
  return path;
}

/** Refresh evidence… on the note at `path` → Refresh evidence. */
export async function refreshThroughDialog(w: Mounted, path: string): Promise<void> {
  const button = w.findAll('.ci-notes-panel__refresh').find((b) => b.attributes('data-path') === path);
  if (!button) throw new Error(`no Refresh evidence for ${path}`);
  await button.trigger('click');
  await flushPromises();
  await click(w, '.ci-refresh-note__confirm');
}

export function textOf(fake: FakeVault, path: string): string {
  const text = fake.text(path);
  if (text === undefined) throw new Error(`no note at ${path}`);
  return text;
}

/** Everything after the end-marker line: the person's own sections. */
export const afterBlock = (text: string): string => text.slice(text.indexOf(`${EVIDENCE_END}\n`) + EVIDENCE_END.length + 1);
export const blockOf = (text: string): string => text.slice(text.indexOf(EVIDENCE_BEGIN), text.indexOf(EVIDENCE_END));
export const writeCalls = (fake: FakeVault): number =>
  fake.calls.create + fake.calls.createFolder + fake.calls.process + fake.calls.processFrontMatter;
