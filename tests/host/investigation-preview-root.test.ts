// Gap closure Part B (GRB4, GRB8): the HOST resolves an unbound codebase's preview root from its
// snapshot in the shared store, so the request's own `expectedRoot` only narrows the read and can
// never choose the folder; and a codebase reconnected to another folder answers `root-changed`
// ("scan again"), not the old `no-binding`.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Platform } from 'obsidian';
import type { Plugin as ObsidianPlugin } from 'obsidian';
import { Plugin } from '../mocks/obsidian';
import { createInvestigationServices } from '../../src/host/investigation-services';
import { InMemorySnapshotStore } from '../../src/adapters/storage/in-memory-snapshot-store';
import type { PreviewRequest } from '../../src/application/investigation/source-preview';
import type { SourceFileSystemPort } from '../../src/application/ports/source-filesystem-port';
import { createFakeVault } from '../fixtures/fake-vault';
import { createFakeInvestigationFolders } from '../fixtures/fake-investigation-folders';
import { createFakeProfileStoreHarness } from '../fixtures/fake-profile-store';
import { createFakeBindingStoreHarness, FAKE_MACHINE_ID } from '../fixtures/fake-binding-store';
import { createFakeSourceFileSystem } from '../fixtures/fake-source-filesystem';
import { buildSnapshotFixture } from '../fixtures/snapshot-builder';
import { createFixedClock } from '../fixtures/clock';

const nodeFs = vi.hoisted(() => ({ port: null as SourceFileSystemPort | null }));
vi.mock('../../src/adapters/filesystem/node-source-filesystem', () => ({
  createNodeSourceFileSystem: (): SourceFileSystemPort => {
    if (nodeFs.port === null) throw new Error('no fs/path implementation');
    return nodeFs.port;
  },
}));
vi.mock('../../src/adapters/filesystem/node-access', () => ({ realPathOfNearest: (path: string): string | null => path }));

// The fake filesystem's one root is /fake-root; '/elsewhere' stands for the other folder.
const READS = { status: 'ok', text: { lineCount: 2 } } as const;
const base = (codebaseId: string, expectedRoot: string): PreviewRequest =>
  ({ codebaseId, expectedRoot, relativePath: 'a.ts', maxFileBytes: 1_000_000, line: 1 });

function snapshotAt(profileId: string, rootPath: string) {
  const snapshot = buildSnapshotFixture({ files: 1, repositoryId: profileId });
  return { ...snapshot, scope: { ...snapshot.scope, rootPath } };
}

async function world(snapshotRoots: Readonly<Record<string, string>>, boundRoot: string | null = '/fake-root') {
  const plugin = new Plugin(createFakeVault({ basePath: '/vault' }).app, {});
  const profiles = createFakeProfileStoreHarness();
  await profiles.writeRaw({ profiles: [
    { profileId: 'bound', name: 'Bound', bindingId: 'b1', exclusions: [], maxFileBytes: 1_000_000 },
    { profileId: 'unbound', name: 'Unbound', bindingId: null, exclusions: [], maxFileBytes: 1_000_000 },
    { profileId: 'unscanned', name: 'Unscanned', bindingId: null, exclusions: [], maxFileBytes: 1_000_000 },
  ] });
  const bindings = createFakeBindingStoreHarness();
  await bindings.writeRaw({ bindings: boundRoot === null ? [] : [{ bindingId: 'b1', label: 'Bound', rootPath: boundRoot, machineId: FAKE_MACHINE_ID }] });
  const snapshots = new InMemorySnapshotStore(createFixedClock());
  for (const [profileId, rootPath] of Object.entries(snapshotRoots)) snapshots.put(snapshotAt(profileId, rootPath));
  const saved = Platform.isLinux;
  Platform.isLinux = false;
  try {
    return createInvestigationServices(plugin as unknown as ObsidianPlugin, {
      profileStore: profiles.store, bindingStore: bindings.store, snapshots, folders: createFakeInvestigationFolders(), clock: createFixedClock(),
    }).preview;
  } finally {
    Platform.isLinux = saved;
  }
}

describe('the host resolves the preview root (GRB4, GRB8)', () => {
  beforeEach(() => { nodeFs.port = createFakeSourceFileSystem({ 'a.ts': 'one\ntwo\n' }).port; });

  it('(a) an unbound codebase whose snapshot root is /fake-root never reads under the request\'s other root', async () => {
    const preview = await world({ unbound: '/fake-root' });
    expect(await preview.read(base('unbound', '/elsewhere'))).toEqual({ status: 'unavailable', reason: 'no-binding' });
  });

  it('(b) an unbound codebase reads under its snapshot root when the request names the same root', async () => {
    const preview = await world({ unbound: '/fake-root' });
    expect(await preview.read(base('unbound', '/fake-root'))).toMatchObject(READS);
  });

  it('an unbound codebase with no snapshot in the store reads nothing', async () => {
    const preview = await world({});
    expect(await preview.read(base('unscanned', '/fake-root'))).toEqual({ status: 'unavailable', reason: 'no-binding' });
  });

  it('(c) a codebase reconnected to another folder says root-changed', async () => {
    const preview = await world({ bound: '/elsewhere' }, '/fake-root');
    expect(await preview.read(base('bound', '/elsewhere'))).toEqual({ status: 'unavailable', reason: 'root-changed' });
  });

  it('(d) a bound codebase whose live root is the requested root reads', async () => {
    const preview = await world({ bound: '/fake-root' }, '/fake-root');
    expect(await preview.read(base('bound', '/fake-root'))).toMatchObject(READS);
  });

  it('a binding whose record this device lacks stays no-binding', async () => {
    const preview = await world({ bound: '/fake-root' }, null);
    expect(await preview.read(base('bound', '/fake-root'))).toEqual({ status: 'unavailable', reason: 'no-binding' });
  });
});
