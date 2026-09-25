// WP-04 IN19, IN20, IN26-IN30 (O4, O7; IP9, IP24, IP26, IP38; E40): creating an
// investigation note from the Investigate screen and the linked-notes panel, through the
// REAL host notes port over the in-memory fake vault (Task 7) and a profile store holding
// the snapshot's codebase. Nothing here mocks the port: plan/create/open are the host's own.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import '../mocks/obsidian';
import type { TFile } from 'obsidian';
import InvestigateScreen from '../../src/ui/screens/InvestigateScreen.vue';
import { useCityStore } from '../../src/ui/stores/city-store';
import { useInvestigationStore } from '../../src/ui/stores/investigation-store';
import { useReviewStore } from '../../src/ui/stores/review-store';
import { useEvidenceStore } from '../../src/ui/stores/evidence-store';
import { useReadModels } from '../../src/ui/read-models/use-read-models';
import { findingRef } from '../../src/ui/read-models/review-state';
import { createInMemoryReviewRepository } from '../../src/ui/stores/ports/review-repository';
import { computeLayout } from '../../src/domain/layout/layout';
import { noteBaseName } from '../../src/application/investigation/note-path';
import { createInvestigationNotes } from '../../src/host/investigation-notes';
import type { InvestigationNotesPort } from '../../src/application/ports/investigation-notes-port';
import {
  FINDING_KIND_LABEL, NOTE_CREATE_EXCLUDE, NOTE_CREATE_OVERLAP, NOTE_CREATE_PATH, NOTE_CREATE_REFUSED, NOTE_CREATE_RENAMED,
  NOTE_CREATE_ROOT_IS_FOLDER, NOTE_CREATED, NOTE_CREATED_EXCLUDED, NOTE_EXCLUSION_FAILED, NOTE_OPEN_FAILED, NOTE_PANEL_NONE, NOTE_STATUS,
  NOTES_FOLDER_PROBLEM, NOTES_FOLDER_ROW_FAILED,
} from '../../src/ui/inspector-copy';
import { buildSnapshotFixture } from '../fixtures/snapshot-builder';
import { attachSyntheticReport } from '../fixtures/evidence-report';
import { createFakeVault } from '../fixtures/fake-vault';
import { createFakeProfileStoreHarness } from '../fixtures/fake-profile-store';
import { createFakeInvestigationFolders } from '../fixtures/fake-investigation-folders';
import { scriptedSourcePreview } from '../fixtures/fake-investigation';
import { createFixedClock } from '../fixtures/clock';

interface SetupOptions { readonly rootPath?: string; readonly folder?: string }

/** Fix round 1: a transparent wrapper over the REAL port — `hold()` parks every create
 *  until `release()` (a write in flight), `hidden` keeps paths out of the listed index (a
 *  metadata cache that has not caught up yet), and `rejectOpen` makes Open reject. */
function gated(port: InvestigationNotesPort) {
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

async function setup(options: SetupOptions = {}) {
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

type Mounted = Awaited<ReturnType<typeof setup>>['w'];

async function openDialog(w: Mounted): Promise<void> {
  await w.find('.ci-notes-panel__create').trigger('click');
  await flushPromises();
}
async function confirm(w: Mounted): Promise<void> {
  await w.find('.ci-create-note__confirm').trigger('click');
  await flushPromises();
}
const dialogText = (w: Mounted): string => w.find('.ci-create-note').text();
const liveText = (w: Mounted): string => w.find('.ci-investigate__live').text();
const writes = (fake: ReturnType<typeof createFakeVault>): number => fake.calls.create + fake.calls.createFolder;
const openButtons = (w: Mounted) => w.findAll('.ci-notes-panel__open');

function frontmatterOf(fake: ReturnType<typeof createFakeVault>, path: string): unknown {
  const file = fake.app.vault.getFileByPath(path);
  if (file === null) throw new Error(`no file at ${path}`);
  return fake.app.metadataCache.getFileCache(file)?.frontmatter;
}

describe('the create dialog (IN26, IN19, IN27; E40)', () => {
  beforeEach(() => { setActivePinia(createPinia()); });

  it('IN26: opens with the destination folder and the planned name, shows the vault path, and writes nothing while open', async () => {
    const { w, fake, name } = await setup();
    expect(w.find('.ci-notes-panel__none').text()).toBe(NOTE_PANEL_NONE);
    await openDialog(w);
    expect((w.find('.ci-create-note__folder').element as HTMLInputElement).value).toBe('Notes');
    expect((w.find('.ci-create-note__name').element as HTMLInputElement).value).toBe(name);
    expect(w.find('.ci-create-note__path-label').text()).toBe(NOTE_CREATE_PATH);
    expect(w.find('.ci-create-note__path').text()).toBe(`Notes/${name}.md`);
    await w.find('.ci-create-note__folder').setValue('Elsewhere/deeper');
    await w.find('.ci-create-note__name').setValue('my note');
    expect(w.find('.ci-create-note__path').text()).toBe('Elsewhere/deeper/my note.md');
    expect(writes(fake)).toBe(0);
    expect(fake.paths()).toEqual([]);
    w.unmount();
  });

  it('Task 10 carry: re-reads the folder setting on open, and says so when it cannot be read', async () => {
    const { w, snap, folders } = await setup();
    await folders.write(snap.repositoryId, 'Changed/Here');
    await openDialog(w);
    expect((w.find('.ci-create-note__folder').element as HTMLInputElement).value).toBe('Changed/Here');
    expect(w.find('.ci-create-note__destination-failed').exists()).toBe(false);
    await w.find('.ci-create-note__cancel').trigger('click');
    folders.read = () => Promise.reject(new Error('unreadable'));
    await openDialog(w);
    expect(w.find('.ci-create-note__destination-failed').text()).toBe(NOTES_FOLDER_ROW_FAILED);
    w.unmount();
  });

  it('a selection change closes the dialog for good: it never reopens for another finding', async () => {
    const { w, row } = await setup();
    await openDialog(w);
    const other = useReadModels().investigation.value.rows[1]!;
    useInvestigationStore().open(other.fingerprint);
    await flushPromises();
    expect(w.find('.ci-create-note').exists()).toBe(false);
    useInvestigationStore().open(row.fingerprint);
    await flushPromises();
    expect(w.find('.ci-create-note').exists()).toBe(false);
    w.unmount();
  });

  it.each([
    ['../x', 'not-relative'], ['/abs', 'not-relative'], ['C:\\x', 'not-relative'], ['.obsidian/x', 'config-dir'],
  ] as const)('IN19: the folder %s shows its problem; Create is aria-disabled and writes nothing', async (value, problem) => {
    const { w, fake } = await setup();
    await openDialog(w);
    await w.find('.ci-create-note__folder').setValue(value);
    expect(w.find('.ci-create-note__problem').text()).toBe(NOTES_FOLDER_PROBLEM[problem]);
    expect(w.find('.ci-create-note__path').exists()).toBe(false);
    const create = w.find('.ci-create-note__confirm');
    expect(create.attributes('aria-disabled')).toBe('true');
    await confirm(w);
    expect(writes(fake)).toBe(0);
    expect(w.find('.ci-create-note').exists()).toBe(true);
    expect(w.find('.ci-create-note__error').exists()).toBe(false);
    w.unmount();
  });

  it('IN27: a taken name shows its (2) name and path before confirm; confirming writes it and leaves the first file byte-identical', async () => {
    const { w, fake, name } = await setup();
    await fake.app.vault.createFolder('Notes');
    await fake.app.vault.create(`Notes/${name}.md`, 'mine\r\n');
    await openDialog(w);
    expect(w.find('.ci-create-note__renamed').text()).toBe(NOTE_CREATE_RENAMED(`${name} (2).md`));
    expect(w.find('.ci-create-note__path').text()).toBe(`Notes/${name} (2).md`);
    await confirm(w);
    expect(fake.paths()).toEqual([`Notes/${name} (2).md`, `Notes/${name}.md`]);
    expect(fake.text(`Notes/${name}.md`)).toBe('mine\r\n');
    w.unmount();
  });
});

describe('inside the codebase root (IN29, IP26)', () => {
  beforeEach(() => { setActivePinia(createPinia()); });

  it('a folder inside the root shows the overlap, checked; confirming adds its root-relative exclusion and says so', async () => {
    const { w, name, exclusions } = await setup({ rootPath: '/vault/code', folder: 'code/notes' });
    await openDialog(w);
    expect(dialogText(w)).toContain(NOTE_CREATE_OVERLAP);
    const box = w.find('.ci-create-note__exclude input[type="checkbox"]');
    expect(w.find('.ci-create-note__exclude').text()).toBe(NOTE_CREATE_EXCLUDE);
    expect((box.element as HTMLInputElement).checked).toBe(true);
    await confirm(w);
    expect(await exclusions()).toEqual(['.git', 'notes']);
    expect(liveText(w)).toBe(NOTE_CREATED_EXCLUDED(`code/notes/${name}.md`, 'notes'));   // E21: the saved exclusion
    expect(liveText(w)).toContain(' notes ');
    expect(liveText(w)).not.toContain('added code/notes');
    w.unmount();
  });

  it('IP26: an exclusion the profile store refuses keeps the note and announces NOTE_EXCLUSION_FAILED', async () => {
    const { w, fake, name, exclusions, profiles } = await setup({ rootPath: '/vault/code', folder: 'code/notes' });
    vi.spyOn(profiles, 'update').mockRejectedValue(new Error('locked'));
    await openDialog(w);
    await confirm(w);
    expect(fake.paths()).toEqual([`code/notes/${name}.md`]);
    expect(await exclusions()).toEqual(['.git']);
    expect(liveText(w)).toBe(NOTE_EXCLUSION_FAILED(`code/notes/${name}.md`));
    w.unmount();
  });

  it('unchecking the box leaves the exclusions unchanged', async () => {
    const { w, name, exclusions } = await setup({ rootPath: '/vault/code', folder: 'code/notes' });
    await openDialog(w);
    await w.find('.ci-create-note__exclude input[type="checkbox"]').setValue(false);
    await confirm(w);
    expect(await exclusions()).toEqual(['.git']);
    expect(liveText(w)).toBe(NOTE_CREATED(`code/notes/${name}.md`));
    w.unmount();
  });

  it('a folder outside the root shows neither; the root folder itself shows its own words and no checkbox', async () => {
    const { w } = await setup({ rootPath: '/vault/code', folder: 'Notes' });
    await openDialog(w);
    expect(dialogText(w)).not.toContain(NOTE_CREATE_OVERLAP);
    expect(dialogText(w)).not.toContain(NOTE_CREATE_ROOT_IS_FOLDER);
    expect(w.find('.ci-create-note__exclude').exists()).toBe(false);
    await w.find('.ci-create-note__folder').setValue('code');
    expect(w.find('.ci-create-note__root').text()).toBe(NOTE_CREATE_ROOT_IS_FOLDER);
    expect(dialogText(w)).not.toContain(NOTE_CREATE_OVERLAP);
    expect(w.find('.ci-create-note__exclude').exists()).toBe(false);
    w.unmount();
  });
});

describe('create, the race and the notes panel (IN20, IN28, IN30; IP24, E40)', () => {
  beforeEach(() => { setActivePinia(createPinia()); });

  it('one confirm writes one IN20 note; the dialog closes, announces once, lists the note and focuses its Open', async () => {
    const { w, fake, snap, row, name } = await setup();
    const path = `Notes/${name}.md`;
    const live = w.find('.ci-investigate__live').element;
    const seen: string[] = [];
    const observer = new MutationObserver(() => { seen.push(live.textContent?.trim() ?? ''); });
    observer.observe(live, { childList: true, characterData: true, subtree: true });
    await openDialog(w);
    await confirm(w);
    observer.disconnect();
    expect(fake.paths()).toEqual([path]);
    const fm = frontmatterOf(fake, path) as Record<string, unknown>;
    expect(Object.keys(fm)).toEqual([
      'type', 'codebase_id', 'entity_id', 'source_path', 'snapshot_id', 'finding_id', 'finding_fingerprint', 'provider', 'status', 'created',
    ]);
    expect(fm).toMatchObject({
      type: 'codebase-investigation', codebase_id: snap.repositoryId, entity_id: `file:${row.anchorPath}`, source_path: row.anchorPath,
      snapshot_id: snap.snapshotId, finding_id: row.id, provider: 'fallow', status: 'open', created: '2026-09-25T10:00:00.000Z',
    });
    expect(fm.finding_fingerprint).toBe(findingRef(row.fingerprint));
    expect(fake.opened).toEqual([]);   // IP24: creating never opens the note
    expect(w.find('.ci-create-note').exists()).toBe(false);
    expect(seen.filter((t) => t === NOTE_CREATED(path))).toHaveLength(1);
    expect(liveText(w)).toBe(NOTE_CREATED(path));
    expect(w.find('.ci-notes-panel__path').text()).toBe(path);
    expect(w.find('.ci-notes-panel__status').text()).toBe(NOTE_STATUS('open'));
    const open = openButtons(w);
    expect(open).toHaveLength(1);
    expect(document.activeElement).toBe(open[0]!.element);
    expect(open[0]!.attributes('data-path')).toBe(path);
    w.unmount();
  });

  it('E40: two presses of Create before the first resolves create one file', async () => {
    const { w, fake } = await setup();
    await openDialog(w);
    const create = w.find('.ci-create-note__confirm');
    void create.trigger('click');
    void create.trigger('click');
    await flushPromises();
    expect(fake.calls.create).toBe(1);
    expect(fake.paths()).toHaveLength(1);
    w.unmount();
  });

  it('the race: another writer takes the name first; the refusal stays in the dialog, announces nothing, and re-plans', async () => {
    const { w, fake, name } = await setup();
    const path = `Notes/${name}.md`;
    await openDialog(w);
    fake.raceNextCreate(path, 'theirs');
    await confirm(w);
    expect(w.find('.ci-create-note__error[role="alert"]').text()).toBe(NOTE_CREATE_REFUSED.exists);
    expect(liveText(w)).toBe('');
    expect(fake.text(path)).toBe('theirs');
    expect(w.find('.ci-create-note__renamed').text()).toBe(NOTE_CREATE_RENAMED(`${name} (2).md`));
    w.unmount();
  });

  it('IN30: Open calls the port; two notes for one finding are listed by path and each opens its own file', async () => {
    const { w, fake, name } = await setup();
    await openDialog(w);
    await confirm(w);
    await openDialog(w);
    await confirm(w);
    const paths = [`Notes/${name} (2).md`, `Notes/${name}.md`];
    expect(w.findAll('.ci-notes-panel__path').map((p) => p.text())).toEqual(paths);
    const open = openButtons(w);
    expect(open.map((b) => b.attributes('data-path'))).toEqual(paths);
    await open[1]!.trigger('click');
    await flushPromises();
    await open[0]!.trigger('click');
    await flushPromises();
    expect(fake.opened).toEqual([paths[1], paths[0]]);
    w.unmount();
  });

  it('Open that finds no file shows NOTE_OPEN_FAILED under that note; a double press opens once', async () => {
    const { w, fake, name } = await setup();
    await openDialog(w);
    await confirm(w);
    const path = `Notes/${name}.md`;
    const getFile = vi.spyOn(fake.app.vault, 'getFileByPath').mockReturnValueOnce(null);
    await openButtons(w)[0]!.trigger('click');
    await flushPromises();
    expect(w.find('.ci-notes-panel__open-error[role="alert"]').text()).toBe(NOTE_OPEN_FAILED);
    getFile.mockRestore();
    const waiting: (() => void)[] = [];
    const leaf = { openFile: vi.fn((_file: TFile) => new Promise<void>((resolve) => { waiting.push(resolve); })) };
    vi.spyOn(fake.app.workspace, 'getLeaf').mockReturnValue(leaf as never);
    const button = openButtons(w)[0]!;
    await button.trigger('click');
    expect(button.attributes('aria-disabled')).toBe('true');
    await button.trigger('click');
    expect(waiting).toHaveLength(1);
    waiting[0]!();
    await flushPromises();
    expect(leaf.openFile).toHaveBeenCalledTimes(1);
    expect(w.find('.ci-notes-panel__open-error').exists()).toBe(false);
    expect(fake.paths()).toEqual([path]);
    w.unmount();
  });
});

describe('outcomes outside the dialog (Task 13 review, fix round 1)', () => {
  beforeEach(() => { setActivePinia(createPinia()); });

  it('review 1: a note written after a selection change closed the dialog is still announced', async () => {
    const { w, fake, gate, name } = await setup();
    await openDialog(w);
    gate.hold();
    await w.find('.ci-create-note__confirm').trigger('click');
    useInvestigationStore().open(useReadModels().investigation.value.rows[1]!.fingerprint);
    await flushPromises();
    expect(w.find('.ci-create-note').exists()).toBe(false);
    expect(fake.paths()).toEqual([]);
    gate.release();
    await flushPromises();
    expect(fake.paths()).toEqual([`Notes/${name}.md`]);
    expect(liveText(w)).toBe(NOTE_CREATED(`Notes/${name}.md`));
    expect(w.find('.ci-create-note').exists()).toBe(false);
    w.unmount();
  });

  it('review 2 (E22): a codebase switch mid-write announces nothing in the other codebase; the note is still written', async () => {
    const { w, fake, gate, name } = await setup();
    await openDialog(w);
    gate.hold();
    await w.find('.ci-create-note__confirm').trigger('click');
    const other = buildSnapshotFixture({ files: 12, directories: 2, repositoryId: 'repo-other' });
    useCityStore().setCity(other, computeLayout(other));
    attachSyntheticReport(other);
    await flushPromises();
    expect(useEvidenceStore().repositoryId).toBe('repo-other');
    expect(w.find('.ci-create-note').exists()).toBe(false);
    gate.release();
    await flushPromises();
    expect(fake.paths()).toEqual([`Notes/${name}.md`]);
    expect(liveText(w)).toBe('');
    w.unmount();
  });

  it('review 2: a notes change without the new note drops the pending focus, so a later change never moves focus', async () => {
    const { w, fake, gate, name } = await setup();
    const first = `Notes/${name}.md`;
    const second = `Notes/${name} (2).md`;
    await openDialog(w);
    await confirm(w);
    gate.hidden.add(second);   // the index has not heard of the second note yet
    await openDialog(w);
    await confirm(w);
    expect(fake.paths()).toEqual([second, first]);
    expect(liveText(w)).toBe(NOTE_CREATED(second));
    const focused = document.activeElement;
    fake.userWrite(first, fake.text(first)!.replace('status: open', 'status: doing'));   // unrelated
    await flushPromises();
    gate.hidden.delete(second);
    fake.userWrite(second, fake.text(second)!.replace('status: open', 'status: doing'));
    await flushPromises();
    expect(openButtons(w).map((b) => b.attributes('data-path'))).toEqual([second, first]);
    expect(w.findAll('.ci-notes-panel__status').map((s) => s.text())).toEqual([NOTE_STATUS('doing'), NOTE_STATUS('doing')]);
    expect(document.activeElement).toBe(focused);
    w.unmount();
  });

  it('review 5: a rejected Open shows the failure and never leaves Open stuck', async () => {
    const { w, fake, gate, name } = await setup();
    await openDialog(w);
    await confirm(w);
    gate.rejectOpen = true;
    await openButtons(w)[0]!.trigger('click');
    await flushPromises();
    expect(w.find('.ci-notes-panel__open-error[role="alert"]').text()).toBe(NOTE_OPEN_FAILED);
    expect(openButtons(w)[0]!.attributes('aria-disabled')).toBeUndefined();
    gate.rejectOpen = false;
    await openButtons(w)[0]!.trigger('click');
    await flushPromises();
    expect(fake.opened).toEqual([`Notes/${name}.md`]);
    expect(w.find('.ci-notes-panel__open-error').exists()).toBe(false);
    w.unmount();
  });

  it('review 6 (E13): Cancel and Escape are ignored while the write is in flight', async () => {
    const { w, fake, gate, name } = await setup();
    await openDialog(w);
    gate.hold();
    await w.find('.ci-create-note__confirm').trigger('click');
    await w.find('.ci-create-note__cancel').trigger('click');
    await w.find('.ci-dialog').trigger('keydown', { key: 'Escape' });
    await flushPromises();
    expect(w.find('.ci-create-note').exists()).toBe(true);
    expect(w.find('.ci-create-note__cancel').attributes('aria-disabled')).toBe('true');
    gate.release();
    await flushPromises();
    expect(fake.paths()).toEqual([`Notes/${name}.md`]);
    expect(w.find('.ci-create-note').exists()).toBe(false);
    expect(liveText(w)).toBe(NOTE_CREATED(`Notes/${name}.md`));
    w.unmount();
  });
});
