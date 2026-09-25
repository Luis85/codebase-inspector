// WP-04 IN38 (IP35), spec §5 "One well-formed note in the chosen folder, no source-project
// edit" and "Human sections survive evidence refresh": the in-memory acceptance spine. The
// WP-03 relations project is copied to a temp folder and scanned with the real Node port;
// its 3.27.0 recording is read through the real parser with no strip prefix; the notes port
// is the host's own over the fake vault; the source preview reads the copied files from
// disk. Finding → Investigate (exact highlight) → create → edit → rescan and re-attach →
// refresh: the person's sections are byte-identical, their frontmatter value-identical, and
// the block is new. Nothing under the codebase root is written.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { flushPromises } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { parseYaml, stringifyYaml } from '../mocks/obsidian';
import { EVIDENCE_END } from '../../src/application/investigation/note-model';
import { NOTE_VOCABULARY } from '../../src/ui/inspector-copy';
import { hashTree } from '../fixtures/temp-tree';
import { relationsRecordingJson } from '../fixtures/relations-report';
import {
  CYCLE_ANCHOR, PROFILE_ID, afterBlock, blockOf, cleanupTemps, copyRelationsProject, createThroughDialog, mountWorld,
  refreshThroughDialog, reportFor, rowWhere, scanRoot, selectRow, show, textOf, vaultBase,
} from './investigation-support';
import type { Mounted } from './investigation-support';
import type { FakeVault } from '../fixtures/fake-vault';

const SPINE_TIMEOUT = 30_000;
const RECORDING = relationsRecordingJson();
const HEADINGS = NOTE_VOCABULARY.headings;

/** The note's frontmatter, parsed with the real YAML library (IN37: values, never bytes). */
function frontmatterOf(text: string): Record<string, unknown> {
  const match = /^---\n([\s\S]*?)\n---\n/.exec(text);
  if (!match) throw new Error('the note has no frontmatter block');
  return parseYaml(match[1]!) as Record<string, unknown>;
}

function bodyOf(text: string): string {
  const match = /^---\n[\s\S]*?\n---\n/.exec(text);
  return match ? text.slice(match[0].length) : text;
}

/** Writes text under two human headings and edits the frontmatter as a person would. */
function personEdits(text: string): string {
  const fm = { ...frontmatterOf(text), status: 'in progress', reviewer: 'me' };
  const body = bodyOf(text)
    .replace(`## ${HEADINGS.notes}\n`, `## ${HEADINGS.notes}\nI checked a.ts: the cycle is real.\n`)
    .replace(`## ${HEADINGS.decision}\n`, `## ${HEADINGS.decision}\nDecided: keep, for now.\n`);
  return `---\n${stringifyYaml(fm)}---\n${body}`;
}

async function waitForPreview(w: Mounted): Promise<void> {
  await vi.waitFor(async () => {
    await flushPromises();
    expect(w.find('.ci-source-preview__text').exists()).toBe(true);
  }, { timeout: 10_000, interval: 20 });
}

describe('the investigation spine over the real relations project (IN38)', () => {
  beforeEach(() => { setActivePinia(createPinia()); });
  afterEach(async () => { await cleanupTemps(); });

  async function world() {
    const root = await copyRelationsProject();
    const sourceHash = await hashTree(root);
    const snapshot = await scanRoot(root);
    const report = await reportFor(snapshot, RECORDING);
    const { fake, w } = await mountWorld({ snapshot, report, root, vaultPath: await vaultBase() });
    const row = rowWhere((r) => r.kind === 'cycle' && r.anchorPath === CYCLE_ANCHOR && r.line !== null, 'import-cycle');
    return { root, sourceHash, snapshot, report, fake, w, row };
  }

  it('finding → Investigate: the preview shows the anchor file as read from disk, with the reported line highlighted exactly', async () => {
    const { root, snapshot, report, w, row } = await world();
    expect(row.line).toBe(1);
    await selectRow(w, row);
    await waitForPreview(w);
    const onDisk = readFileSync(join(root, CYCLE_ANCHOR), 'utf8').split('\n');
    if (onDisk[onDisk.length - 1] === '') onDisk.pop();
    const shown = (w.find('.ci-source-preview__text').element.textContent ?? '').split('\n');
    shown.pop();
    expect(onDisk.length).toBeGreaterThan(1);
    expect(shown).toEqual(onDisk.map((line, i) => `${i + 1}${line}`));
    const highlighted = w.findAll('.ci-source-preview__text [aria-current="true"]');
    expect(highlighted.map((el) => el.text())).toEqual([`1${onDisk[0]}`]);
    expect(w.find('.ci-source-preview__stale').exists()).toBe(false);
    // The exact case's inputs are real: the scan's size and line count, and an mtime before the import.
    const stat = statSync(join(root, CYCLE_ANCHOR));
    const observed = (metric: string) => snapshot.observations.find((o) => o.entityId === row.file.id && o.measurement.metricId === metric)?.value;
    expect(observed('byte-size')).toBe(stat.size);
    expect(observed('physical-lines')).toBe(onDisk.length);
    expect(stat.mtimeMs).toBeLessThan(Date.parse(report.importedAt));
    w.unmount();
  }, SPINE_TIMEOUT);

  it('→ create → edit → rescan and re-attach → refresh: human sections byte-identical, frontmatter value-identical, a new block, no source write', async () => {
    const { root, sourceHash, snapshot, fake, w, row } = await world();
    await selectRow(w, row);
    await waitForPreview(w);

    // Create with the defaults: one note, linked through its frontmatter and listed.
    const path = await createThroughDialog(w);
    expect(fake.paths()).toEqual([path]);
    const first = textOf(fake, path);
    const created = frontmatterOf(first);
    expect(created).toMatchObject({
      finding_fingerprint: `${row.anchorPath}#${row.id}`, codebase_id: PROFILE_ID, snapshot_id: snapshot.snapshotId, status: 'open',
    });
    expect(w.findAll('.ci-notes-panel__open').map((b) => b.attributes('data-path'))).toEqual([path]);

    // Edit: text under two human headings, the status and a key of the person's own.
    fake.userWrite(path, personEdits(first));
    await flushPromises();
    const edited = textOf(fake, path);
    const human = afterBlock(edited);
    expect(human).toContain('I checked a.ts: the cycle is real.');
    expect(human).toContain('Decided: keep, for now.');

    // A new scan of the same folder (a new snapshot id), the recording attached to it again.
    const next = await scanRoot(root);
    expect(next.snapshotId).not.toBe(snapshot.snapshotId);
    await show(next, await reportFor(next, RECORDING));
    const again = rowWhere((r) => r.fingerprint === row.fingerprint, 'same-finding');
    await selectRow(w, again);
    expect(w.findAll('.ci-notes-panel__open').map((b) => b.attributes('data-path'))).toEqual([path]);
    await refreshThroughDialog(w, path);

    const after = textOf(fake, path);
    expect(afterBlock(after)).toBe(human);
    expect(frontmatterOf(after)).toEqual({ ...created, snapshot_id: next.snapshotId, status: 'in progress', reviewer: 'me' });
    expect(frontmatterOf(after).created).toBe(created.created);
    expect(blockOf(after)).not.toBe(blockOf(first));
    expect(blockOf(after)).toContain(next.snapshotId);
    expect(blockOf(after)).not.toContain(snapshot.snapshotId);
    expect(after.split('\n').filter((l) => l === EVIDENCE_END)).toHaveLength(1);

    // No source write: the codebase tree is unchanged, and the vault holds the note alone.
    expect(await hashTree(root)).toEqual(sourceHash);
    expect(fake.paths()).toEqual([path]);
    expectOnlyNoteFolders(fake, path);
    w.unmount();
  }, SPINE_TIMEOUT);
});

/** The vault's folders are exactly the note's own ancestors. */
function expectOnlyNoteFolders(fake: FakeVault, path: string): void {
  const segments = path.split('/').slice(0, -1);
  const expected = segments.map((_, i) => segments.slice(0, i + 1).join('/'));
  const actual = expected.filter((folder) => fake.app.vault.getAbstractFileByPath(folder) !== null);
  expect(actual).toEqual(expected);
  expect(fake.calls.createFolder).toBe(expected.length);
}
