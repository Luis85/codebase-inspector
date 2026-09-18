// Fix round 2, Item 1 (Critical): closes the exact coverage gap that hid the
// checkpoint #2 crash. Every prior scope-modal test hand-built its own SourceSelection
// via a local makeSelection() helper — grep confirmed openSourceModal appeared only in
// source-modal.test.ts, so the REAL two-step handoff (openSourceModal's resolved
// SourceSelection fed straight into openScopeModal, exactly as scan-flow.ts's
// runInitialScan does) was exercised nowhere, by anything, at any level. This file
// drives that real chain end to end.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FileSystemAdapter } from '../mocks/obsidian';
import type { App } from 'obsidian';
import { openSourceModal } from '../../src/host/modals/source-modal';
import { openScopeModal } from '../../src/host/modals/scope-modal';
import { runInitialScan } from '../../src/host/scan-flow';
import { ScanCoordinator, createCancellationToken } from '../../src/application/scan-coordinator';
import { InMemorySnapshotStore } from '../../src/adapters/storage/in-memory-snapshot-store';
import { createFakeSourceFileSystem } from '../fixtures/fake-source-filesystem';
import { createFixedClock } from '../fixtures/clock';
import type { CodebaseProfile } from '../../src/domain/model';
import type { ProfileStore } from '../../src/application/ports/profile-store';

function makeProfile(overrides: Partial<CodebaseProfile> = {}): CodebaseProfile {
  return { profileId: 'p1', name: 'Alpha', bindingId: null, exclusions: ['.git'], maxFileBytes: 1_000_000, ...overrides };
}

function makeApp(): App {
  return { vault: { adapter: new FileSystemAdapter('/fake-root'), configDir: '.obsidian' } } as unknown as App;
}

afterEach(() => {
  document.querySelectorAll('.modal-container').forEach((m) => { m.remove(); });
});

function modalRoot(): HTMLElement {
  const el = document.querySelector('.modal-container');
  if (!el) throw new Error('no modal is open');
  return el as HTMLElement;
}

/** Polls (microtask ticks only) until a modal is open -- the same pattern
 *  tests/host/city-view.test.ts's own `waitForModal` uses, since the number of
 *  microtask hops between one modal closing and the next opening is an
 *  implementation detail this test should not have to guess. */
async function waitForModal(): Promise<HTMLElement> {
  for (let i = 0; i < 50; i += 1) {
    const modal = document.querySelector('.modal-container');
    if (modal) return modal as HTMLElement;
    await Promise.resolve();
  }
  throw new Error('test setup: no modal opened');
}

/** A ProfileStore double whose `update` genuinely mutates its own in-memory record
 *  (so `store.get` afterward reflects it), for ruling M53's persistence tests. */
function makeProfileStoreDouble(initial: CodebaseProfile): {
  store: ProfileStore; update: ReturnType<typeof vi.fn>; save: ReturnType<typeof vi.fn>;
} {
  let stored = initial;
  const update = vi.fn(async (id: string, mutate: (current: CodebaseProfile) => CodebaseProfile) => {
    if (id !== stored.profileId) return;
    stored = mutate(stored);
  });
  const save = vi.fn(async (p: CodebaseProfile) => { stored = p; });
  const store: ProfileStore = {
    list: vi.fn(async () => [stored]),
    get: vi.fn(async (id: string) => (id === stored.profileId ? stored : null)),
    save,
    remove: vi.fn(async () => {}),
    update,
  };
  return { store, update, save };
}

describe('the real source -> scope consent chain (fix round 2, Item 1)', () => {
  it('carries the RIGHT profileId through to the approval, end to end', async () => {
    const app = makeApp();
    const { port } = createFakeSourceFileSystem({});
    const profile = makeProfile({ profileId: 'the-real-profile-id' });

    // Step 1: the source modal, exactly as scan-flow.ts's runInitialScan drives it.
    const sourcePromise = openSourceModal(app, { profile, filesystem: port });
    modalRoot().querySelector<HTMLInputElement>('input[type="radio"][value="vault"]')!.checked = true;
    modalRoot().querySelector<HTMLInputElement>('input[type="radio"][value="vault"]')!.dispatchEvent(new Event('change'));
    modalRoot().querySelector<HTMLButtonElement>('[data-action="continue"]')!.click();
    const selection = await sourcePromise;
    expect(selection).not.toBeNull();

    // Step 2: the RESOLVED selection feeds straight into the scope modal -- never a
    // hand-built stand-in. This is the exact handoff that crashed at checkpoint #2:
    // ScopeModal.open() (real Obsidian's own Modal.prototype.open, modelled in
    // tests/mocks/obsidian.ts since this fix round) overwrites a field literally named
    // `selection` immediately before onOpen() runs, which is precisely why the fix does
    // not store the SourceSelection under any field name on `this` at all.
    const scopePromise = openScopeModal(app, selection!);
    modalRoot().querySelector<HTMLInputElement>('[data-field="acknowledge"]')!.checked = true;
    modalRoot().querySelector<HTMLInputElement>('[data-field="acknowledge"]')!.dispatchEvent(new Event('change'));
    modalRoot().querySelector<HTMLButtonElement>('[data-action="confirm-scan"]')!.click();
    const result = await scopePromise;

    expect(result).not.toBeNull();
    expect(result!.approval.profileId).toBe('the-real-profile-id');
    expect(result!.scope.rootPath).toBe('/fake-root');
    expect(result!.scope.exclusions).toEqual(['.git']);
  });
});

// Ruling M53 (fix round 6, Important): the scope modal's edits were never persisted --
// a user who deliberately narrowed scope silently got the wider profile scope back on
// the NEXT consent chain, with nothing visible marking the reversion. These drive
// runInitialScan itself (scan-flow.ts), not the two modals separately, since the
// persistence this ruling adds lives in the glue between them.
// Hoisted to module scope (oxlint's consistent-function-scoping): captures nothing
// from the describe block.
function makeCoordinator(port: ReturnType<typeof createFakeSourceFileSystem>['port']) {
  const snapshotStore = new InMemorySnapshotStore(createFixedClock());
  const coordinator = new ScanCoordinator({ port, store: snapshotStore, clock: createFixedClock(), createCancellationToken });
  // The spy is returned alongside the coordinator so callers assert against the CONST
  // (`expect(start)...`), never a member expression (`expect(coordinator.start)...`)
  // off a value typed as the real ScanCoordinator class -- the same
  // @typescript-eslint/unbound-method pattern already resolved this way elsewhere
  // (tests/unit/scan-coordinator.test.ts's spyPort(), tests/unit/scan-flow.test.ts's
  // makeProfileStoreDouble()).
  const start = vi.spyOn(coordinator, 'start').mockResolvedValue(undefined);
  return { coordinator, start };
}

describe('runInitialScan persists the approved scope to the profile (ruling M53)', () => {
  async function driveToScopeModal(): Promise<HTMLElement> {
    await waitForModal();   // the source modal
    modalRoot().querySelector<HTMLInputElement>('input[type="radio"][value="vault"]')!.checked = true;
    modalRoot().querySelector<HTMLInputElement>('input[type="radio"][value="vault"]')!.dispatchEvent(new Event('change'));
    modalRoot().querySelector<HTMLButtonElement>('[data-action="continue"]')!.click();
    return waitForModal();   // the scope modal, once the source modal has resolved
  }

  it('persists the APPROVED exclusions and maxFileBytes to the profile, never the resolved root', async () => {
    const app = makeApp();
    const { port } = createFakeSourceFileSystem({});
    const profile = makeProfile({ profileId: 'p1', exclusions: ['.git'], maxFileBytes: 1_000_000 });
    const { store, update } = makeProfileStoreDouble(profile);
    const { coordinator } = makeCoordinator(port);

    const runPromise = runInitialScan(app, coordinator, profile, port, store);
    await driveToScopeModal();

    const exclusions = modalRoot().querySelector<HTMLTextAreaElement>('[data-field="exclusions"]')!;
    exclusions.value = '.git\nnode_modules\ndist';
    exclusions.dispatchEvent(new Event('input'));
    const maxBytes = modalRoot().querySelector<HTMLInputElement>('[data-field="max-file-bytes"]')!;
    maxBytes.value = '2000000';
    maxBytes.dispatchEvent(new Event('input'));
    const ack = modalRoot().querySelector<HTMLInputElement>('[data-field="acknowledge"]')!;
    ack.checked = true;
    ack.dispatchEvent(new Event('change'));
    modalRoot().querySelector<HTMLButtonElement>('[data-action="confirm-scan"]')!.click();

    await runPromise;

    expect(update).toHaveBeenCalledWith('p1', expect.any(Function));
    const persisted = await store.get('p1');
    expect(persisted!.exclusions).toEqual(['.git', 'node_modules', 'dist']);
    expect(persisted!.maxFileBytes).toBe(2_000_000);
    // Never the resolved root: a profile carries a bindingId, never a path (§4.1).
    expect(persisted).not.toHaveProperty('rootPath');
  });

  it('persists NOTHING when the scope modal is cancelled', async () => {
    const app = makeApp();
    const { port } = createFakeSourceFileSystem({});
    const profile = makeProfile({ profileId: 'p1', exclusions: ['.git'], maxFileBytes: 1_000_000 });
    const { store, update } = makeProfileStoreDouble(profile);
    const { coordinator, start } = makeCoordinator(port);

    const runPromise = runInitialScan(app, coordinator, profile, port, store);
    await driveToScopeModal();
    modalRoot().querySelector<HTMLButtonElement>('[data-action="cancel"]')!.click();
    await runPromise;

    expect(update).not.toHaveBeenCalled();
    expect(start).not.toHaveBeenCalled();
    expect((await store.get('p1'))!.exclusions).toEqual(['.git']);
  });

  it('scans with EXACTLY the approved scope, never re-derived from the profile afterward', async () => {
    const app = makeApp();
    const { port } = createFakeSourceFileSystem({});
    const profile = makeProfile({ profileId: 'p1', exclusions: ['.git'], maxFileBytes: 1_000_000 });
    const { store } = makeProfileStoreDouble(profile);
    const { coordinator, start } = makeCoordinator(port);

    const runPromise = runInitialScan(app, coordinator, profile, port, store);
    await driveToScopeModal();
    const exclusions = modalRoot().querySelector<HTMLTextAreaElement>('[data-field="exclusions"]')!;
    exclusions.value = '.git\nnode_modules';
    exclusions.dispatchEvent(new Event('input'));
    const ack = modalRoot().querySelector<HTMLInputElement>('[data-field="acknowledge"]')!;
    ack.checked = true;
    ack.dispatchEvent(new Event('change'));
    modalRoot().querySelector<HTMLButtonElement>('[data-action="confirm-scan"]')!.click();
    await runPromise;

    expect(start).toHaveBeenCalledTimes(1);
    const [, scannedScope] = start.mock.calls[0]!;
    expect(scannedScope.exclusions).toEqual(['.git', 'node_modules']);
  });

  // --- Fix wave item 1 (C1, Critical) ------------------------------------------------
  // The whole chain, driven exactly as CityView drives it, with the single most natural
  // invalid input a user can type. Before this fix: the modal accepted `./dist`, the
  // approval carried it, profileStore.update threw, and nothing caught it -- no Notice,
  // no banner, only an unhandled rejection in a console the user never opens.
  it('refuses to approve an invalid exclusion: a visible reason, and NO scan started', async () => {
    const app = makeApp();
    const { port } = createFakeSourceFileSystem({});
    const profile = makeProfile({ profileId: 'p1', exclusions: ['.git'], maxFileBytes: 1_000_000 });
    const { store, update } = makeProfileStoreDouble(profile);
    const { coordinator, start } = makeCoordinator(port);

    const runPromise = runInitialScan(app, coordinator, profile, port, store);
    await driveToScopeModal();

    const exclusions = modalRoot().querySelector<HTMLTextAreaElement>('[data-field="exclusions"]')!;
    exclusions.value = './dist';
    exclusions.dispatchEvent(new Event('input'));
    const ack = modalRoot().querySelector<HTMLInputElement>('[data-field="acknowledge"]')!;
    ack.checked = true;
    ack.dispatchEvent(new Event('change'));

    // A visible reason, carrying the validator's own message (spec 7).
    const alert = modalRoot().querySelector('[role="alert"]')!;
    expect(alert.textContent).toMatch(/no empty segments/);
    // And Scan codebase stays unusable: clicking it does nothing at all.
    const scanBtn = modalRoot().querySelector<HTMLButtonElement>('[data-action="confirm-scan"]')!;
    expect(scanBtn.disabled).toBe(true);
    scanBtn.click();
    await Promise.resolve();
    expect(start).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();

    modalRoot().querySelector<HTMLButtonElement>('[data-action="cancel"]')!.click();
    await runPromise;
    expect(start).not.toHaveBeenCalled();
  });

  it('does NOT silently proceed with a stale profile when the persist itself fails', async () => {
    const app = makeApp();
    const { port } = createFakeSourceFileSystem({});
    const profile = makeProfile({ profileId: 'p1', exclusions: ['.git'], maxFileBytes: 1_000_000 });
    const { store } = makeProfileStoreDouble(profile);
    const failingUpdate = vi.fn(async () => { throw new Error('store write failed'); });
    const failingStore: ProfileStore = { ...store, update: failingUpdate };
    const { coordinator, start } = makeCoordinator(port);

    const runPromise = runInitialScan(app, coordinator, profile, port, failingStore);
    await driveToScopeModal();
    const ack = modalRoot().querySelector<HTMLInputElement>('[data-field="acknowledge"]')!;
    ack.checked = true;
    ack.dispatchEvent(new Event('change'));
    modalRoot().querySelector<HTMLButtonElement>('[data-action="confirm-scan"]')!.click();

    await expect(runPromise).rejects.toThrow('store write failed');
    expect(start).not.toHaveBeenCalled();
  });
});
