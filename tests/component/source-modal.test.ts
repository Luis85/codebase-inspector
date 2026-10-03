// Component tests for the source modal (C03) -- three source modes with validation.
// Ruling M31: the source modal STATS a directory to validate it and does NOTHING
// else -- no readdir of the tree, no file open, no content read. Every test that
// reaches a real filesystem call goes through the SAME fake port the contract suite
// uses (tests/fixtures/fake-source-filesystem.ts), so "only stat was called" is
// checked against its real, shared readLog() -- not a bespoke spy that could drift
// from what the contract suite considers a read.
import { afterEach, describe, expect, it } from 'vitest';
import { FileSystemAdapter, CapacitorAdapter, setActiveDocument } from '../mocks/obsidian';
import type { App } from 'obsidian';
import { openSourceModal } from '../../src/host/modals/source-modal';
import { createFakeSourceFileSystem } from '../fixtures/fake-source-filesystem';
import type { CodebaseProfile } from '../../src/domain/model';
import type { SourceFileSystemPort } from '../../src/application/ports/source-filesystem-port';

function makeProfile(overrides: Partial<CodebaseProfile> = {}): CodebaseProfile {
  return { profileId: 'p1', name: 'Alpha', bindingId: null, exclusions: [], maxFileBytes: 1_000_000, ...overrides };
}

function makeApp(adapter: unknown = new FileSystemAdapter('/fake-root')): App {
  return { vault: { adapter, configDir: '.obsidian' } } as unknown as App;
}

const containers: HTMLElement[] = [];
afterEach(() => {
  containers.splice(0).forEach((c) => { c.remove(); });
  document.querySelectorAll('.modal-container').forEach((m) => { m.remove(); });
});

function opener(): HTMLButtonElement {
  const btn = document.body.createEl('button', { text: 'Connect' });
  containers.push(btn);
  btn.focus();
  return btn;
}

function modalRoot(): HTMLElement {
  const el = document.querySelector('.modal-container');
  if (!el) throw new Error('no modal is open');
  return el as HTMLElement;
}

function radios(): NodeListOf<HTMLInputElement> {
  return modalRoot().querySelectorAll<HTMLInputElement>('input[type="radio"][name="source-mode"]');
}

function selectMode(mode: string): void {
  const radio = modalRoot().querySelector<HTMLInputElement>(`input[type="radio"][value="${mode}"]`);
  if (!radio) throw new Error(`no radio for mode ${mode}`);
  radio.checked = true;
  radio.dispatchEvent(new Event('change'));
}

function continueButton(): HTMLButtonElement {
  return modalRoot().querySelector<HTMLButtonElement>('[data-action="continue"]')!;
}

function cancelButton(): HTMLButtonElement {
  return modalRoot().querySelector<HTMLButtonElement>('[data-action="cancel"]')!;
}

/** A port whose `stat` reports any path as a real directory: these tests are about what
 *  `computeResolvedRoot` PRODUCES, not about exercising the fake tree (the same reason
 *  the mixed-separator test above overrides `stat`). */
function alwaysADirectory(): SourceFileSystemPort {
  const { port } = createFakeSourceFileSystem({});
  return {
    ...port,
    stat: async () => (
      { exists: true, isDirectory: true, isFile: false, isSymbolicLink: false, size: 0, mtimeMs: 0 }),
  };
}

describe('source modal (C03)', () => {
  it('offers exactly three source modes', () => {
    void openSourceModal(makeApp(), { profile: makeProfile(), filesystem: createFakeSourceFileSystem({}).port });
    expect(radios()).toHaveLength(3);
    cancelButton().click();
  });

  it('shows COPY-03 for the external mode', () => {
    void openSourceModal(makeApp(), { profile: makeProfile(), filesystem: createFakeSourceFileSystem({}).port });
    expect(modalRoot().textContent).toContain('Read a local codebase outside this vault.');
    cancelButton().click();
  });

  it('validates that the chosen directory exists and is a directory', async () => {
    const { port } = createFakeSourceFileSystem({});
    const promise = openSourceModal(makeApp(), { profile: makeProfile(), filesystem: port });
    selectMode('external');
    const input = modalRoot().querySelector<HTMLInputElement>('[data-field="external-path"]')!;
    input.value = '/fake-root/does-not-exist';
    input.dispatchEvent(new Event('input'));
    continueButton().click();
    await Promise.resolve();
    await Promise.resolve();
    expect(modalRoot().querySelector('[role="alert"]')?.textContent).toMatch(/directory/i);
    cancelButton().click();
    expect(await promise).toBeNull();
  });

  it('rejects a path that is not absolute', async () => {
    const { port } = createFakeSourceFileSystem({});
    const promise = openSourceModal(makeApp(), { profile: makeProfile(), filesystem: port });
    selectMode('external');
    const input = modalRoot().querySelector<HTMLInputElement>('[data-field="external-path"]')!;
    input.value = 'relative/path';
    input.dispatchEvent(new Event('input'));
    continueButton().click();
    await Promise.resolve();
    expect(modalRoot().querySelector('[role="alert"]')?.textContent).toMatch(/absolute/i);
    // Not absolute is rejected BEFORE any filesystem call is made.
    expect(port.readLog()).toEqual([]);
    cancelButton().click();
    expect(await promise).toBeNull();
  });

  it('reports an invalid directory with a visible reason, never silently', async () => {
    const { port } = createFakeSourceFileSystem({ 'a-file.txt': 'x' });
    const promise = openSourceModal(makeApp(), { profile: makeProfile(), filesystem: port });
    selectMode('external');
    const input = modalRoot().querySelector<HTMLInputElement>('[data-field="external-path"]')!;
    // A FILE, not a directory -- stat succeeds but isDirectory is false.
    input.value = '/fake-root/a-file.txt';
    input.dispatchEvent(new Event('input'));
    continueButton().click();
    await Promise.resolve();
    await Promise.resolve();
    const alert = modalRoot().querySelector('[role="alert"]');
    expect(alert).not.toBeNull();
    expect(alert!.textContent.length).toBeGreaterThan(0);
    cancelButton().click();
    expect(await promise).toBeNull();
  });

  it('resolves the vault root through adapter.getBasePath() behind an instanceof check', async () => {
    const { port } = createFakeSourceFileSystem({ 'src/a.ts': 'x' });
    const promise = openSourceModal(
      makeApp(new FileSystemAdapter('/fake-root')), { profile: makeProfile(), filesystem: port });
    selectMode('vault');
    continueButton().click();
    const selection = await promise;
    expect(selection).not.toBeNull();
    expect(selection!.resolvedRoot).toBe('/fake-root');
    expect(selection!.mode).toBe('vault');
  });

  it('resolves a folder inside the vault by joining the vault base path with the entered relative folder', async () => {
    const { port } = createFakeSourceFileSystem({ 'sub/a.ts': 'x' });
    const promise = openSourceModal(
      makeApp(new FileSystemAdapter('/fake-root')), { profile: makeProfile(), filesystem: port });
    selectMode('vault-folder');
    const input = modalRoot().querySelector<HTMLInputElement>('[data-field="vault-folder-path"]')!;
    input.value = 'sub';
    input.dispatchEvent(new Event('input'));
    continueButton().click();
    const selection = await promise;
    expect(selection).not.toBeNull();
    expect(selection!.mode).toBe('vault-folder');
    expect(selection!.resolvedRoot).toBe('/fake-root/sub');
  });

  // Fix round 6 (Item 2, folded Minor): a real installed data.json showed
  // "C:\Projects\renovation-planner/src" -- the Windows-style vault base joined with a
  // literal '/' regardless of the base's own separator. The fake port's own internal
  // root is hard-coded to '/fake-root', so `stat` is overridden here to report the
  // Windows-style resolvedRoot as a real directory -- this test is about what
  // computeResolvedRoot/joinVaultPath PRODUCE, not about exercising the fake tree.
  it('joins a vault-relative folder using the BASE PATH\'s own separator, never mixed', async () => {
    const { port } = createFakeSourceFileSystem({});
    const alwaysExists: SourceFileSystemPort = {
      ...port,
      stat: async () => (
        { exists: true, isDirectory: true, isFile: false, isSymbolicLink: false, size: 0, mtimeMs: 0 }),
    };
    const promise = openSourceModal(
      makeApp(new FileSystemAdapter('C:\\Projects\\renovation-planner')), { profile: makeProfile(), filesystem: alwaysExists });
    selectMode('vault-folder');
    const input = modalRoot().querySelector<HTMLInputElement>('[data-field="vault-folder-path"]')!;
    input.value = 'src';
    input.dispatchEvent(new Event('input'));
    continueButton().click();
    const selection = await promise;
    expect(selection).not.toBeNull();
    expect(selection!.resolvedRoot).toBe('C:\\Projects\\renovation-planner\\src');
    expect(selection!.resolvedRoot.includes('/')).toBe(false);
  });

  // Fix round 1, Important 1: joinVaultPath used to trim only LEADING separators and
  // string-concatenate, never validating the relative segment through
  // normalizeRelativePath (task 2) or checking the joined result with isContained
  // (task 2) -- both named in this task's own brief as interfaces it consumes. A `..`
  // segment escaped the vault entirely while the UI's own label still said "inside
  // this vault", and stat() would happily report the escaped directory as valid.
  it('rejects a ".." traversal in the vault-folder path (Windows-style), never reaching the filesystem', async () => {
    const { port } = createFakeSourceFileSystem({ 'sub/a.ts': 'x' });
    const promise = openSourceModal(
      makeApp(new FileSystemAdapter('/fake-root')), { profile: makeProfile(), filesystem: port });
    selectMode('vault-folder');
    const input = modalRoot().querySelector<HTMLInputElement>('[data-field="vault-folder-path"]')!;
    input.value = '..\\..\\Users\\Public';
    input.dispatchEvent(new Event('input'));
    continueButton().click();
    await Promise.resolve();
    await Promise.resolve();
    expect(modalRoot().querySelector('[role="alert"]')?.textContent).toBeTruthy();
    expect(port.readLog()).toEqual([]);
    cancelButton().click();
    expect(await promise).toBeNull();
  });

  it('rejects a ".." traversal in the vault-folder path (POSIX-style), never reaching the filesystem', async () => {
    const { port } = createFakeSourceFileSystem({ 'sub/a.ts': 'x' });
    const promise = openSourceModal(
      makeApp(new FileSystemAdapter('/fake-root')), { profile: makeProfile(), filesystem: port });
    selectMode('vault-folder');
    const input = modalRoot().querySelector<HTMLInputElement>('[data-field="vault-folder-path"]')!;
    input.value = '../../etc';
    input.dispatchEvent(new Event('input'));
    continueButton().click();
    await Promise.resolve();
    await Promise.resolve();
    expect(modalRoot().querySelector('[role="alert"]')?.textContent).toBeTruthy();
    expect(port.readLog()).toEqual([]);
    cancelButton().click();
    expect(await promise).toBeNull();
  });

  it('shows a visible error for the vault modes on a platform with no FileSystemAdapter, never a cast', async () => {
    // CapacitorAdapter is NOT an instanceof FileSystemAdapter -- this proves the
    // instanceof branch is a real branch, not one a permissive double always takes.
    const { port } = createFakeSourceFileSystem({});
    const promise = openSourceModal(
      makeApp(new CapacitorAdapter()), { profile: makeProfile(), filesystem: port });
    selectMode('vault');
    continueButton().click();
    await Promise.resolve();
    expect(modalRoot().querySelector('[role="alert"]')?.textContent).toMatch(/not available/i);
    expect(port.readLog()).toEqual([]);
    cancelButton().click();
    expect(await promise).toBeNull();
  });

  it('returns null on cancel and performs NO filesystem read', async () => {
    const { port } = createFakeSourceFileSystem({ 'src/a.ts': 'x' });
    const promise = openSourceModal(makeApp(), { profile: makeProfile(), filesystem: port });
    selectMode('external');
    const input = modalRoot().querySelector<HTMLInputElement>('[data-field="external-path"]')!;
    input.value = '/fake-root';
    input.dispatchEvent(new Event('input'));
    cancelButton().click();
    expect(await promise).toBeNull();
    expect(port.readLog()).toEqual([]);
  });

  it('never opens a file — only stats a directory', async () => {
    const { port } = createFakeSourceFileSystem({ 'src/a.ts': 'x' });
    const promise = openSourceModal(makeApp(), { profile: makeProfile(), filesystem: port });
    selectMode('vault');
    continueButton().click();
    const selection = await promise;
    expect(selection).not.toBeNull();
    // The ONLY entry in the read log is the stat of the root itself -- readText/walk
    // were never invoked (both would append a DIFFERENT path -- a file inside the
    // tree -- to this same shared log).
    expect(port.readLog()).toEqual(['/fake-root']);
  });

  it('returns focus to the control that opened it when dismissed', async () => {
    const openerEl = opener();
    const { port } = createFakeSourceFileSystem({});
    const promise = openSourceModal(makeApp(), { profile: makeProfile(), filesystem: port });
    expect(document.activeElement).not.toBe(openerEl);
    cancelButton().click();
    await promise;
    expect(document.activeElement).toBe(openerEl);
  });

  // Fix wave item 5 (I4, Important) -- see the twin test in scope-modal.test.ts for the
  // full reasoning. `document` is always the MAIN window's document, so a modal opened
  // from a popped-out leaf pulled focus out of the pop-out on dismissal.
  it('captures its opener from activeDocument, never the main window document (spec 4.4)', async () => {
    const mainWindowFocus = opener();
    const popoutFocus = document.body.createEl('button', { text: 'Focused in the pop-out' });
    containers.push(popoutFocus);
    const { port } = createFakeSourceFileSystem({});
    const restore = setActiveDocument({ activeElement: popoutFocus } as unknown as Document);
    try {
      const promise = openSourceModal(makeApp(), { profile: makeProfile(), filesystem: port });
      cancelButton().click();
      await promise;
      expect(document.activeElement).toBe(popoutFocus);
      expect(document.activeElement).not.toBe(mainWindowFocus);
    } finally {
      restore();
    }
  });

  // ---- Task 12, carried finding 1 (task-12-context.md §2.1) --------------------------
  // The external mode accepted AND DISPLAYED an unnormalised path as the consent root:
  // `C:\\Projects\\..\\Windows\\System32` was shown to the user as the directory they
  // were approving, while the walk -- correctly contained, verified independently twice
  // -- would read `C:\\Windows\\System32`. A consent screen naming a directory that is not
  // the one that gets read is a consent defect even when containment is sound.
  async function chooseExternal(typed: string): Promise<{ selection: unknown; alert: string }> {
    const promise = openSourceModal(makeApp(), { profile: makeProfile(), filesystem: alwaysADirectory() });
    selectMode('external');
    const input = modalRoot().querySelector<HTMLInputElement>('[data-field="external-path"]')!;
    input.value = typed;
    input.dispatchEvent(new Event('input'));
    continueButton().click();
    await Promise.resolve();
    await Promise.resolve();
    // Read through `document`, never `modalRoot()`: on the SUCCESS path the modal has
    // already closed itself, and modalRoot() throws when nothing is open.
    const alert = document.querySelector('.modal-container [role="alert"]')?.textContent ?? '';
    if (document.querySelector('.modal-container')) cancelButton().click();
    return { selection: await promise, alert };
  }

  it('approves the NORMALISED external root, so the consent screen names what will be read', async () => {
    const { selection } = await chooseExternal('C:\\Projects\\..\\Windows\\System32');
    expect(selection).not.toBeNull();
    expect((selection as { resolvedRoot: string }).resolvedRoot).toBe('C:\\Windows\\System32');
  });

  it('normalises a POSIX external root the same way', async () => {
    const { selection } = await chooseExternal('/home/user/../root/project/./src');
    expect((selection as { resolvedRoot: string }).resolvedRoot).toBe('/home/root/project/src');
  });

  it('refuses an external path that climbs above the root, with a visible reason', async () => {
    const { selection, alert } = await chooseExternal('C:\\..\\elsewhere');
    expect(selection).toBeNull();
    expect(alert).toMatch(/above the root/i);
  });

  // ---- Deferred minor #18 (task-12-context.md §2.2) ----------------------------------
  // No test typed an absolute path, a drive-letter path or a bare `..` into the
  // VAULT-FOLDER field. The behaviour was verified correct by a reviewer executing it;
  // this is the missing coverage, so a regression is caught by the suite rather than by
  // somebody happening to try it again.
  async function chooseVaultFolder(typed: string): Promise<{ selection: unknown; alert: string; log: readonly string[] }> {
    const { port } = createFakeSourceFileSystem({ 'sub/a.ts': 'x' });
    const promise = openSourceModal(
      makeApp(new FileSystemAdapter('/fake-root')), { profile: makeProfile(), filesystem: port });
    selectMode('vault-folder');
    const input = modalRoot().querySelector<HTMLInputElement>('[data-field="vault-folder-path"]')!;
    input.value = typed;
    input.dispatchEvent(new Event('input'));
    continueButton().click();
    await Promise.resolve();
    await Promise.resolve();
    const alert = document.querySelector('.modal-container [role="alert"]')?.textContent ?? '';
    if (document.querySelector('.modal-container')) cancelButton().click();
    return { selection: await promise, alert, log: port.readLog() };
  }

  it('refuses an ABSOLUTE path typed into the vault-folder field', async () => {
    for (const typed of ['/etc/passwd', 'C:\\Windows\\System32', 'C:/Windows']) {
      const { selection, alert, log } = await chooseVaultFolder(typed);
      expect(selection, typed).toBeNull();
      expect(alert, typed).toMatch(/absolute|drive letter/i);
      // Rejected BEFORE any filesystem call: nothing outside the vault was even stat-ed.
      expect(log, typed).toEqual([]);
    }
  });

  it('refuses a bare .. and a .. escape typed into the vault-folder field', async () => {
    for (const typed of ['..', '../..', '..\\..\\Users\\Public', 'sub/../..']) {
      const { selection, alert, log } = await chooseVaultFolder(typed);
      expect(selection, typed).toBeNull();
      expect(alert, typed).toMatch(/\. or \.\. segments/);
      expect(log, typed).toEqual([]);
    }
  });

  it('refuses a . segment too, so "inside this vault" stays literally true', async () => {
    const { selection, alert } = await chooseVaultFolder('./sub');
    expect(selection).toBeNull();
    expect(alert).toMatch(/\. or \.\. segments/);
  });
});
