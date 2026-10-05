// WP-04.2 spec §5 rows 20 and 22: a note folder inside the codebase root, in the real vault through the real
// Investigate UI. Scenario 20 (O7, IN29): a note created inside the root with the exclusion checked adds its folder to
// the profile's exclusions, and the next scan asks for the new scope and leaves the note out. Scenario 22 (NE15, NPF9):
// the create dialog offers that exclusion when the scan's root names the vault's `code/` folder through an alias — the
// session vault's base path is an 8.3 form (`C:\Users\LUISME~1\…`), and the root is scanned and connected in
// absolute-folder mode by its long form, which `realpathSync.native` gives. A junction is not usable here: the source
// modal refuses a junction root by design (NPF9).
// IPF20: nothing matches Obsidian's own UI or the plugin's words; everything is by selector.
import { realpathSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect } from 'vitest';
import { test } from './fixture';
import type { NativeContext } from './fixture';
import { closeSettings, onlyProfile, pluginData, reloadPlugin, savedBindings, vaultBasePath } from './host-probes';
import { RECORDING, copyProject, cycleFinding, hashTree } from './workspace-files';
import { cycleSelected, storeSnapshot } from './cycle-note';
import { writeEvidence } from './diagnostics';
import { NOTE_CREATE_FOLDER_IS_ROOT } from '../../src/ui/audit-copy/investigation';

/** `cycleSelected`, with `code/` made through the vault API first, so the vault knows the folder as a person's would.
 *  Observed (investigation.e2e.ts, and again here): the session vault's watcher never indexes the project copied in from
 *  outside Obsidian. Since NPF15 (ca1a8b7) the create no longer refuses such an unindexed folder (it is used, not refused
 *  as write-failed); the NPF15 scenario below covers that path, and this helper keeps the other scenarios on the indexed one. */
async function indexedCycle(native: NativeContext): Promise<string> {
  await native.browser.executeObsidian(async ({ app }) => { await app.vault.createFolder('code'); });
  return cycleSelected(native);
}

describe('notes inside the codebase root (WP-04.2 rows 20, 22)', () => {
  test('a note created inside the codebase root is excluded from the next scan', async ({ native }) => {
    const { browser, inspector, directory } = native;
    const id = await indexedCycle(native);
    const scanned = await storeSnapshot(browser);
    const exclusions = onlyProfile(await pluginData(browser)).exclusions;
    expect(exclusions).not.toContain('notes');

    // Inside the root, with the exclusion checked: the profile gains the root-relative folder.
    const excludedNote = await inspector.createNoteIn('code/notes', true);
    expect(excludedNote.startsWith('code/notes/')).toBe(true);
    await expect.poll(async () => onlyProfile(await pluginData(browser)).exclusions).toEqual([...exclusions, 'notes']);

    // The scope changed, so scan-codebase asks for approval (rescanApproving fails when no scope modal opens), and the
    // approved scan leaves the note out: the same files as before the note.
    await inspector.rescanApproving();
    const rescanned = await storeSnapshot(browser);
    expect(rescanned.snapshotId).not.toBe(scanned.snapshotId);
    expect(rescanned.files).toHaveLength(scanned.files.length);
    expect(rescanned.files).toEqual(scanned.files);

    // Positive control: a second note inside the root with the box unchecked adds nothing, the rescan asks nothing,
    // and the count grows by exactly that note.
    await inspector.importReport(RECORDING);
    await inspector.selectFinding(id);
    const keptNote = await inspector.createNoteIn('code/other', false);
    expect(keptNote.startsWith('code/other/')).toBe(true);
    expect(onlyProfile(await pluginData(browser)).exclusions).toEqual([...exclusions, 'notes']);
    await inspector.rescan();
    const grown = await storeSnapshot(browser);
    await writeEvidence(directory, 'in-root', {
      excludedNote, keptNote, exclusions: onlyProfile(await pluginData(browser)).exclusions,
      scanned: scanned.files.length, rescanned: rescanned.files.length, grown: grown.files.length,
    });
    expect(grown.files).toHaveLength(scanned.files.length + 1);
    expect(grown.files).toEqual([...scanned.files, keptNote.slice('code/'.length)].sort());
  });

  test('offers the scan exclusion when the codebase root is reached through an alias', async ({ native }) => {
    const { browser, inspector, directory } = native;
    const id = await indexedCycle(native);

    // Positive control: scanned in vault-folder mode (no alias), the dialog offers the exclusion for code/notes.
    const direct = await storeSnapshot(browser);
    await inspector.openCreateNote('code/notes');
    expect(await inspector.overlapOffered()).toBe(true);
    await inspector.cancelCreateNote();

    // The alias (NPF9): Obsidian's base path is the 8.3 form; the long form names the same folder.
    const base = await vaultBasePath(browser);
    if (base === null) throw new Error('the vault has no base path');
    const shortForm = join(base, 'code');
    const longForm = realpathSync.native(shortForm);
    if (longForm.toLowerCase() === shortForm.toLowerCase()) {
      throw new Error(`no alias to test on this machine: the vault base path ${base} is already its long form`);
    }

    // After a plugin reload the snapshot store is empty, so scan-codebase opens the source modal again: the root is
    // chosen in absolute-folder mode by its long form. Connect binds the same long form (the binding the preview reads).
    await reloadPlugin(browser);
    await inspector.openCity();
    await inspector.scanFolder(longForm, 'absolute');
    const profile = onlyProfile(await pluginData(browser));
    await inspector.openCodebaseSettings(profile.name);
    await inspector.connect(longForm, 'absolute');
    await closeSettings(browser);
    const bindings = savedBindings(await pluginData(browser));
    await inspector.importReport(RECORDING);
    await inspector.selectFinding(id);
    const aliased = await storeSnapshot(browser);

    const path = await inspector.openCreateNote('code/notes');
    const offered = await inspector.overlapOffered();
    await writeEvidence(directory, 'alias', {
      base, shortForm, longForm, directRoot: direct.rootPath, aliasedRoot: aliased.rootPath, bindings, path, offered,
    });
    expect(direct.rootPath).toBe(shortForm);
    expect(aliased.rootPath).toBe(longForm);
    expect(bindings.map((b) => b.rootPath)).toEqual([longForm]);
    expect(onlyProfile(await pluginData(browser)).bindingId).toBe(bindings[0]?.bindingId);
    expect(offered).toBe(true);

    // And the exclusion it adds is the root-relative folder.
    await inspector.cancelCreateNote();
    const exclusions = onlyProfile(await pluginData(browser)).exclusions;
    await inspector.createNoteIn('code/notes', true);
    await expect.poll(async () => onlyProfile(await pluginData(browser)).exclusions).toEqual([...exclusions, 'notes']);
  });
});

// WP-04.2 Task 1 (NPF15, P2, PN2): `code/` copied straight through node:fs (never `indexedCycle`'s
// createFolder), so the vault's watcher never indexes it before the note is created.
describe('a note folder Obsidian has not indexed yet (WP-04.2 NPF15, P2)', () => {
  test('creates a note in a folder that exists on disk before Obsidian has indexed it', async ({ native }) => {
    const { browser, page, inspector, directory } = native;
    copyProject(page.getVaultPath(), 'code');
    // The copy is not settled at once (cycle-note.ts's own guard): wait for a known file of it before
    // relying on the copy, so the positive control below can't read a false "not on disk".
    await expect.poll(() => browser.executeObsidian(({ app }) => app.vault.adapter.exists('code/src/core/a.ts'))).toBe(true);

    // Positive control: on disk, but not in the vault's index (NPF15).
    const control = await browser.executeObsidian(async ({ app }) => ({
      onDisk: await app.vault.adapter.exists('code'), indexed: app.vault.getAbstractFileByPath('code'),
    }));
    expect(control.onDisk).toBe(true);
    expect(control.indexed).toBeNull();

    const { id } = cycleFinding();
    await inspector.openCity();
    await inspector.scanFolder('code');
    await inspector.importReport(RECORDING);
    await inspector.selectFinding(id);

    // The control still holds at create time: `code/` is not in the vault's index yet.
    expect(await browser.executeObsidian(({ app }) => app.vault.getAbstractFileByPath('code') === null)).toBe(true);
    const path = await inspector.createNoteIn('code/notes', true);
    expect(path.startsWith('code/notes/')).toBe(true);
    await expect.poll(() => inspector.notePaths()).toContain(path);

    const indexedAfter = await browser.executeObsidian(({ app, obsidian }) => app.vault.getAbstractFileByPath('code') instanceof obsidian.TFolder);
    await writeEvidence(directory, 'unindexed-folder', { control, path, indexedAfter });
    expect(indexedAfter).toBe(true);
  });
});

// Gap closure GRB7 (scenario 46): the dialog refuses a notes folder that IS the codebase folder, with a reason, and
// writes nothing: not in the vault, not on disk, and not into the profile's exclusions.
describe('a notes folder that is the codebase folder (gap closure GRB7)', () => {
  test('a notes folder that is the codebase folder itself is refused, and nothing is written', async ({ native }) => {
    const { browser, page, inspector, directory } = native;
    await indexedCycle(native);
    const scanned = await storeSnapshot(browser);
    const codeDir = join(page.getVaultPath(), 'code');
    expect(scanned.rootPath.toLowerCase()).toBe(join(await vaultBasePath(browser) ?? '', 'code').toLowerCase());
    const vaultFiles = (): Promise<string[]> => browser.executeObsidian(({ app }) => app.vault.getFiles().map((f) => f.path).sort());
    const filesBefore = await vaultFiles();
    const diskBefore = hashTree(codeDir);
    const exclusionsBefore = onlyProfile(await pluginData(browser)).exclusions;

    // The root itself: the refusal shows with its reason, no path is planned, and Create is disabled.
    const refused = await inspector.refusedFolder('code');
    expect(refused.problem).toBe(NOTE_CREATE_FOLDER_IS_ROOT);   // E50 (M7): this refusal, not any refusal
    expect(refused.planned).toBe(false);
    expect(refused.createDisabled).toBe(true);
    expect(await inspector.overlapOffered()).toBe(false);
    // Pressing Create anyway writes nothing, and the dialog stays open with no write error.
    const pressed = await inspector.pressCreate();
    expect(pressed).toEqual({ open: true, error: false });

    // Positive control, in the same dialog: a folder inside the root is accepted (its path planned, the exclusion
    // offered) and a folder outside it is accepted too.
    const inside = await inspector.openCreateNote('code/notes');
    expect(inside.startsWith('code/notes/')).toBe(true);
    expect(await inspector.overlapOffered()).toBe(true);
    const outside = await inspector.openCreateNote('Elsewhere');
    expect(outside.startsWith('Elsewhere/')).toBe(true);
    expect(await inspector.overlapOffered()).toBe(false);
    await inspector.cancelCreateNote();

    const filesAfter = await vaultFiles();
    await writeEvidence(directory, 'folder-is-root', { refused, pressed, inside, outside, filesBefore, filesAfter });
    expect(filesAfter).toEqual(filesBefore);
    expect(hashTree(codeDir)).toEqual(diskBefore);
    expect(onlyProfile(await pluginData(browser)).exclusions).toEqual(exclusionsBefore);
    expect(await inspector.notePaths()).toEqual([]);
  });
});
