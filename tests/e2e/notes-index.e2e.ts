// WP-04.2 spec §5 rows 16–17: the host's note index (investigation-note-index.ts) in the real vault.
// Scenario 16: renaming the FOLDER that holds an investigation note moves the note in the notes panel, and an
// unrelated note renamed beside it is never listed. The index has no folder-level handling: its comment relies on
// Obsidian firing one vault `rename` per markdown file the folder held, and this records the events Obsidian fired.
// Scenario 17 (WP-04 E14): a note moved while the plugin is disabled (no listener exists) is listed at its new path
// once the plugin is enabled again, through the index's start rebuild and its first-`resolved` repair.
// NPF3: a disable detaches every city leaf, so the city is opened again; the snapshot store is in memory, so the
// reopened leaf scans afresh and re-imports (native-facts, Task 3). IPF20: nothing here matches any UI text.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { EventRef } from 'obsidian';
import { describe, expect } from 'vitest';
import { writeEvidence } from './diagnostics';
import { test } from './fixture';
import type { NativeContext } from './fixture';
import { PLUGIN_ID } from './session';
import { RECORDING, cycleFinding } from './workspace-files';
import { noteForCycle } from './cycle-note';
import { ROUTE_META } from '../../src/ui/routes';

interface RenameEvent { path: string; oldPath: string; folder: boolean }
type ProbeWindow = Window & { ciRenames?: RenameEvent[]; ciRenameRef?: EventRef; ciResolved?: number };
interface CacheEntry { exists: boolean; indexed: boolean; hasFingerprint: boolean }

/** What the vault and Obsidian's metadata cache hold for `path`. Observed (Task 6): WebDriver returns an `undefined`
 *  result as `null`, so `cachedFingerprint` cannot tell a note with no fingerprint from a missing file; this can. */
const cacheEntry = (browser: NativeContext['browser'], path: string): Promise<CacheEntry> => browser.executeObsidian(({ app }, target): CacheEntry => {
  const file = app.vault.getFileByPath(target);
  const cache = file === null ? null : app.metadataCache.getFileCache(file);
  return { exists: file !== null, indexed: cache !== null, hasFingerprint: cache?.frontmatter?.finding_fingerprint !== undefined };
}, path);

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
  });

  // GRB6 (B8): the index's own events are the only thing that keeps it current after its first `resolved` repair, so a
  // note it never heard about stays unlisted until the next reload. Observed (Task 6 probe): when the vault indexes a
  // folder written from Node late, Obsidian DOES fire `changed` and a live index hears it, so the miss is made here
  // deterministically: the index's `changed` listener is taken off the metadata cache's table after the first `resolved`.
  // Opening Investigate must then list the note anyway, through the resync.
  test('a linked note the vault indexed late is listed when Investigate opens again', async ({ native }) => {
    const { browser, page, inspector, directory } = native;
    const { path, fingerprint } = await noteForCycle(native);
    // Positive control: the note made through the vault is listed at once.
    await expect.poll(() => inspector.notePaths()).toEqual([path]);
    const text = await browser.executeObsidian(({ app }, target) => app.vault.adapter.read(target), path);

    // After the first `resolved` since the index started (the plugin's listener runs before this one), take off its
    // `changed` listener: the one whose source applies a `kind: 'changed'` note event (observed in the built bundle).
    const detached = await browser.executeObsidian(async ({ app }) => {
      const win = activeWindow as ProbeWindow;
      win.ciResolved = 0;
      app.metadataCache.on('resolved', () => { win.ciResolved = (win.ciResolved ?? 0) + 1; });
      await app.vault.create('resolve-trigger.md', 'a plain note, to make the metadata cache resolve once more\n');
      while ((win.ciResolved ?? 0) === 0) await new Promise((resolve) => { win.setTimeout(resolve, 50); });
      const table = (app.metadataCache as unknown as { _: { changed: { fn: (...args: unknown[]) => unknown }[] } })._.changed;
      const mine = table.filter((ref) => /kind:[`"']changed[`"']/.test(String(ref.fn)));
      for (const ref of mine) table.splice(table.indexOf(ref), 1);
      return { listeners: table.length + mine.length, detached: mine.length };
    });
    expect(detached.detached).toBe(1);

    // The late note: written from Node into a folder that exists on disk before Obsidian has indexed it (NPF15), then
    // indexed by the next createFolder below it, which fires `changed` for it with nobody listening.
    const vault = page.getVaultPath();
    mkdirSync(join(vault, 'code', 'late'), { recursive: true });
    writeFileSync(join(vault, 'code', 'late', 'late.md'), text);
    expect(await browser.executeObsidian(({ app }) => app.vault.getAbstractFileByPath('code') === null)).toBe(true);
    const late = 'code/late/late.md';
    const resolved = (): Promise<number> => browser.executeObsidian((): number => (activeWindow as ProbeWindow).ciResolved ?? 0);
    const seen = await resolved();
    await browser.executeObsidian(async ({ app }) => { await app.vault.createFolder('code/trigger'); });
    await expect.poll(() => inspector.cachedFingerprint(late)).toBe(fingerprint);
    await expect.poll(resolved).toBeGreaterThan(seen);   // every event of the indexing has been delivered

    // The vault holds the note and its cache names the finding, yet the panel still lists only the first note.
    expect(await inspector.notePaths()).toEqual([path]);

    // Away from Investigate and back: the screen mounts again and the resync lists the late note too.
    await inspector.navigate(ROUTE_META.overview.title);
    await inspector.selectFinding(cycleFinding().id);
    await expect.poll(async () => (await inspector.notePaths()).sort()).toEqual([path, late].sort());
    await writeEvidence(directory, 'late-note', { path, late, detached, listed: await inspector.notePaths() });
  });
});
