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
import { RECORDING } from './workspace-files';
import { cycleSelected, storeSnapshot } from './cycle-note';
import { writeEvidence } from './diagnostics';

/** `cycleSelected`, with `code/` made through the vault API first. Observed (investigation.e2e.ts, and again here):
 *  the session vault's watcher never indexes the project copied in from outside Obsidian, so without this the note's
 *  `code/` segment is unknown to the vault, `createFolder('code')` meets the folder on disk, and the create is refused
 *  as write-failed. A person's vault would have indexed it. */
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
  }, 300_000);
});
