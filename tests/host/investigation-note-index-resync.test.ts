// Gap closure GRB6 (WP-04 E14, IP13): the note index repairs from the whole cache on every
// resync, not only on the first `resolved`. A note whose metadata the index never heard about
// (the event arrived while no listener was attached, or Obsidian indexed the file late) is
// listed after one resync; a resync that finds nothing new notifies no listener.
import { describe, expect, it } from 'vitest';
import { stringifyYaml } from '../mocks/obsidian';
import { createFakeVault } from '../fixtures/fake-vault';
import type { FakeVault } from '../fixtures/fake-vault';
import { createFakeInvestigationFolders } from '../fixtures/fake-investigation-folders';
import { createFakeProfileStoreHarness } from '../fixtures/fake-profile-store';
import { createFixedClock } from '../fixtures/clock';
import { createInvestigationNotes } from '../../src/host/investigation-notes';
import { noteFrontmatter } from '../../src/application/investigation/note-model';

const IDENTITY = { codebaseId: 'code', sourcePath: 'src/a.ts', snapshotId: 's1', findingId: 'UN-1' };
const FINGERPRINT = 'src/a.ts#UN-1';
const TEXT = `---\n${stringifyYaml(noteFrontmatter(IDENTITY, '2026-09-25T10:00:00.000Z'))}---\n\nbody\n`;

interface Ref { name: string; cb: (...args: unknown[]) => unknown }

function setup(): { fake: FakeVault; port: ReturnType<typeof createInvestigationNotes>; fired: () => number; detachChanged: () => void } {
  const fake = createFakeVault({ basePath: '/vault' });
  const refs: Ref[] = [];
  const port = createInvestigationNotes(fake.app, {
    folders: createFakeInvestigationFolders(), profiles: createFakeProfileStoreHarness().store, clock: createFixedClock(),
    registerEvent: (ref) => { refs.push(ref as unknown as Ref); },
  });
  let count = 0;
  port.subscribe(() => { count += 1; });
  // The note's own 'changed' never reaches the index: the vault indexed the file late.
  const detachChanged = (): void => {
    for (const ref of refs) if (ref.name === 'changed') fake.app.metadataCache.off('changed', ref.cb);
  };
  return { fake, port, fired: () => count, detachChanged };
}

const paths = (port: ReturnType<typeof createInvestigationNotes>): string[] =>
  (port.list('code').byFingerprint.get(FINGERPRINT) ?? []).map((link) => link.path);

describe('InvestigationNotesPort.resync (GRB6)', () => {
  it('lists a linked note the index missed once the first resolved has passed', async () => {
    const { fake, port, fired, detachChanged } = setup();
    fake.resolve();   // the one repair the index ever did on its own
    detachChanged();
    await fake.app.vault.create('late.md', TEXT);
    await Promise.resolve();
    expect(paths(port)).toEqual([]);
    fake.resolve();   // a later resolved does not rebuild (E14)
    expect(paths(port)).toEqual([]);
    port.resync('code');
    expect(paths(port)).toEqual(['late.md']);
    expect(fired()).toBe(1);
  });

  it('costs exactly one whole-vault pass per resync', () => {
    const { fake, port } = setup();
    fake.resolve();
    const before = fake.calls.getMarkdownFiles;
    port.resync('code');
    expect(fake.calls.getMarkdownFiles).toBe(before + 1);
    port.resync('code');
    expect(fake.calls.getMarkdownFiles).toBe(before + 2);
  });

  it('notifies no listener when nothing is new, and keeps the same list', async () => {
    const { fake, port, fired, detachChanged } = setup();
    fake.resolve();
    detachChanged();
    await fake.app.vault.create('late.md', TEXT);
    port.resync('code');
    expect(fired()).toBe(1);
    const listed = port.list('code');
    port.resync('code');
    port.resync('code');
    expect(fired()).toBe(1);
    expect(port.list('code')).toBe(listed);
  });

  it('starts the index with a single pass when nothing has listed or subscribed yet', async () => {
    const fake = createFakeVault({ basePath: '/vault' });
    const port = createInvestigationNotes(fake.app, {
      folders: createFakeInvestigationFolders(), profiles: createFakeProfileStoreHarness().store, clock: createFixedClock(),
      registerEvent: () => undefined,
    });
    await fake.app.vault.create('n.md', TEXT);
    port.resync('code');
    expect(fake.calls.getMarkdownFiles).toBe(1);
    expect(paths(port)).toEqual(['n.md']);
  });
});
