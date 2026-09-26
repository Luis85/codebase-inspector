// WP-04.2 spec §5 rows 16–17: the host's note index (investigation-note-index.ts) in the real vault.
// Scenario 16: renaming the FOLDER that holds an investigation note moves the note in the notes panel, and an
// unrelated note renamed beside it is never listed. The index has no folder-level handling: its comment relies on
// Obsidian firing one vault `rename` per markdown file the folder held, and this records the events Obsidian fired.
// Scenario 17 (WP-04 E14): a note moved while the plugin is disabled (no listener exists) is listed at its new path
// once the plugin is enabled again, through the index's start rebuild and its first-`resolved` repair.
// NPF3: a disable detaches every city leaf, so the city is opened again; the snapshot store is in memory, so the
// reopened leaf scans afresh and re-imports (native-facts, Task 3). IPF20: nothing here matches any UI text.
import type { EventRef } from 'obsidian';
import { describe, expect } from 'vitest';
import { writeEvidence } from './diagnostics';
import { test } from './fixture';
import type { NativeContext } from './fixture';
import { PLUGIN_ID } from './session';
import { RECORDING, copyProject, cycleFinding } from './workspace-files';

const CYCLE_ANCHOR = 'src/core/a.ts';
interface RenameEvent { path: string; oldPath: string; folder: boolean }
type ProbeWindow = Window & { ciRenames?: RenameEvent[]; ciRenameRef?: EventRef };
interface CacheEntry { exists: boolean; indexed: boolean; hasFingerprint: boolean }

/** What the vault and Obsidian's metadata cache hold for `path`. Observed (Task 6): WebDriver returns an `undefined`
 *  result as `null`, so `cachedFingerprint` cannot tell a note with no fingerprint from a missing file; this can. */
const cacheEntry = (browser: NativeContext['browser'], path: string): Promise<CacheEntry> => browser.executeObsidian(({ app }, target): CacheEntry => {
  const file = app.vault.getFileByPath(target);
  const cache = file === null ? null : app.metadataCache.getFileCache(file);
  return { exists: file !== null, indexed: cache !== null, hasFingerprint: cache?.frontmatter?.finding_fingerprint !== undefined };
}, path);

/** The spine's start: `code/` scanned through the plugin's own modals, the recording imported, the import cycle
 *  selected and a note created for it, linked through Obsidian's own metadata cache. Returns its path and fingerprint. */
async function noteForCycle({ browser, page, inspector }: NativeContext): Promise<{ path: string; fingerprint: string }> {
  copyProject(page.getVaultPath(), 'code');
  await expect.poll(() => browser.executeObsidian(({ app }) => app.vault.adapter.exists('code/src/core/a.ts'))).toBe(true);
  const { id } = cycleFinding();
  const fingerprint = `${CYCLE_ANCHOR}#${id}`;
  await inspector.openCity();
  await inspector.scanFolder('code');
  await inspector.importReport(RECORDING);
  await inspector.selectFinding(id);
  const path = await inspector.createNote();
  await expect.poll(() => inspector.cachedFingerprint(path)).toBe(fingerprint);
  return { path, fingerprint };
}

describe('the note index in the real vault (WP-04.2 rows 16–17)', () => {
  test('the note index follows a folder move and ignores an unrelated note', async ({ native }) => {
    const { browser, inspector, directory } = native;
    const { path, fingerprint } = await noteForCycle(native);
    await expect.poll(() => inspector.notePaths()).toEqual([path]);

    // An unrelated note, created and renamed through the vault API: the panel is unchanged, and the metadata cache
    // (which the index reads) holds no fingerprint for it.
    const plain = 'Other/plain renamed.md';
    await browser.executeObsidian(async ({ app }, to) => {
      await app.vault.createFolder('Other');
      const file = await app.vault.create('Other/plain.md', '# Plain\n\nNothing to do with a finding.\n');
      await app.fileManager.renameFile(file, to);
    }, plain);
    await expect.poll(() => cacheEntry(browser, plain)).toEqual({ exists: true, indexed: true, hasFingerprint: false });
    // Positive control for the probe: the investigation note's own entry carries its fingerprint.
    expect(await cacheEntry(browser, path)).toEqual({ exists: true, indexed: true, hasFingerprint: true });
    expect(await inspector.notePaths()).toEqual([path]);

    // The folder holding the note, renamed through FileManager, with every vault `rename` Obsidian fires recorded.
    const folder = path.slice(0, path.lastIndexOf('/'));
    const moved = `Moved folder/${path.slice(path.lastIndexOf('/') + 1)}`;
    await browser.executeObsidian(async ({ app, obsidian }, from) => {
      const win = activeWindow as ProbeWindow;
      const renames: RenameEvent[] = [];
      win.ciRenames = renames;
      win.ciRenameRef = app.vault.on('rename', (file, oldPath) => {
        renames.push({ path: file.path, oldPath, folder: file instanceof obsidian.TFolder });
      });
      const target = app.vault.getFolderByPath(from);
      if (target === null) throw new Error(`no folder at ${from}`);
      await app.fileManager.renameFile(target, 'Moved folder');
    }, folder);
    await expect.poll(() => inspector.notePaths()).toEqual([moved]);
    await expect.poll(() => inspector.cachedFingerprint(moved)).toBe(fingerprint);
    const renames = await browser.executeObsidian(({ app }): RenameEvent[] => {
      const win = activeWindow as ProbeWindow;
      if (win.ciRenameRef) app.vault.offref(win.ciRenameRef);
      delete win.ciRenameRef;
      return win.ciRenames ?? [];
    });
    await writeEvidence(directory, 'folder-move', { folder, path, moved, renames });
    // The fact the index's comment relies on: one per-file `rename` for the note, from its old path.
    expect(renames.filter((event) => !event.folder && event.path.endsWith('.md'))).toEqual([{ path: moved, oldPath: path, folder: false }]);
    expect(await inspector.notePaths()).toEqual([moved]);
  });

  test('relinks a note moved while the plugin was disabled once it is enabled again', async ({ native }) => {
    const { browser, page, inspector, directory } = native;
    const { path, fingerprint } = await noteForCycle(native);
    // Positive control: the enabled index lists the note at its original path.
    await expect.poll(() => inspector.notePaths()).toEqual([path]);

    // Moved while the plugin is off, so no plugin listener hears it (NPF3: the disable detaches the city leaf too).
    await page.disablePlugin(PLUGIN_ID);
    const moved = `Elsewhere/${path.slice(path.lastIndexOf('/') + 1)}`;
    await browser.executeObsidian(async ({ app }, from, to) => {
      const file = app.vault.getFileByPath(from);
      if (file === null) throw new Error(`no note at ${from}`);
      await app.vault.createFolder('Elsewhere');
      await app.fileManager.renameFile(file, to);
    }, path, moved);
    await expect.poll(() => inspector.cachedFingerprint(moved)).toBe(fingerprint);
    expect(await cacheEntry(browser, path)).toEqual({ exists: false, indexed: false, hasFingerprint: false });

    // Enabled again: the city reopened, scanned afresh, the recording re-imported and the finding selected.
    await page.enablePlugin(PLUGIN_ID);
    await inspector.openCity();
    await inspector.scanFolder('code');
    await inspector.importReport(RECORDING);
    await inspector.selectFinding(cycleFinding().id);
    await expect.poll(() => inspector.notePaths()).toEqual([moved]);
    await writeEvidence(directory, 'relinked', { path, moved, listed: await inspector.notePaths() });
    expect(await inspector.cachedFingerprint(moved)).toBe(fingerprint);
  }, 240_000);
});
