// WP-04 Task 13 polish: shared setup for the create dialog's tests, split across
// investigate-create.test.ts (IN19, IN20, IN26-IN30, O4, O7) and
// investigate-create-review.test.ts (a refusal that lands after the dialog closed) — one
// file would pass the 450-line cap, mirroring investigate-refresh-support.ts. Not itself a
// `*.test.ts`, so vitest never collects it as a suite. Notes are created through the REAL
// host notes port over the in-memory fake vault; nothing here mocks the port.
import { flushPromises, mount } from '@vue/test-utils';
import '../mocks/obsidian';
import InvestigateScreen from '../../src/ui/screens/InvestigateScreen.vue';
import { useCityStore } from '../../src/ui/stores/city-store';
import { useInvestigationStore } from '../../src/ui/stores/investigation-store';
import { useReviewStore } from '../../src/ui/stores/review-store';
import { useReadModels } from '../../src/ui/read-models/use-read-models';
import { createInMemoryReviewRepository } from '../../src/ui/stores/ports/review-repository';
import { computeLayout } from '../../src/domain/layout/layout';
import { noteBaseName } from '../../src/application/investigation/note-path';
import { createInvestigationNotes } from '../../src/host/investigation-notes';
import type { InvestigationNotesPort } from '../../src/application/ports/investigation-notes-port';
import { createFakeVault } from '../fixtures/fake-vault';
import { createFakeProfileStoreHarness } from '../fixtures/fake-profile-store';
import { createFakeInvestigationFolders } from '../fixtures/fake-investigation-folders';
import { scriptedSourcePreview } from '../fixtures/fake-investigation';
import { createFixedClock } from '../fixtures/clock';
import { buildSnapshotFixture } from '../fixtures/snapshot-builder';
import { attachSyntheticReport } from '../fixtures/evidence-report';
import { FINDING_KIND_LABEL } from '../../src/ui/inspector-copy';

export interface SetupOptions { readonly rootPath?: string; readonly folder?: string }

/** Fix round 1: a transparent wrapper over the REAL port — `hold()` parks every create
 *  until `release()` (a write in flight), `hidden` keeps paths out of the listed index (a
 *  metadata cache that has not caught up yet), and `rejectOpen` makes Open reject. */
export function gated(port: InvestigationNotesPort) {
  const waiting: (() => void)[] = [];
  const gate = {
    holding: false, rejectOpen: false, hidden: new Set<string>(),
    hold: () => { gate.holding = true; },
    release: () => { gate.holding = false; for (const go of waiting.splice(0)) go(); },
  };
  const wrapped: InvestigationNotesPort = {
    ...port,
    list: (id) => {
      const index = port.list(id);
      const visible = Array.from(index.byFingerprint, ([k, links]) => [k, links.filter((l) => !gate.hidden.has(l.path))] as const);
      return { malformed: index.malformed, byFingerprint: new Map(visible) };
    },
    create: async (request) => {
      if (gate.holding) await new Promise<void>((resolve) => { waiting.push(resolve); });
      return port.create(request);
    },
    open: (path) => (gate.rejectOpen ? Promise.reject(new Error('host failed')) : port.open(path)),
  };
  return { gate, wrapped };
}

export async function setup(options: SetupOptions = {}) {
  const fake = createFakeVault({ basePath: '/vault' });
  const base = buildSnapshotFixture({ files: 12, directories: 2 });
  const snap = { ...base, scope: { ...base.scope, rootPath: options.rootPath ?? '/elsewhere/code' } };
  const harness = createFakeProfileStoreHarness();
  await harness.writeRaw({ profiles: [{ profileId: snap.repositoryId, name: 'Alpha', bindingId: null, exclusions: ['.git'], maxFileBytes: 1_000_000 }] });
  const folders = createFakeInvestigationFolders({ [snap.repositoryId]: options.folder ?? 'Notes' });
  const notes = createInvestigationNotes(fake.app, {
    folders, profiles: harness.store, clock: createFixedClock('2026-09-25T10:00:00.000Z'), registerEvent: () => undefined,
  });
  const { gate, wrapped } = gated(notes);
  useCityStore().setCity(snap, computeLayout(snap));
  attachSyntheticReport(snap);
  useInvestigationStore().setPorts(wrapped, scriptedSourcePreview());
  useReviewStore().setRepositoryFactory(() => createInMemoryReviewRepository());
  await useReviewStore().bindRepository(snap.repositoryId);
  useCityStore().navigate('investigate');
  const row = useReadModels().investigation.value.rows[0]!;
  useInvestigationStore().open(row.fingerprint);
  const w = mount(InvestigateScreen, { attachTo: document.body });
  await flushPromises();
  const name = noteBaseName(row.id, FINDING_KIND_LABEL[row.kind], row.file.name);
  const exclusions = async (): Promise<readonly string[]> => (await harness.store.get(snap.repositoryId))?.exclusions ?? [];
  return { fake, snap, folders, row, w, name, exclusions, gate, profiles: harness.store };
}

export type Ctx = Awaited<ReturnType<typeof setup>>;
export type Mounted = Ctx['w'];

export async function openDialog(w: Mounted): Promise<void> {
  await w.find('.ci-notes-panel__create').trigger('click');
  await flushPromises();
}
export async function confirm(w: Mounted): Promise<void> {
  await w.find('.ci-create-note__confirm').trigger('click');
  await flushPromises();
}
export const dialogText = (w: Mounted): string => w.find('.ci-create-note').text();
export const liveText = (w: Mounted): string => w.find('.ci-investigate__live').text();
export const writes = (fake: ReturnType<typeof createFakeVault>): number => fake.calls.create + fake.calls.createFolder;
export const openButtons = (w: Mounted) => w.findAll('.ci-notes-panel__open');

export function frontmatterOf(fake: ReturnType<typeof createFakeVault>, path: string): unknown {
  const file = fake.app.vault.getFileByPath(path);
  if (file === null) throw new Error(`no file at ${path}`);
  return fake.app.metadataCache.getFileCache(file)?.frontmatter;
}
