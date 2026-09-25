// WP-04 Task 14 fix round 1: shared setup for the refresh dialog's tests, split across
// investigate-refresh.test.ts (IN31-IN36, O6) and investigate-refresh-review.test.ts (the
// review's edge cases: E22-E24, codebase switches, re-linked notes) — one file would pass
// the 450-line cap. Not itself a `*.test.ts`, so vitest never collects it as a suite. Notes
// are created through the REAL host notes port (the create dialog) over the in-memory fake
// vault; nothing here mocks the port.
import { flushPromises, mount } from '@vue/test-utils';
import '../mocks/obsidian';
import InvestigateScreen from '../../src/ui/screens/InvestigateScreen.vue';
import { useCityStore } from '../../src/ui/stores/city-store';
import { useInvestigationStore } from '../../src/ui/stores/investigation-store';
import { useReviewStore } from '../../src/ui/stores/review-store';
import { useEvidenceStore } from '../../src/ui/stores/evidence-store';
import { useReadModels } from '../../src/ui/read-models/use-read-models';
import { createInMemoryReviewRepository } from '../../src/ui/stores/ports/review-repository';
import { computeLayout } from '../../src/domain/layout/layout';
import type { CodebaseSnapshot } from '../../src/domain/model';
import { EVIDENCE_END } from '../../src/application/investigation/note-model';
import { noteBaseName } from '../../src/application/investigation/note-path';
import { createInvestigationNotes } from '../../src/host/investigation-notes';
import type { InvestigationNotesPort } from '../../src/application/ports/investigation-notes-port';
import { FINDING_KIND_LABEL } from '../../src/ui/inspector-copy';
import { buildSnapshotFixture } from '../fixtures/snapshot-builder';
import { attachSyntheticReport, snapshotWithOnlyFiles, syntheticEvidenceReport } from '../fixtures/evidence-report';
import { createFakeVault } from '../fixtures/fake-vault';
import { createFakeProfileStoreHarness } from '../fixtures/fake-profile-store';
import { createFakeInvestigationFolders } from '../fixtures/fake-investigation-folders';
import { scriptedSourcePreview } from '../fixtures/fake-investigation';
import { createFixedClock } from '../fixtures/clock';

/** A transparent wrapper over the REAL port: `hold()` parks every refresh until `release()`. */
function gated(port: InvestigationNotesPort) {
  const waiting: (() => void)[] = [];
  const gate = {
    holding: false,
    hold: () => { gate.holding = true; },
    release: () => { gate.holding = false; for (const go of waiting.splice(0)) go(); },
  };
  const wrapped: InvestigationNotesPort = {
    ...port,
    refresh: async (request) => {
      if (gate.holding) await new Promise<void>((resolve) => { waiting.push(resolve); });
      return port.refresh(request);
    },
  };
  return { gate, wrapped };
}

/** One note, created through the create dialog for the first unused-export finding (a
 *  finding a later report can drop by leaving its file out). */
export async function setup() {
  const fake = createFakeVault({ basePath: '/vault' });
  const base = buildSnapshotFixture({ files: 12, directories: 2 });
  const snap: CodebaseSnapshot = { ...base, scope: { ...base.scope, rootPath: '/elsewhere/code' } };
  const harness = createFakeProfileStoreHarness();
  await harness.writeRaw({ profiles: [{ profileId: snap.repositoryId, name: 'Alpha', bindingId: null, exclusions: ['.git'], maxFileBytes: 1_000_000 }] });
  const notes = createInvestigationNotes(fake.app, {
    folders: createFakeInvestigationFolders({ [snap.repositoryId]: 'Notes' }), profiles: harness.store,
    clock: createFixedClock('2026-09-25T10:00:00.000Z'), registerEvent: () => undefined,
  });
  const { gate, wrapped } = gated(notes);
  useCityStore().setCity(snap, computeLayout(snap));
  attachSyntheticReport(snap);
  useInvestigationStore().setPorts(wrapped, scriptedSourcePreview());
  useReviewStore().setRepositoryFactory(() => createInMemoryReviewRepository());
  await useReviewStore().bindRepository(snap.repositoryId);
  useCityStore().navigate('investigate');
  const row = useReadModels().investigation.value.rows.find((r) => r.kind === 'unused-exports')!;
  useInvestigationStore().open(row.fingerprint);
  const w = mount(InvestigateScreen, { attachTo: document.body });
  await flushPromises();
  await w.find('.ci-notes-panel__create').trigger('click');
  await flushPromises();
  await w.find('.ci-create-note__confirm').trigger('click');
  await flushPromises();
  const path = `Notes/${noteBaseName(row.id, FINDING_KIND_LABEL[row.kind], row.file.name)}.md`;
  if (fake.paths().join() !== path) throw new Error(`test setup: expected one note at ${path}`);
  return { fake, snap, row, w, path, gate };
}

export type Ctx = Awaited<ReturnType<typeof setup>>;
type Mounted = Ctx['w'];

export async function click(w: Mounted, selector: string): Promise<void> {
  await w.find(selector).trigger('click');
  await flushPromises();
}
export const liveText = (w: Mounted): string => w.find('.ci-investigate__live').text();
/** Everything after the end-marker line: the user's own sections. */
export const afterBlock = (text: string): string => text.slice(text.indexOf(`${EVIDENCE_END}\n`) + EVIDENCE_END.length + 1);
export const blockOf = (text: string): string => text.slice(0, text.indexOf(EVIDENCE_END));

export function frontmatterOf(ctx: Ctx): Record<string, unknown> {
  const file = ctx.fake.app.vault.getFileByPath(ctx.path);
  if (file === null) throw new Error(`no file at ${ctx.path}`);
  return ctx.fake.app.metadataCache.getFileCache(file)?.frontmatter as Record<string, unknown>;
}

/** Re-attaches the same findings to a new scan of the same codebase. */
export async function rescan(ctx: Ctx, snapshotId = 'snapshot-next'): Promise<void> {
  const next = { ...ctx.snap, snapshotId };
  useCityStore().setCity(next, computeLayout(next));
  useEvidenceStore().attach(syntheticEvidenceReport(next));
  await flushPromises();
}

/** A report for the same snapshot that no longer lists the note's finding (IN34). */
export async function dropFinding(ctx: Ctx): Promise<void> {
  const kept = ctx.snap.entities.filter((e) => e.kind === 'file' && e.path !== ctx.row.anchorPath).map((e) => e.path);
  useEvidenceStore().attach(syntheticEvidenceReport(snapshotWithOnlyFiles(ctx.snap, kept), { snapshotId: ctx.snap.snapshotId }));
  await flushPromises();
}

/** Binds the leaf to another codebase, as App's repository watcher does. The fixture gives
 *  it the same paths and finding ids, so the same portable fingerprints; `without` leaves
 *  that file's findings out of its report, so a note's finding is not reported there. */
export async function switchCodebase(without?: string): Promise<void> {
  const other = buildSnapshotFixture({ files: 12, directories: 2, repositoryId: 'repo-other' });
  useCityStore().setCity(other, computeLayout(other));
  const kept = other.entities.filter((e) => e.kind === 'file' && e.path !== without).map((e) => e.path);
  attachSyntheticReport(snapshotWithOnlyFiles(other, kept), { snapshotId: other.snapshotId });
  await flushPromises();
}

export async function userEdit(ctx: Ctx, edit: (text: string) => string): Promise<void> {
  ctx.fake.userWrite(ctx.path, edit(ctx.fake.text(ctx.path)!));
  await flushPromises();
}
