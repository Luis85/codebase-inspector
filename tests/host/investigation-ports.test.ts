// WP-04 Task 10 (IN7, IN33; IP12, IP14, IP37): wireDataPorts hands a leaf's investigation
// store the plugin's notes port and source preview before mount, unwireDataPorts disposes the
// store, and createInvestigationServices builds both inert: nothing reaches the vault until the
// notes port is first used, and the preview reads only under the codebase's live binding root
// when it equals the snapshot's own root.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia } from 'pinia';
import { Platform } from 'obsidian';
import type { Plugin as ObsidianPlugin } from 'obsidian';
import { Plugin } from '../mocks/obsidian';
import { unwireDataPorts, wireDataPorts } from '../../src/host/data-ports';
import type { CityViewDeps } from '../../src/host/city-view';
import { createInvestigationServices } from '../../src/host/investigation-services';
import { useEvidenceStore } from '../../src/ui/stores/evidence-store';
import { useInvestigationStore } from '../../src/ui/stores/investigation-store';
import { EMPTY_NOTE_INDEX, type NoteIndex } from '../../src/application/investigation/note-index';
import type { PreviewRequest } from '../../src/application/investigation/source-preview';
import type { InvestigationNotesPort } from '../../src/application/ports/investigation-notes-port';
import type { SourceFileSystemPort } from '../../src/application/ports/source-filesystem-port';
import { dataPortDeps } from '../fixtures/data-port-deps';
import { inertInvestigationNotes, scriptedSourcePreview } from '../fixtures/fake-investigation';
import { createFakeVault } from '../fixtures/fake-vault';
import { createFakeInvestigationFolders } from '../fixtures/fake-investigation-folders';
import { createFakeProfileStoreHarness } from '../fixtures/fake-profile-store';
import { createFakeBindingStoreHarness, FAKE_MACHINE_ID } from '../fixtures/fake-binding-store';
import { createFakeSourceFileSystem } from '../fixtures/fake-source-filesystem';
import { createFixedClock } from '../fixtures/clock';

// The services build the real Node filesystem per read; under Node tests there is none
// (Platform.isDesktopApp is false), so this stands in for it. Null: no Node filesystem.
const nodeFs = vi.hoisted(() => ({ port: null as SourceFileSystemPort | null }));
vi.mock('../../src/adapters/filesystem/node-source-filesystem', () => ({
  createNodeSourceFileSystem: (): SourceFileSystemPort => {
    if (nodeFs.port === null) throw new Error('no fs/path implementation');
    return nodeFs.port;
  },
}));

const REQUEST: PreviewRequest = { codebaseId: 'p1', expectedRoot: '/fake-root', relativePath: 'a.ts', maxFileBytes: 1_000_000, line: 1 };

/** A notes port holding one index per codebase, which the test changes; it counts its live
 *  listeners. Like the host's, every listener hears every change, whichever codebase it is for. */
function controllableNotes() {
  const listeners = new Set<() => void>();
  const listed: string[] = [];
  const indexes = new Map<string, NoteIndex>();
  const port: InvestigationNotesPort = {
    ...inertInvestigationNotes(),
    list: (codebaseId) => { listed.push(codebaseId); return indexes.get(codebaseId) ?? EMPTY_NOTE_INDEX; },
    subscribe: (listener) => { listeners.add(listener); return () => { listeners.delete(listener); }; },
  };
  const change = (codebaseId: string, next: NoteIndex): void => {
    indexes.set(codebaseId, next);
    for (const listener of Array.from(listeners)) listener();
  };
  return { port, listed, change, listenerCount: () => listeners.size };
}

/** One leaf: its own Pinia, wired to the shared ports and bound to `codebaseId`. */
function leaf(notes: InvestigationNotesPort, codebaseId: string) {
  const pinia = createPinia();
  const ports: ReturnType<typeof dataPortDeps> = { ...dataPortDeps(), investigationNotes: notes };
  wireDataPorts(pinia, ports as CityViewDeps);
  useEvidenceStore(pinia).bindRepository(codebaseId);
  return useInvestigationStore(pinia);
}

describe('the investigation ports (IN7, IN33)', () => {
  it('are wired before mount: the store lists and subscribes on bind, and reads through the preview', () => {
    const notes = controllableNotes();
    const preview = scriptedSourcePreview();
    const pinia = createPinia();
    const ports: ReturnType<typeof dataPortDeps> = { ...dataPortDeps(), investigationNotes: notes.port, sourcePreview: preview };
    wireDataPorts(pinia, ports as CityViewDeps);
    useEvidenceStore(pinia).bindRepository('p1');
    expect(notes.listed).toEqual(['p1']);
    expect(notes.listenerCount()).toBe(1);
    void useInvestigationStore(pinia).readPreview('fp', REQUEST);
    expect(preview.requests).toEqual([REQUEST]);
  });

  it('are unwired on close: the store is disposed, and a later port change reaches no listener', () => {
    const notes = controllableNotes();
    const pinia = createPinia();
    const ports: ReturnType<typeof dataPortDeps> = { ...dataPortDeps(), investigationNotes: notes.port };
    wireDataPorts(pinia, ports as CityViewDeps);
    useEvidenceStore(pinia).bindRepository('p1');
    const store = useInvestigationStore(pinia);
    const first: NoteIndex = { byFingerprint: new Map(), malformed: 1 };
    notes.change('p1', first);
    expect(store.notes).toBe(first);
    unwireDataPorts(pinia);
    expect(notes.listenerCount()).toBe(0);
    notes.change('p1', { byFingerprint: new Map(), malformed: 2 });
    expect(store.notes).toBe(first);
  });

  it('two leaves on different codebases share one port: each lists only its own codebase', () => {
    const notes = controllableNotes();
    const alpha = leaf(notes.port, 'p1');
    const beta = leaf(notes.port, 'p2');
    expect(notes.listenerCount()).toBe(2);
    const alphaIndex: NoteIndex = { byFingerprint: new Map(), malformed: 1 };
    notes.change('p1', alphaIndex);
    expect(alpha.notes).toBe(alphaIndex);
    expect(beta.notes).toBe(EMPTY_NOTE_INDEX);
    const betaIndex: NoteIndex = { byFingerprint: new Map(), malformed: 2 };
    notes.change('p2', betaIndex);
    expect(beta.notes).toBe(betaIndex);
    expect(alpha.notes).toBe(alphaIndex);
  });
});

async function services(options: { isLinux?: boolean } = {}) {
  const fake = createFakeVault({ basePath: '/vault' });
  const plugin = new Plugin(fake.app, {});
  const registerEvent = vi.spyOn(plugin, 'registerEvent');
  const profiles = createFakeProfileStoreHarness();
  await profiles.writeRaw({ profiles: [
    { profileId: 'p1', name: 'Alpha', bindingId: 'b1', exclusions: [], maxFileBytes: 1_000_000 },
    { profileId: 'p2', name: 'Beta', bindingId: null, exclusions: [], maxFileBytes: 1_000_000 },
    // A binding id whose record this device does not hold (cleared, or bound on another device).
    { profileId: 'p3', name: 'Gamma', bindingId: 'b-missing', exclusions: [], maxFileBytes: 1_000_000 },
  ] });
  const bindings = createFakeBindingStoreHarness();
  await bindings.writeRaw({ bindings: [{ bindingId: 'b1', label: 'Alpha', rootPath: '/fake-root', machineId: FAKE_MACHINE_ID }] });
  const saved = Platform.isLinux;
  Platform.isLinux = options.isLinux ?? false;
  try {
    const built = createInvestigationServices(plugin as unknown as ObsidianPlugin, {
      profileStore: profiles.store, bindingStore: bindings.store, folders: createFakeInvestigationFolders(), clock: createFixedClock(),
    });
    return { fake, registerEvent, built };
  } finally {
    Platform.isLinux = saved;
  }
}

describe('createInvestigationServices (IP12, IP14)', () => {
  beforeEach(() => { nodeFs.port = createFakeSourceFileSystem({ 'a.ts': 'one\ntwo\n' }).port; });

  it('reads nothing and registers no event until the notes port is first used, then its four through plugin.registerEvent', async () => {
    const { fake, registerEvent, built } = await services();
    expect(registerEvent).not.toHaveBeenCalled();
    expect(fake.calls.getMarkdownFiles).toBe(0);
    built.notes.list('p1');
    expect(registerEvent).toHaveBeenCalledTimes(4);
    expect(fake.calls.getMarkdownFiles).toBe(1);
  });

  it('IP14: reads under the live binding root only when it equals the snapshot root', async () => {
    const { built } = await services();
    expect(await built.preview.read(REQUEST)).toMatchObject({ status: 'ok', text: { lineCount: 2 } });
    expect(await built.preview.read({ ...REQUEST, expectedRoot: '/elsewhere' })).toEqual({ status: 'unavailable', reason: 'no-binding' });
    expect(await built.preview.read({ ...REQUEST, codebaseId: 'gone' })).toEqual({ status: 'unavailable', reason: 'no-binding' });
  });

  it('E25: a profile with no binding (scan-codebase\'s own) reads under the snapshot root; a binding whose record is gone does not', async () => {
    const { built } = await services();
    expect(await built.preview.read({ ...REQUEST, codebaseId: 'p2' })).toMatchObject({ status: 'ok', text: { lineCount: 2 } });
    expect(await built.preview.read({ ...REQUEST, codebaseId: 'p2', expectedRoot: '' })).toEqual({ status: 'unavailable', reason: 'no-binding' });
    expect(await built.preview.read({ ...REQUEST, codebaseId: 'p3' })).toEqual({ status: 'unavailable', reason: 'no-binding' });
  });

  it('compares the roots case-sensitively only on Linux (Platform.isLinux)', async () => {
    const other = { ...REQUEST, expectedRoot: '/FAKE-ROOT' };
    expect(await (await services({ isLinux: false })).built.preview.read(other)).toMatchObject({ status: 'ok' });
    expect(await (await services({ isLinux: true })).built.preview.read(other)).toEqual({ status: 'unavailable', reason: 'no-binding' });
  });

  it('is no-filesystem where there is no Node filesystem', async () => {
    nodeFs.port = null;
    const { built } = await services();
    expect(await built.preview.read(REQUEST)).toEqual({ status: 'unavailable', reason: 'no-filesystem' });
  });
});
