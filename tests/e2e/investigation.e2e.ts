// WP-04 IN51 (d), IP55, IP56, spec §5: the native spine. In a real vault, through the real UI:
// the WP-03 relations project copied into the session's vault as `code/`, scanned through the
// plugin's own source and scope modals (the default flow: an unbound profile, whose preview reads
// under the snapshot's root, E25), its 3.27.0 recording imported through Data & scans;
// Investigate shows the exact highlight; a note is created, edited as a person would (a real
// `vault.process` and `processFrontMatter`), and refreshed after a rescan and re-import. The
// person's sections stay byte-identical, their frontmatter value-identical, and Obsidian's
// own metadata cache links the note — also after a move and rename (Task 9's carry), and a
// deleted note leaves the panel. Nothing under `code/` changes.
import { cpSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect } from 'vitest';
import { writeEvidence } from './diagnostics';
import { test } from './fixture';
import { CYCLE_ANCHOR, RECORDING, cycleFinding, hashTree } from './workspace-files';

const BEGIN_MARKER = '<!-- codebase-inspector:evidence:begin -->';
const END_MARKER = '<!-- codebase-inspector:evidence:end -->';

const afterEnd = (text: string): string => text.slice(text.indexOf(`${END_MARKER}\n`) + END_MARKER.length + 1);
/** The evidence block alone, from its begin marker: never the frontmatter, whose snapshot_id changes too. */
const blockOf = (text: string): string => text.slice(text.indexOf(BEGIN_MARKER), text.indexOf(END_MARKER));

describe('the investigation spine in the real Obsidian host (IN51 d)', () => {
  test('keeps human sections byte-identical across a real refresh and links the note through the metadata cache', async ({ native: { browser, page, inspector, directory } }) => {
    const code = join(page.getVaultPath(), 'code');
    cpSync(resolve('tests/fixtures/fallow/relations-project'), code, { recursive: true });
    const sourceHash = hashTree(code);
    // Observed on this machine (Task 16 report): the session vault's watcher never indexes a change made from
    // outside Obsidian (none within 12 s, not even a root .md), so the wait is on Obsidian's own adapter seeing
    // the copy on disk. The scan reads through the plugin's Node port, never the vault index; the note is
    // written through the vault API, which indexes it at once.
    await expect.poll(() => browser.executeObsidian(({ app }) => app.vault.adapter.exists('code/src/core/a.ts'))).toBe(true);
    await writeEvidence(directory, 'vault-index', await browser.executeObsidian(({ app }) => ({
      packageJsonIndexed: app.vault.getFileByPath('code/package.json') !== null,
      codeFolderIndexed: app.vault.getFolderByPath('code') !== null,
    })));
    const { id, line } = cycleFinding();
    const fingerprint = `${CYCLE_ANCHOR}#${id}`;

    // The default user flow: scan-codebase's own source and scope modals (a profile with no binding, scan-flow.ts),
    // the recording attached, and Investigate: the exact highlight in a real file under the snapshot's root (E25).
    await inspector.openCity();
    await inspector.scanFolder('code');
    const firstSnapshot = await inspector.snapshotId();
    await inspector.importReport(RECORDING);
    await inspector.selectFinding(id);
    await expect.poll(() => inspector.root().$('.ci-source-preview__text [aria-current="true"]').isExisting()).toBe(true);
    // Exactly one highlighted line, and it is the finding's own (line 1 in this recording).
    expect(line).toBe(1);
    expect(await inspector.highlightedLines()).toEqual([String(line)]);

    // Create: the note's frontmatter, and Obsidian's own metadata cache, link it (IN33).
    const path = await inspector.createNote();
    const created = await inspector.frontmatter(path);
    expect(created.finding_fingerprint).toBe(fingerprint);
    expect(typeof created.codebase_id === 'string' && created.codebase_id.length > 0).toBe(true);
    expect(created.snapshot_id).toBe(firstSnapshot);
    await expect.poll(() => inspector.cachedFingerprint(path)).toBe(fingerprint);
    expect(await inspector.notePaths()).toEqual([path]);
    const before = await inspector.readNote(path);

    // Edit as a person would, through a real vault.process and processFrontMatter.
    await browser.executeObsidian(async ({ app }, target) => {
      const file = app.vault.getFileByPath(target);
      if (file === null) throw new Error(`no note at ${target}`);
      await app.vault.process(file, (text) => text
        .replace('## Investigation notes\n', '## Investigation notes\nI checked a.ts.\n')
        .replace('## Decision\n', '## Decision\nDecided: keep.\n'));
      await app.fileManager.processFrontMatter(file, (frontmatter: Record<string, unknown>) => {
        frontmatter.status = 'in progress';
        frontmatter.reviewer = 'me';
      });
    }, path);
    await expect.poll(() => browser.executeObsidian(({ app }, target): unknown => {
      const file = app.vault.getFileByPath(target);
      return file === null ? null : app.metadataCache.getFileCache(file)?.frontmatter?.reviewer;
    }, path)).toBe('me');
    const edited = await inspector.readNote(path);
    const human = afterEnd(edited);
    expect(human).toContain('I checked a.ts.');
    expect(human).toContain('Decided: keep.');

    // Refresh: a rescan against the stored scope (a new snapshot id), the recording again, the same finding.
    await inspector.rescan();
    const nextSnapshot = await inspector.snapshotId();
    expect(nextSnapshot).not.toBe(firstSnapshot);
    await inspector.importReport(RECORDING);
    await inspector.selectFinding(id);
    await inspector.refreshNote(path);
    await expect.poll(async () => (await inspector.frontmatter(path)).snapshot_id).toBe(nextSnapshot);
    const after = await inspector.readNote(path);
    await writeEvidence(directory, 'spine', { path, before, after });
    expect(afterEnd(after)).toBe(human);
    const refreshed = await inspector.frontmatter(path);
    expect(refreshed).toEqual({ ...created, snapshot_id: nextSnapshot, status: 'in progress', reviewer: 'me' });
    expect(refreshed.created).toBe(created.created);
    expect(blockOf(after).startsWith(BEGIN_MARKER)).toBe(true);
    expect(blockOf(after)).not.toBe(blockOf(before));
    expect(blockOf(after)).toContain(String(nextSnapshot));
    expect(blockOf(after)).not.toContain(String(firstSnapshot));
    expect(after.split('\n').filter((l) => l === END_MARKER)).toHaveLength(1);
    expect(await inspector.cachedFingerprint(path)).toBe(fingerprint);

    // No source write: the note's folder is outside code/, and code/ is unchanged.
    expect(path.startsWith('code/')).toBe(false);
    expect(hashTree(code)).toEqual(sourceHash);

    // Task 9's carry: a note moved and renamed in the real vault stays linked; a deleted one leaves the panel.
    const moved = 'Moved elsewhere/Renamed investigation.md';
    await browser.executeObsidian(async ({ app }, from, to) => {
      const file = app.vault.getFileByPath(from);
      if (file === null) throw new Error(`no note at ${from}`);
      await app.vault.createFolder(to.slice(0, to.lastIndexOf('/')));
      await app.fileManager.renameFile(file, to);
    }, path, moved);
    await expect.poll(() => inspector.notePaths()).toEqual([moved]);
    await expect.poll(() => inspector.cachedFingerprint(moved)).toBe(fingerprint);
    // Deleted through Obsidian's own adapter, which updates the vault (its `delete` event) at once; never
    // FileManager.trashFile, whose default here ("system") would send the note outside the session's copied vault.
    await browser.executeObsidian(async ({ app }, target) => { await app.vault.adapter.remove(target); }, moved);
    await expect.poll(() => inspector.notePaths()).toEqual([]);
    await expect.poll(() => inspector.root().$('.ci-notes-panel__none').isExisting()).toBe(true);
  });
});
