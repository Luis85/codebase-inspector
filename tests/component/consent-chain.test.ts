// Fix round 2, Item 1 (Critical): closes the exact coverage gap that hid the
// checkpoint #2 crash. Every prior scope-modal test hand-built its own SourceSelection
// via a local makeSelection() helper — grep confirmed openSourceModal appeared only in
// source-modal.test.ts, so the REAL two-step handoff (openSourceModal's resolved
// SourceSelection fed straight into openScopeModal, exactly as scan-flow.ts's
// runInitialScan does) was exercised nowhere, by anything, at any level. This file
// drives that real chain end to end.
import { afterEach, describe, expect, it } from 'vitest';
import { FileSystemAdapter } from '../mocks/obsidian';
import type { App } from 'obsidian';
import { openSourceModal } from '../../src/host/modals/source-modal';
import { openScopeModal } from '../../src/host/modals/scope-modal';
import { createFakeSourceFileSystem } from '../fixtures/fake-source-filesystem';
import type { CodebaseProfile } from '../../src/domain/model';

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
