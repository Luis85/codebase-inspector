// WP-04 Task 9 (IN33, IP13; Review Focus 5 "rename and duplicate"): the host note index over
// the fake vault's metadata cache. The fake fires `changed` asynchronously (WP-04 E12), so
// every test awaits the event it depends on.
import { describe, expect, it } from 'vitest';
import { stringifyYaml } from '../mocks/obsidian';
import { createFakeVault } from '../fixtures/fake-vault';
import type { FakeVault } from '../fixtures/fake-vault';
import { createFakeInvestigationFolders } from '../fixtures/fake-investigation-folders';
import { createFakeProfileStoreHarness } from '../fixtures/fake-profile-store';
import { createFixedClock } from '../fixtures/clock';
import { createNoteIndexSource } from '../../src/host/investigation-note-index';
import { createInvestigationNotes } from '../../src/host/investigation-notes';
import { noteFrontmatter } from '../../src/application/investigation/note-model';
import type { NoteIdentity } from '../../src/application/investigation/note-model';

const IDENTITY: NoteIdentity = { codebaseId: 'p1', sourcePath: 'src/a.ts', snapshotId: 's1', findingId: 'UN-1' };
const FINGERPRINT = 'src/a.ts#UN-1';

function noteText(identity: NoteIdentity = IDENTITY): string {
  return `---\n${stringifyYaml(noteFrontmatter(identity, '2026-09-25T10:00:00.000Z'))}---\n\nbody\n`;
}

// Registered AFTER the index's own listener, so it resolves once the index has applied the event.
function nextChanged(fake: FakeVault): Promise<void> {
  return new Promise((resolve) => { fake.app.metadataCache.on('changed', () => { resolve(); }); });
}

function started(fake: FakeVault): { source: ReturnType<typeof createNoteIndexSource>; refs: unknown[]; fired: () => number } {
  const refs: unknown[] = [];
  const source = createNoteIndexSource(fake.app, (ref) => { refs.push(ref); });
  let count = 0;
  source.subscribe(() => { count += 1; });
  return { source, refs, fired: () => count };
}

function pathsFor(source: ReturnType<typeof createNoteIndexSource>, fingerprint = FINGERPRINT): string[] {
  return (source.list('p1').byFingerprint.get(fingerprint) ?? []).map((link) => link.path);
}

describe('createNoteIndexSource: inert until used (spec 4.4, IP12)', () => {
  it('reads nothing and registers nothing until the first list or subscribe', async () => {
    const fake = createFakeVault({ basePath: '/vault' });
    await fake.app.vault.create('n.md', noteText());
    const refs: unknown[] = [];
    const source = createNoteIndexSource(fake.app, (ref) => { refs.push(ref); });
    const harness = createFakeProfileStoreHarness();
    createInvestigationNotes(fake.app, {
      folders: createFakeInvestigationFolders(), profiles: harness.store, clock: createFixedClock(),
      registerEvent: (ref) => { refs.push(ref); },
    });
    expect(fake.calls.getMarkdownFiles).toBe(0);
    expect(refs).toHaveLength(0);
    expect(pathsFor(source)).toEqual(['n.md']);
    expect(fake.calls.getMarkdownFiles).toBe(1);
  });

  it('subscribe alone starts the index too', () => {
    const fake = createFakeVault({ basePath: '/vault' });
    const refs: unknown[] = [];
    createNoteIndexSource(fake.app, (ref) => { refs.push(ref); }).subscribe(() => undefined);
    expect(fake.calls.getMarkdownFiles).toBe(1);
    expect(refs).toHaveLength(4);
  });

  it('registerEvent receives exactly four refs on first use, and none on later use', () => {
    const fake = createFakeVault({ basePath: '/vault' });
    const { source, refs } = started(fake);
    expect(refs).toHaveLength(4);
    source.list('p1');
    source.subscribe(() => undefined);
    expect(refs).toHaveLength(4);
    expect(fake.calls.getMarkdownFiles).toBe(1);
  });
});

describe('createNoteIndexSource: rename and duplicate (IN33, Review Focus 5)', () => {
  it('lists two notes with the same fingerprint, by path', async () => {
    const fake = createFakeVault({ basePath: '/vault' });
    const { source } = started(fake);
    let changed = nextChanged(fake);
    await fake.app.vault.create('z.md', noteText());
    await changed;
    changed = nextChanged(fake);
    await fake.app.vault.create('a.md', noteText());
    await changed;
    expect(pathsFor(source)).toEqual(['a.md', 'z.md']);
  });

  it('a rename moves the link and a delete drops it, one listener call each', async () => {
    const fake = createFakeVault({ basePath: '/vault' });
    const { source, fired } = started(fake);
    let changed = nextChanged(fake);
    await fake.app.vault.create('n.md', noteText());
    await changed;
    expect(fired()).toBe(1);
    changed = nextChanged(fake);
    fake.userRename('n.md', 'moved.md');
    await changed;
    expect(pathsFor(source)).toEqual(['moved.md']);
    expect(fired()).toBe(2);
    fake.userDelete('moved.md');
    expect(pathsFor(source)).toEqual([]);
    expect(fired()).toBe(3);
  });

  it('a rename to a non-Markdown name drops the link', async () => {
    const fake = createFakeVault({ basePath: '/vault' });
    const { source } = started(fake);
    let changed = nextChanged(fake);
    await fake.app.vault.create('n.md', noteText());
    await changed;
    changed = nextChanged(fake);
    fake.userRename('n.md', 'n.txt');
    await changed;
    expect(pathsFor(source)).toEqual([]);
  });

  it('an edit that changes the fingerprint moves the note to the new finding', async () => {
    const fake = createFakeVault({ basePath: '/vault' });
    const { source } = started(fake);
    let changed = nextChanged(fake);
    await fake.app.vault.create('n.md', noteText());
    await changed;
    changed = nextChanged(fake);
    fake.userWrite('n.md', noteText({ ...IDENTITY, findingId: 'UN-2' }));
    await changed;
    expect(pathsFor(source)).toEqual([]);
    expect(pathsFor(source, 'src/a.ts#UN-2')).toEqual(['n.md']);
  });

  it('does not fire for an unrelated Markdown file, nor for a resolve with nothing changed', async () => {
    const fake = createFakeVault({ basePath: '/vault' });
    let changed = nextChanged(fake);
    await fake.app.vault.create('other.md', 'plain text');
    await changed;
    const { source, fired } = started(fake);
    const before = source.list('p1');
    changed = nextChanged(fake);
    fake.userWrite('other.md', '---\ntitle: x\n---\nstill not ours');
    await changed;
    fake.resolve();
    expect(fired()).toBe(0);
    expect(source.list('p1')).toBe(before);
  });

  it('an unsubscribed listener hears nothing', async () => {
    const fake = createFakeVault({ basePath: '/vault' });
    const source = createNoteIndexSource(fake.app, () => undefined);
    let count = 0;
    const off = source.subscribe(() => { count += 1; });
    off();
    const changed = nextChanged(fake);
    await fake.app.vault.create('n.md', noteText());
    await changed;
    expect(count).toBe(0);
    expect(pathsFor(source)).toEqual(['n.md']);
  });
});
