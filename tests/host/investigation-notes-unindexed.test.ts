// WP-04 Part 2 Task 1 (NPF15, P2, PN2): a note folder that exists on disk but that Obsidian has not indexed
// yet is used as is, not refused as write-failed. Builds the request the same way
// tests/host/investigation-notes.test.ts does (that file is at its 440-line cap and never grows, so this case
// lives here instead).
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
const BODY = `${EVIDENCE_BEGIN}\n## Context\nfirst\n${EVIDENCE_END}\n\n## Investigation notes\n_prompt_\n\n## Decision\n_decide_\n`;

async function setup() {
  const fake = createFakeVault({ basePath: '/vault' });
  const harness = createFakeProfileStoreHarness();
  await harness.writeRaw({ profiles: [{ profileId: 'p1', name: 'Alpha', bindingId: null, exclusions: ['.git'], maxFileBytes: 1_000_000 }] });
  const clock = createFixedClock('2026-09-25T10:00:00.000Z');
  const notes = createInvestigationNotes(fake.app, {
    folders: createFakeInvestigationFolders(), profiles: harness.store, clock, registerEvent: () => undefined,
  });
  return { fake, notes };
}

function request(overrides: Partial<CreateNoteRequest> = {}): CreateNoteRequest {
  return { identity: IDENTITY, folder: 'code/notes', baseName: 'UN-1 x', body: BODY, excludeFolder: false, rootPath: null, ...overrides };
}

describe('create: a folder on disk Obsidian has not indexed yet (WP-04.2 NPF15, P2)', () => {
  it('is used as is: created, and only the missing child segment is createFolder-ed', async () => {
    const { fake, notes } = await setup();
    fake.diskOnly('code', 'folder');
    expect(await notes.create(request())).toEqual({ status: 'created', path: 'code/notes/UN-1 x.md', exclusion: 'not-requested' });
    // 'code' is used as is (never created); 'code/notes' is the only missing segment.
    expect(fake.calls.createFolder).toBe(1);
  });

  it('control: a disk-only FILE at the segment still refuses as write-failed, creating nothing', async () => {
    const { fake, notes } = await setup();
    fake.diskOnly('code', 'file');
    expect(await notes.create(request())).toEqual({ status: 'refused', reason: 'write-failed' });
    expect(fake.calls.createFolder).toBe(0);
    expect(fake.calls.create).toBe(0);
    expect(fake.paths()).toEqual([]);
  });

  it('control: an already-indexed folder (every segment) takes no stat call', async () => {
    const { fake, notes } = await setup();
    await fake.app.vault.createFolder('code');
    await fake.app.vault.createFolder('code/notes');
    expect(await notes.create(request())).toMatchObject({ status: 'created', path: 'code/notes/UN-1 x.md' });
    expect(fake.calls.stat).toBe(0);
  });
});
