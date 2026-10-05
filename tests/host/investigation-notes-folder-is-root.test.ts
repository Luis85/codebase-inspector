// Gap closure GRB7 (scenario 46's fast pin): a notes folder that IS the codebase folder is refused at plan time with
// `folder-is-root`, and `create` (which re-plans) writes nothing and leaves the exclusions alone. A folder strictly
// inside the root is the control: it keeps `ok` with `overlapsRoot`.
import { describe, expect, it } from 'vitest';
import { createFakeVault } from '../fixtures/fake-vault';
import { createFakeInvestigationFolders } from '../fixtures/fake-investigation-folders';
import { createFakeProfileStoreHarness } from '../fixtures/fake-profile-store';
import { createFixedClock } from '../fixtures/clock';
import { createInvestigationNotes } from '../../src/host/investigation-notes';
import { EVIDENCE_BEGIN, EVIDENCE_END } from '../../src/application/investigation/note-model';
import type { NoteIdentity } from '../../src/application/investigation/note-model';
import type { CreateNoteRequest } from '../../src/application/ports/investigation-notes-port';

const IDENTITY: NoteIdentity = { codebaseId: 'p1', sourcePath: 'src/a.ts', snapshotId: 's1', findingId: 'UN-1' };
const BODY = `${EVIDENCE_BEGIN}\n## Context\nfirst\n${EVIDENCE_END}\n\n## Investigation notes\n_prompt_\n`;

async function setup(basePath: string | null = '/vault') {
  const fake = createFakeVault({ basePath });
  const harness = createFakeProfileStoreHarness();
  await harness.writeRaw({ profiles: [{ profileId: 'p1', name: 'Alpha', bindingId: null, exclusions: ['.git'], maxFileBytes: 1_000_000 }] });
  const notes = createInvestigationNotes(fake.app, {
    folders: createFakeInvestigationFolders(), profiles: harness.store, clock: createFixedClock('2026-09-26T10:00:00.000Z'),
    registerEvent: () => undefined,
  });
  return { fake, notes, profiles: harness.store };
}

describe('plan: a folder that is the codebase folder (GRB7)', () => {
  it.each([
    ['the folder is the root', '/vault', '/vault/code', 'code'],
    ['a Windows root', 'C:\\v', 'C:\\v\\code', 'code'],
  ] as const)('%s: folder-is-root', async (_label, basePath, rootPath, folder) => {
    const { notes } = await setup(basePath);
    expect(notes.plan(folder, 'x', rootPath)).toEqual({ status: 'folder-is-root' });
  });

  it('control: a folder inside the root keeps ok with overlapsRoot (the vault as the root included); one outside does not overlap', async () => {
    const { notes } = await setup();
    expect(notes.plan('code/notes', 'x', '/vault/code')).toMatchObject({ status: 'ok', overlapsRoot: true, rootRelativeFolder: 'notes' });
    expect(notes.plan('Notes', 'x', '/vault')).toMatchObject({ status: 'ok', overlapsRoot: true, rootRelativeFolder: 'Notes' });
    expect(notes.plan('Notes', 'x', '/vault/code')).toMatchObject({ status: 'ok', overlapsRoot: false, rootRelativeFolder: null });
  });

  it('create refuses the root folder, writes nothing, and leaves the exclusions alone', async () => {
    const { fake, notes, profiles } = await setup();
    const request: CreateNoteRequest = { identity: IDENTITY, folder: 'code', baseName: 'UN-1 x', body: BODY, excludeFolder: true, rootPath: '/vault/code' };
    expect(await notes.create(request)).toEqual({ status: 'refused', reason: 'invalid' });
    expect(fake.paths()).toEqual([]);
    expect((await profiles.get('p1'))?.exclusions).toEqual(['.git']);
    expect(await notes.create({ ...request, folder: 'code/notes' })).toMatchObject({ status: 'created', exclusion: 'added' });
  });
});
