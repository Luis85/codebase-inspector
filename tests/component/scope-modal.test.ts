// Component tests for the scope modal (C04) -- the consent artefact itself. Ruling
// M31: this modal reads NOTHING from the filesystem -- it displays the resolved root,
// exclusions and limits it was HANDED, and openScopeModal's own signature carries no
// SourceFileSystemPort at all, so there is structurally nothing here that could read a
// file even by accident.
import { afterEach, describe, expect, it } from 'vitest';
import type { App } from 'obsidian';
import { setActiveDocument } from '../mocks/obsidian';
import { openScopeModal } from '../../src/host/modals/scope-modal';
import { fingerprintScope, fingerprintSource } from '../../src/application/approval';
import type { SourceSelection } from '../../src/host/modals/source-modal';
import type { CodebaseProfile } from '../../src/domain/model';

function makeProfile(overrides: Partial<CodebaseProfile> = {}): CodebaseProfile {
  return {
    profileId: 'p1', name: 'Alpha', bindingId: null,
    exclusions: ['.git', 'node_modules'], maxFileBytes: 1_000_000, ...overrides,
  };
}

function makeSelection(overrides: Partial<SourceSelection> = {}): SourceSelection {
  return { profile: makeProfile(), mode: 'external', resolvedRoot: 'C:\\Projects\\alpha', ...overrides };
}

const app = {} as App;

const containers: HTMLElement[] = [];
afterEach(() => {
  containers.splice(0).forEach((c) => { c.remove(); });
  document.querySelectorAll('.modal-container').forEach((m) => { m.remove(); });
});

function opener(): HTMLButtonElement {
  const btn = document.body.createEl('button', { text: 'Reconnect' });
  containers.push(btn);
  btn.focus();
  return btn;
}

function modalRoot(): HTMLElement {
  const el = document.querySelector('.modal-container');
  if (!el) throw new Error('no modal is open');
  return el as HTMLElement;
}

function checkbox(): HTMLInputElement {
  return modalRoot().querySelector<HTMLInputElement>('[data-field="acknowledge"]')!;
}

function scanButton(): HTMLButtonElement {
  return modalRoot().querySelector<HTMLButtonElement>('[data-action="confirm-scan"]')!;
}

function cancelButton(): HTMLButtonElement {
  return modalRoot().querySelector<HTMLButtonElement>('[data-action="cancel"]')!;
}

function check(el: HTMLInputElement): void {
  el.checked = true;
  el.dispatchEvent(new Event('change'));
}

describe('scope modal (C04)', () => {
  it('shows COPY-04 as its heading', () => {
    void openScopeModal(app, makeSelection());
    expect(modalRoot().textContent).toContain('Review scope and read access');
    cancelButton().click();
  });

  it('shows COPY-05 as the permission detail', () => {
    void openScopeModal(app, makeSelection());
    expect(modalRoot().textContent).toContain(
      'Source text and file metadata are read. No project scripts, dependency installation, or source writes are performed.');
    cancelButton().click();
  });

  it('shows the RESOLVED root, exclusions and limits', () => {
    void openScopeModal(app, makeSelection({ resolvedRoot: 'C:\\Projects\\alpha' }));
    const text = modalRoot().textContent;
    expect(text).toContain('C:\\Projects\\alpha');
    expect(text).toContain('.git');
    expect(text).toContain('node_modules');
    const maxBytesInput = modalRoot().querySelector<HTMLInputElement>('[data-field="max-file-bytes"]')!;
    expect(maxBytesInput.value).toBe('1000000');
    cancelButton().click();
  });

  it('starts with the acknowledgement UNCHECKED', () => {
    void openScopeModal(app, makeSelection());
    expect(checkbox().checked).toBe(false);
    expect(modalRoot().textContent).toContain('I approve read access to this directory for this scan.');
    cancelButton().click();
  });

  it('keeps Scan DISABLED until the acknowledgement is checked', () => {
    void openScopeModal(app, makeSelection());
    expect(scanButton().disabled).toBe(true);
    check(checkbox());
    expect(scanButton().disabled).toBe(false);
    expect(scanButton().textContent).toContain('Scan codebase');
    cancelButton().click();
  });

  it('returns an approval fingerprinted over the resolved root and the scope', async () => {
    const selection = makeSelection({ resolvedRoot: 'C:\\Projects\\alpha' });
    const promise = openScopeModal(app, selection);
    check(checkbox());
    scanButton().click();
    const result = await promise;
    expect(result).not.toBeNull();
    const { approval, scope } = result!;
    expect(approval.sourceFingerprint).toBe(fingerprintSource(selection.resolvedRoot));
    expect(approval.scopeFingerprint).toBe(fingerprintScope({
      rootPath: selection.resolvedRoot,
      exclusions: selection.profile.exclusions,
      maxFileBytes: selection.profile.maxFileBytes,
      followSymlinks: false,
    }));
    expect(approval.profileId).toBe(selection.profile.profileId);
    expect(approval.operation).toBe('read-only-inventory');
    // Task 8 extension: the actual AnalysisScope that was fingerprinted travels WITH
    // the approval, because ApprovedInventoryRun (frozen §4.1) carries only opaque
    // fingerprints -- a caller driving a real scan needs the real scope values too.
    expect(scope).toEqual({
      rootPath: selection.resolvedRoot,
      exclusions: selection.profile.exclusions,
      maxFileBytes: selection.profile.maxFileBytes,
      followSymlinks: false,
    });
  });

  it('returns the EDITED scope, not the profile default, when exclusions were changed before Scan', async () => {
    const selection = makeSelection({ resolvedRoot: 'C:\\Projects\\alpha' });
    const promise = openScopeModal(app, selection);
    const exclusions = modalRoot().querySelector<HTMLTextAreaElement>('[data-field="exclusions"]')!;
    exclusions.value = '.git\nnode_modules\ndist';
    exclusions.dispatchEvent(new Event('input'));
    check(checkbox());
    scanButton().click();
    const result = await promise;
    expect(result!.scope.exclusions).toEqual(['.git', 'node_modules', 'dist']);
    expect(result!.approval.scopeFingerprint).toBe(fingerprintScope(result!.scope));
  });

  it('re-disables Scan and clears the acknowledgement when an exclusion is edited', () => {
    void openScopeModal(app, makeSelection());
    check(checkbox());
    expect(scanButton().disabled).toBe(false);

    const exclusions = modalRoot().querySelector<HTMLTextAreaElement>('[data-field="exclusions"]')!;
    exclusions.value = '.git\nnode_modules\ndist';
    exclusions.dispatchEvent(new Event('input'));

    expect(checkbox().checked).toBe(false);
    expect(scanButton().disabled).toBe(true);
    cancelButton().click();
  });

  it('re-disables Scan and clears the acknowledgement when the size limit is edited', () => {
    void openScopeModal(app, makeSelection());
    check(checkbox());
    expect(scanButton().disabled).toBe(false);

    const maxBytes = modalRoot().querySelector<HTMLInputElement>('[data-field="max-file-bytes"]')!;
    maxBytes.value = '2000000';
    maxBytes.dispatchEvent(new Event('input'));

    expect(checkbox().checked).toBe(false);
    expect(scanButton().disabled).toBe(true);
    cancelButton().click();
  });

  it('performs NO filesystem read of file contents while reviewing scope', () => {
    // Structural, not behavioural: the SourceSelection this modal is handed carries
    // only plain data (profile, mode, resolvedRoot) -- no SourceFileSystemPort or any
    // other filesystem dependency -- so there is nothing in scope through which this
    // modal COULD read a file even by accident. Editing exclusions/limits above (see
    // the two re-disable tests) only ever mutates the in-memory AnalysisScope this
    // modal was handed at construction time.
    const selection = makeSelection();
    void openScopeModal(app, selection);
    expect(Object.keys(selection).sort()).toEqual(['mode', 'profile', 'resolvedRoot']);
    expect('filesystem' in selection).toBe(false);
    cancelButton().click();
  });

  it('returns null on cancel, and no approval exists afterwards', async () => {
    const promise = openScopeModal(app, makeSelection());
    check(checkbox());
    cancelButton().click();
    expect(await promise).toBeNull();
  });

  // FLIPPED BY TASK 12 UNDER RULING P5, in the same commit that ships the claims.
  //
  // This was an ABSENCE assertion: "does NOT claim 'Read-only source access' or
  // 'Source remains unchanged' yet". Those two sentences are factual claims made on
  // the product's behalf (spec 5.2 and 10), and they were deliberately withheld from
  // the UI until task 12 recorded the G2 evidence that makes them true -- shipping a
  // safety claim the plugin had not demonstrated is exactly what that sequencing
  // exists to prevent. The evidence now exists
  // (docs/superpowers/notes/2026-09-17-wp01-gate-evidence.md, G2), so the assertion
  // becomes a PRESENCE assertion in the same commit.
  //
  // Deliberately written as two separate `toContain` checks rather than one boolean:
  // the absence form was one assertion because either string appearing was a failure,
  // and the presence form needs to fail SEPARATELY for each, naming which one went
  // missing.
  it('claims "Read-only source access" and "Source remains unchanged", now that G2 is recorded', () => {
    void openScopeModal(app, makeSelection());
    const text = modalRoot().textContent;
    expect(text).toContain('Read-only source access');
    expect(text).toContain('Source remains unchanged.');
    cancelButton().click();
  });

  it('makes both claims BEFORE the read, alongside the permission detail it qualifies', () => {
    void openScopeModal(app, makeSelection());
    const text = modalRoot().textContent;
    // COPY-05 says what is read; the claims say what is NOT done to it. They belong on
    // the same screen, in front of the acknowledgement the user is about to tick.
    expect(text).toContain(
      'Source text and file metadata are read. No project scripts, dependency installation, or source writes are performed.');
    const claim = modalRoot().querySelector('.scope-modal-claims');
    expect(claim, 'the claims are not rendered as their own, findable element').not.toBeNull();
    expect(claim!.textContent).toContain('Read-only source access');
    expect(claim!.textContent).toContain('Source remains unchanged.');
    cancelButton().click();
  });

  // --- Fix wave item 1 (C1, Critical) ------------------------------------------------
  // `./dist` and `dist/` are the two most natural ways to type a directory exclusion and
  // BOTH are rejected by validateCodebaseProfile. Before this fix the modal accepted
  // them, the approval carried them, and runInitialScan's profileStore.update threw into
  // a seam with no catch anywhere: the user ticked approve, clicked Scan codebase, and
  // nothing happened at all. Spec 7: "Validation failures surface as visible warnings
  // carrying their reason. Never dropped silently."
  function errorText(): string {
    return modalRoot().querySelector('[role="alert"]')?.textContent ?? '';
  }

  it('shows the validator’s own reason for an invalid exclusion, and keeps Scan disabled', () => {
    void openScopeModal(app, makeSelection());
    const exclusions = modalRoot().querySelector<HTMLTextAreaElement>('[data-field="exclusions"]')!;
    exclusions.value = './dist';
    exclusions.dispatchEvent(new Event('input'));

    expect(errorText()).toMatch(/no empty segments and no \. or \.\. segments/);
    expect(errorText()).toContain('./dist');
    // Ticking the acknowledgement must NOT re-enable Scan while the scope is invalid.
    check(checkbox());
    expect(scanButton().disabled).toBe(true);
    cancelButton().click();
  });

  it('rejects a trailing-slash exclusion too, the other natural spelling', () => {
    void openScopeModal(app, makeSelection());
    const exclusions = modalRoot().querySelector<HTMLTextAreaElement>('[data-field="exclusions"]')!;
    exclusions.value = 'dist/';
    exclusions.dispatchEvent(new Event('input'));
    expect(errorText().length).toBeGreaterThan(0);
    check(checkbox());
    expect(scanButton().disabled).toBe(true);
    cancelButton().click();
  });

  // M1: a glob is accepted by nothing that can honour it (walker.ts:66-79 does exact
  // segment/prefix matching), so it must be refused with a visible reason here too.
  it('rejects a glob exclusion with a visible reason (M1)', () => {
    void openScopeModal(app, makeSelection());
    const exclusions = modalRoot().querySelector<HTMLTextAreaElement>('[data-field="exclusions"]')!;
    exclusions.value = '*.log';
    exclusions.dispatchEvent(new Event('input'));
    expect(errorText()).toMatch(/\* and \? are not supported/);
    check(checkbox());
    expect(scanButton().disabled).toBe(true);
    cancelButton().click();
  });

  it('rejects a cleared or non-numeric size limit with a visible reason', () => {
    for (const typed of ['', '0', 'abc', '-1']) {
      void openScopeModal(app, makeSelection());
      const maxBytes = modalRoot().querySelector<HTMLInputElement>('[data-field="max-file-bytes"]')!;
      maxBytes.value = typed;
      maxBytes.dispatchEvent(new Event('input'));
      expect(errorText(), typed).toMatch(/maxFileBytes must be a positive integer/);
      check(checkbox());
      expect(scanButton().disabled, typed).toBe(true);
      cancelButton().click();
    }
  });

  it('clears the reason and re-allows Scan once the scope is valid again', () => {
    void openScopeModal(app, makeSelection());
    const exclusions = modalRoot().querySelector<HTMLTextAreaElement>('[data-field="exclusions"]')!;
    exclusions.value = './dist';
    exclusions.dispatchEvent(new Event('input'));
    expect(errorText().length).toBeGreaterThan(0);

    exclusions.value = 'dist';
    exclusions.dispatchEvent(new Event('input'));
    expect(errorText()).toBe('');
    check(checkbox());
    expect(scanButton().disabled).toBe(false);
    cancelButton().click();
  });

  it('returns focus to the control that opened it when dismissed', async () => {
    const openerEl = opener();
    const promise = openScopeModal(app, makeSelection());
    expect(document.activeElement).not.toBe(openerEl);
    cancelButton().click();
    await promise;
    expect(document.activeElement).toBe(openerEl);
  });

  // Fix wave item 5 (I4, Important). `document` is always the MAIN window's document, so
  // a modal opened from a popped-out leaf recorded whatever was last focused in the main
  // window and, on dismissal, pulled focus OUT of the pop-out -- the opposite of spec
  // 5.2's "a visible close returning focus to its opener", and against spec 4.4's
  // cross-window rule. This is not a cross-window harness (that is task 11's, since
  // tests/mocks/obsidian.ts is an honest single-window double): it substitutes a
  // stand-in for the one global the fix turns on, which is exactly enough to tell
  // `activeDocument.activeElement` from `document.activeElement`.
  it('captures its opener from activeDocument, never the main window document (spec 4.4)', async () => {
    const mainWindowFocus = opener();            // what a bare `document` would have found
    const popoutFocus = document.body.createEl('button', { text: 'Focused in the pop-out' });
    containers.push(popoutFocus);
    const restore = setActiveDocument({ activeElement: popoutFocus } as unknown as Document);
    try {
      const promise = openScopeModal(app, makeSelection());
      cancelButton().click();
      await promise;
      expect(document.activeElement).toBe(popoutFocus);
      expect(document.activeElement).not.toBe(mainWindowFocus);
    } finally {
      restore();
    }
  });
});
