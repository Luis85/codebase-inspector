// WP-04 IN51 (d), IP55, IP56, spec §5: the native spine. In a real vault, through the real UI:
// the WP-03 relations project copied into the session's vault as `code/`, connected to a profile
// in Settings (the preview's root, IP14), scanned through the plugin's own source and scope
// modals, its 3.27.0 recording imported through Data & scans;
// Investigate shows the exact highlight; a note is created, edited as a person would (a real
// `vault.process` and `processFrontMatter`), and refreshed after a rescan and re-import. The
// person's sections stay byte-identical, their frontmatter value-identical, and Obsidian's
// own metadata cache links the note — also after a move and rename (Task 9's carry), and a
// deleted note leaves the panel. Nothing under `code/` changes.
import { createHash } from 'node:crypto';
import { cpSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect } from 'vitest';
import { parseFallowReportText } from '../../src/application/evidence/read-fallow-report';
import { buildEvidenceReport } from '../../src/application/evidence/normalize-fallow';
import { writeEvidence } from './diagnostics';
import { test } from './fixture';

const RECORDING = resolve('tests/fixtures/fallow/relations-combined-3.27.0.json');
const CYCLE_ANCHOR = 'src/core/a.ts';
const END_MARKER = '<!-- codebase-inspector:evidence:end -->';

/** IP56: a local tree hash (the fast suite's hashTree lives under tests/fixtures/, which native files never import). */
function hashTree(root: string, prefix = ''): Record<string, string> {
  const out: Record<string, string> = {};
  for (const name of readdirSync(root).sort()) {
    const abs = join(root, name);
    const rel = prefix === '' ? name : `${prefix}/${name}`;
    if (statSync(abs).isDirectory()) Object.assign(out, { [rel]: 'directory' }, hashTree(abs, rel));
    else out[rel] = createHash('sha256').update(readFileSync(abs)).digest('hex');
  }
  return out;
}

/** The import cycle's finding id, read from the recording through the real parser and normaliser. */
function cycleId(): string {
  const parsed = parseFallowReportText(readFileSync(RECORDING, 'utf8'));
  if (!parsed.ok) throw new Error(`the recording was refused (${parsed.code})`);
  const report = buildEvidenceReport({ raw: parsed.report, fileName: 'r.json', stripPrefix: null, importedAt: new Date().toISOString(), snapshotId: 's' });
  const cycle = report.normalized.findings.find((f) => f.category === 'cycle' && f.path === CYCLE_ANCHOR && f.line !== null);
  if (!cycle) throw new Error('no import cycle on src/core/a.ts in the recording');
  return cycle.id;
}

const afterEnd = (text: string): string => text.slice(text.indexOf(`${END_MARKER}\n`) + END_MARKER.length + 1);
const blockOf = (text: string): string => text.slice(0, text.indexOf(END_MARKER));

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
    const id = cycleId();
    const fingerprint = `${CYCLE_ANCHOR}#${id}`;

    // A profile connected to code/ in Settings (the preview's root is its live binding, IP14), then the scan
    // through scan-codebase's own modals, the recording attached, and Investigate: the exact highlight in a real file.
    await inspector.openCity();
    await inspector.addConnectedProfile('code');
    await inspector.scanFolder('code');
    const firstSnapshot = await inspector.snapshotId();
    await inspector.importReport(RECORDING);
    await inspector.selectFinding(id);
    await expect.poll(() => inspector.root().$('.ci-source-preview__text [aria-current="true"]').isExisting()).toBe(true);

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
    expect(blockOf(after)).not.toBe(blockOf(before));
    expect(blockOf(after)).toContain(String(nextSnapshot));
    expect(blockOf(after)).not.toContain(String(firstSnapshot));
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
