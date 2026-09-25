// WP-04 Task 10 (IN13, IN33; IP37, IP39): the investigation store over a real notes port on
// the fake vault, bound through the evidence store. Its notes are the BOUND codebase's index
// (a note for another codebase never attaches), they follow the port with no call from the
// test, and a codebase change resets everything synchronously and rebinds the one
// subscription. Preview reads take a token: a newer read, a new selection or a new codebase
// drops an older result.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { createInvestigationNotes } from '../../src/host/investigation-notes';
import { useEvidenceStore } from '../../src/ui/stores/evidence-store';
import { useInvestigationStore } from '../../src/ui/stores/investigation-store';
import { EVIDENCE_BEGIN, EVIDENCE_END } from '../../src/application/investigation/note-model';
import type { PreviewRequest, PreviewResult, SourcePreview } from '../../src/application/investigation/source-preview';
import type { CreateNoteRequest, InvestigationNotesPort } from '../../src/application/ports/investigation-notes-port';
import type { InvestigationFolderStore } from '../../src/adapters/storage/plugin-data-investigation-store';
import { createFakeVault } from '../fixtures/fake-vault';
import { createFakeInvestigationFolders } from '../fixtures/fake-investigation-folders';
import { createFakeProfileStoreHarness } from '../fixtures/fake-profile-store';
import { createFixedClock } from '../fixtures/clock';
import { scriptedSourcePreview } from '../fixtures/fake-investigation';

// Module scope (oxlint consistent-function-scoping): captures nothing.
const ignoreEvent = (): void => {};

/** A promise the test opens when it chooses. */
function gate(): { readonly promise: Promise<void>; release: () => void } {
  const handle: { open: (() => void) | null } = { open: null };
  const promise = new Promise<void>((resolve) => { handle.open = resolve; });
  return { promise, release: () => { handle.open?.(); } };
}

const FINGERPRINT = 'src/a.ts#UN-1';
const r1: PreviewRequest = { codebaseId: 'p1', expectedRoot: '/root', relativePath: 'a.ts', maxFileBytes: 1_000, line: 1 };
const r2: PreviewRequest = { ...r1, relativePath: 'b.ts' };
const okOf = (lineCount: number): PreviewResult => ({
  status: 'ok', text: { lines: [], lineCount, size: 0, mtimeMs: 0, readAt: '2026-09-25T10:00:00.000Z' },
});

function createRequest(codebaseId: string): CreateNoteRequest {
  return {
    identity: { codebaseId, sourcePath: 'src/a.ts', snapshotId: 's1', findingId: 'UN-1' },
    folder: 'Notes', baseName: `UN-1 ${codebaseId}`, body: `${EVIDENCE_BEGIN}\n${EVIDENCE_END}\n`, excludeFolder: false, rootPath: null,
  };
}

async function setup(folders: InvestigationFolderStore = createFakeInvestigationFolders({ p2: 'Beta notes' })) {
  const fake = createFakeVault({ basePath: '/vault' });
  const profiles = createFakeProfileStoreHarness();
  await profiles.writeRaw({ profiles: [
    { profileId: 'p1', name: 'Alpha', bindingId: null, exclusions: [], maxFileBytes: 1_000_000 },
    { profileId: 'p2', name: 'Beta', bindingId: null, exclusions: [], maxFileBytes: 1_000_000 },
  ] });
  const real = createInvestigationNotes(fake.app, { folders, profiles: profiles.store, clock: createFixedClock(), registerEvent: ignoreEvent });
  let live = 0;
  const port: InvestigationNotesPort = {
    ...real,
    subscribe: (listener) => {
      live += 1;
      const off = real.subscribe(listener);
      return () => { live -= 1; off(); };
    },
  };
  const preview = scriptedSourcePreview();
  const store = useInvestigationStore();
  store.setPorts(port, preview);
  return { real, preview, store, evidence: useEvidenceStore(), live: () => live };
}

describe('investigation store: the notes port (IN33, IP37)', () => {
  beforeEach(() => { setActivePinia(createPinia()); });

  it('binding loads notes and destination; a created note shows by itself; binding p2 swaps both and drops the old subscription', async () => {
    const { real, store, evidence, live } = await setup();
    evidence.bindRepository('p1');
    expect(live()).toBe(1);
    await vi.waitFor(() => { expect(store.destination).toEqual({ folder: 'Codebase investigations/Alpha', isDefault: true }); });
    expect(store.notes.byFingerprint.size).toBe(0);
    expect(await real.create(createRequest('p1'))).toMatchObject({ status: 'created' });
    await vi.waitFor(() => { expect(store.notes.byFingerprint.get(FINGERPRINT)?.map((l) => l.path)).toEqual(['Notes/UN-1 p1.md']); });
    evidence.bindRepository('p2');
    // Synchronous (flush 'sync'): p1's note, with the same portable key, never attaches to p2.
    expect(store.notes.byFingerprint.has(FINGERPRINT)).toBe(false);
    expect(store.destination).toBeNull();
    expect(live()).toBe(1);
    await vi.waitFor(() => { expect(store.destination).toEqual({ folder: 'Beta notes', isDefault: false }); });
    expect(await real.create(createRequest('p2'))).toMatchObject({ status: 'created' });
    await vi.waitFor(() => { expect(store.notes.byFingerprint.get(FINGERPRINT)?.map((l) => l.path)).toEqual(['Notes/UN-1 p2.md']); });
  });

  it('ignores a destination that arrives after its codebase is no longer bound', async () => {
    const inner = createFakeInvestigationFolders({ p1: 'Alpha notes', p2: 'Beta notes' });
    const p1Read = gate();
    const folders: InvestigationFolderStore = { ...inner, read: async (id) => { if (id === 'p1') await p1Read.promise; return inner.read(id); } };
    const { store, evidence } = await setup(folders);
    evidence.bindRepository('p1');
    evidence.bindRepository('p2');
    await vi.waitFor(() => { expect(store.destination).toEqual({ folder: 'Beta notes', isDefault: false }); });
    p1Read.release();
    await flushPromises();
    expect(store.destination).toEqual({ folder: 'Beta notes', isDefault: false });
  });
});

describe('investigation store: preview reads (IN13, IP39)', () => {
  beforeEach(() => { setActivePinia(createPinia()); });

  it('a newer read wins whatever order the results arrive in', async () => {
    const { preview, store } = await setup();
    void store.readPreview('a', r1);
    void store.readPreview('b', r2);
    expect(store.preview).toEqual({ status: 'loading', fingerprint: 'b' });
    preview.resolveNext(okOf(2), r2);
    await flushPromises();
    preview.resolveNext(okOf(1), r1);
    await flushPromises();
    expect(store.preview).toEqual({ status: 'ready', fingerprint: 'b', result: okOf(2) });
    expect(preview.requests).toHaveLength(2);
  });

  it('opening another finding resets the preview to idle, and a read that resolves after the reset is ignored', async () => {
    const { preview, store } = await setup();
    store.open('a');
    void store.readPreview('a', r1);
    store.open('b');
    expect(store.preview).toEqual({ status: 'idle' });
    preview.resolveNext(okOf(1));
    await flushPromises();
    expect(store.preview).toEqual({ status: 'idle' });
  });

  it('opening the selected finding again keeps its preview (a selection watcher would not read again)', async () => {
    const { preview, store } = await setup();
    store.open('a');
    void store.readPreview('a', r1);
    preview.resolveNext(okOf(1));
    await flushPromises();
    store.open('a');
    expect(store.preview).toEqual({ status: 'ready', fingerprint: 'a', result: okOf(1) });
  });

  it('markGone and a codebase change reset the preview synchronously and drop a late result', async () => {
    const { preview, store, evidence } = await setup();
    evidence.bindRepository('p1');
    store.open('a');
    void store.readPreview('a', r1);
    store.markGone();
    expect(store.preview).toEqual({ status: 'idle' });
    void store.readPreview('a', r1);
    evidence.bindRepository('p2');
    expect(store.preview).toEqual({ status: 'idle' });
    preview.resolveNext(okOf(1));
    preview.resolveNext(okOf(1));
    await flushPromises();
    expect(store.preview).toEqual({ status: 'idle' });
  });

  it('a read that rejects is a read-error result, never an unhandled rejection', async () => {
    const store = useInvestigationStore();
    const failing: SourcePreview = { read: () => Promise.reject(new Error('boom')) };
    store.setPorts((await setup()).real, failing);
    await store.readPreview('a', r1);
    expect(store.preview).toEqual({ status: 'ready', fingerprint: 'a', result: { status: 'unavailable', reason: 'read-error' } });
  });
});

describe('investigation store: no ports set', () => {
  beforeEach(() => { setActivePinia(createPinia()); });

  it('create, refresh and plan give null, openNote false, sourceNotePath null, and no read happens', async () => {
    const store = useInvestigationStore();
    useEvidenceStore().bindRepository('p1');
    expect(await store.create(createRequest('p1'))).toBeNull();
    expect(await store.refresh({ path: 'Notes/x.md', codebaseId: 'p1', block: '', snapshotId: 's1', sourcePath: 'src/a.ts' })).toBeNull();
    expect(store.plan('Notes', 'x', '/root')).toBeNull();
    expect(await store.openNote('Notes/x.md')).toBe(false);
    expect(store.sourceNotePath('/root', 'a.md')).toBeNull();
    await store.readPreview('a', r1);
    expect(store.preview).toEqual({ status: 'idle' });
    expect(store.destination).toBeNull();
  });
});
