// WP-04.2 spec §5 rows 18, 19 and 21: the refresh outcomes of investigation-notes.ts in the real vault, through the
// real Investigate UI. Scenario 18 (IN31): a note whose end marker line was duplicated is refused as
// `markers-edited`, in the refresh dialog's own alert line, and is left byte-identical. Scenario 19 (WP-04 E15, NPF11):
// a frontmatter update that rejects after the block was spliced is announced as `partial`; the block is new while the
// frontmatter still names the old snapshot. Scenario 21 (NE14): a note moved into the codebase root is scanned as a
// file of the codebase and refreshed, and nothing else under the root changes.
// IPF20: the plugin's words are matched only through the imported copy constants; nothing matches Obsidian's own UI.
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { describe, expect } from 'vitest';
import { EVIDENCE_BEGIN, EVIDENCE_END } from '../../src/application/investigation/note-model';
import { REFRESH_DONE, REFRESH_MARKERS_EDITED, REFRESH_PARTIAL } from '../../src/ui/audit-copy/investigation';
import { writeEvidence } from './diagnostics';
import { test } from './fixture';
import type { NativeContext } from './fixture';
import { RECORDING, cycleFinding, hashTree } from './workspace-files';
import { noteForCycle, storeSnapshot } from './cycle-note';

type Browser = NativeContext['browser'];
type PatchWindow = Window & { ciFrontMatterCalls?: number };

/** The note after its (single) end marker line: the person's sections. */
const afterEnd = (text: string): string => text.slice(text.indexOf(`${EVIDENCE_END}\n`) + EVIDENCE_END.length + 1);
/** The evidence block alone, from its begin marker: never the frontmatter, whose snapshot_id changes too. */
const blockOf = (text: string): string => text.slice(text.indexOf(EVIDENCE_BEGIN), text.indexOf(EVIDENCE_END));
const endMarkerLines = (text: string): number => text.split('\n').filter((line) => line === EVIDENCE_END).length;
const sha256 = (text: string): string => createHash('sha256').update(text, 'utf8').digest('hex');

/** NPF11: an own property that shadows FileManager's method, rejects ONE call and removes itself in the page's own
 *  `finally`, so the next call reaches Obsidian's method again. Counts its calls. */
const rejectFrontMatterOnce = (browser: Browser): Promise<void> => browser.executeObsidian(({ app }) => {
  const manager = app.fileManager;
  const win = activeWindow as PatchWindow;
  win.ciFrontMatterCalls = 0;
  manager.processFrontMatter = (): Promise<void> => {
    try {
      win.ciFrontMatterCalls = (win.ciFrontMatterCalls ?? 0) + 1;
      return Promise.reject(new Error('native e2e: processFrontMatter rejected once'));
    } finally {
      delete (manager as { processFrontMatter?: unknown }).processFrontMatter;
    }
  };
});

/** The test's own restore (NPF11), run even when an assertion failed; returns whether an own property is still there. */
const restoreFrontMatter = (browser: Browser): Promise<boolean> => browser.executeObsidian(({ app }): boolean => {
  delete (app.fileManager as { processFrontMatter?: unknown }).processFrontMatter;
  return Object.prototype.hasOwnProperty.call(app.fileManager, 'processFrontMatter');
});

/** A rescan against the stored scope, the recording again and the same finding: returns the new snapshot id. */
async function rescanAndReimport({ inspector }: NativeContext): Promise<string | null> {
  const before = await inspector.snapshotId();
  await inspector.rescan();
  await inspector.importReport(RECORDING);
  await inspector.selectFinding(cycleFinding().id);
  const next = await inspector.snapshotId();
  expect(next).not.toBe(before);
  return next;
}

describe('refresh outcomes in the real vault (WP-04.2 rows 18, 19, 21)', () => {
  test('refresh refuses a note whose markers were edited and leaves it byte-identical', async ({ native }) => {
    const { browser, inspector, directory } = native;
    const { path } = await noteForCycle(native);

    // Positive control: with its markers intact, a refresh after a rescan and re-import changes the block.
    const second = await rescanAndReimport(native);
    const intact = await inspector.readNote(path);
    await inspector.refreshNote(path);
    await expect.poll(() => inspector.announced()).toBe(REFRESH_DONE(path));
    await expect.poll(async () => (await inspector.frontmatter(path)).snapshot_id).toBe(second);
    const refreshed = await inspector.readNote(path);
    expect(blockOf(refreshed)).not.toBe(blockOf(intact));
    expect(blockOf(refreshed)).toContain(String(second));

    // A newer snapshot, and the end marker line duplicated by a person's edit (a real vault.process).
    const third = await rescanAndReimport(native);
    await browser.executeObsidian(async ({ app }, target, end) => {
      const file = app.vault.getFileByPath(target);
      if (file === null) throw new Error(`no note at ${target}`);
      await app.vault.process(file, (text) => text.replace(`${end}\n`, `${end}\n${end}\n`));
    }, path, EVIDENCE_END);
    const bytes = await inspector.readNote(path);
    expect(endMarkerLines(refreshed)).toBe(1);
    expect(endMarkerLines(bytes)).toBe(2);

    // The refusal is the dialog's own alert line, and the note is byte-identical.
    const words = await inspector.refreshNoteExpectingRefusal(path);
    const after = await inspector.readNote(path);
    await writeEvidence(directory, 'markers-edited', { path, second, third, words, bytes, after });
    expect(words).toBe(REFRESH_MARKERS_EDITED);
    expect(after).toBe(bytes);
    expect(blockOf(after)).not.toContain(String(third));
    expect((await inspector.frontmatter(path)).snapshot_id).toBe(second);
  });

  test('refresh reports partial when the frontmatter update fails after the block was written', async ({ native }) => {
    const { browser, inspector, directory } = native;
    const { path, snapshot: first } = await noteForCycle(native);
    const next = await rescanAndReimport(native);
    const before = await inspector.readNote(path);
    try {
      await rejectFrontMatterOnce(browser);
      await inspector.refreshNote(path);
      // A changed note closes the dialog; the outcome is announced in the Investigate screen's live region.
      await expect.poll(() => inspector.announced()).toBe(REFRESH_PARTIAL(path));
      const probe = await browser.executeObsidian(({ app }) => ({
        calls: (activeWindow as PatchWindow).ciFrontMatterCalls ?? 0,
        ownProperty: Object.prototype.hasOwnProperty.call(app.fileManager, 'processFrontMatter'),
      }));
      const after = await inspector.readNote(path);
      const frontmatter = await inspector.frontmatter(path);
      await writeEvidence(directory, 'partial', { path, first, next, probe, before, after, frontmatter });
      // The patch was reached exactly once and removed itself.
      expect(probe).toEqual({ calls: 1, ownProperty: false });
      // The block was written with the new snapshot; the frontmatter still names the old one.
      expect(blockOf(after)).not.toBe(blockOf(before));
      expect(blockOf(after)).toContain(String(next));
      expect(blockOf(after)).not.toContain(String(first));
      expect(frontmatter.snapshot_id).toBe(first);
      expect(afterEnd(after)).toBe(afterEnd(before));
    } finally {
      expect(await restoreFrontMatter(browser)).toBe(false);
    }

    // Positive control: unpatched, the same refresh is announced as done and updates snapshot_id.
    await inspector.refreshNote(path);
    await expect.poll(() => inspector.announced()).toBe(REFRESH_DONE(path));
    await expect.poll(async () => (await inspector.frontmatter(path)).snapshot_id).toBe(next);
  });

  test('refreshing a note moved inside the codebase root changes nothing else under the root', async ({ native }) => {
    const { browser, page, inspector, directory } = native;
    const code = join(page.getVaultPath(), 'code');
    const { path, fingerprint } = await noteForCycle(native);
    const sourceHash = hashTree(code);
    const scanned = await storeSnapshot(browser);
    // The store read is the leaf's current snapshot, and the root holds no notes folder yet.
    expect(scanned.snapshotId).toBe(await inspector.snapshotId());
    expect(Object.keys(sourceHash)).not.toContain('notes');

    // Moved into the root by the person, through Obsidian's own FileManager: the index follows it.
    const name = path.slice(path.lastIndexOf('/') + 1);
    const moved = `code/notes/${name}`;
    const inRoot = `notes/${name}`;
    await browser.executeObsidian(async ({ app }, from, to) => {
      const file = app.vault.getFileByPath(from);
      if (file === null) throw new Error(`no note at ${from}`);
      await app.vault.createFolder('code/notes');
      await app.fileManager.renameFile(file, to);
    }, path, moved);
    await expect.poll(() => inspector.notePaths()).toEqual([moved]);
    await expect.poll(() => inspector.cachedFingerprint(moved)).toBe(fingerprint);

    // The rescan lists the note as a file of the codebase: exactly one file more, and it is the note (NE14).
    const next = await rescanAndReimport(native);
    const rescanned = await storeSnapshot(browser);
    expect(rescanned.snapshotId).toBe(next);
    expect(rescanned.files).toHaveLength(scanned.files.length + 1);
    expect(rescanned.files).toEqual([...scanned.files, inRoot].sort());
    await expect.poll(() => inspector.notePaths()).toEqual([moved]);

    // The refresh succeeds: a new block, the person's sections byte-identical.
    const movedHash = hashTree(code);
    const before = await inspector.readNote(moved);
    await inspector.refreshNote(moved);
    await expect.poll(() => inspector.announced()).toBe(REFRESH_DONE(moved));
    await expect.poll(async () => (await inspector.frontmatter(moved)).snapshot_id).toBe(next);
    const after = await inspector.readNote(moved);
    const finalHash = hashTree(code);
    await writeEvidence(directory, 'moved-into-root', {
      path, moved, next, scannedFiles: scanned.files.length, rescannedFiles: rescanned.files.length, before, after, sourceHash, finalHash,
    });
    expect(blockOf(after)).not.toBe(blockOf(before));
    expect(blockOf(after)).toContain(String(next));
    expect(afterEnd(after)).toBe(afterEnd(before));

    // Under the root, only the note's own entry and its folder differ from the hash taken before the move.
    const { [inRoot]: noteEntry, notes: folderEntry, ...rest } = finalHash;
    expect(folderEntry).toBe('directory');
    expect(noteEntry).toBe(sha256(after));
    expect(rest).toEqual(sourceHash);
    // Positive control: the hash sees the refresh's own write to the note.
    expect(movedHash[inRoot]).toBe(sha256(before));
    expect(noteEntry).not.toBe(movedHash[inRoot]);
  });
});
