// Gap closure GRB5: a refresh rewrites only the note's snapshot_id and source_path lines, in the same
// vault.process as the block, so the person's frontmatter comments and quoting survive. A note the line rewrite
// cannot read with certainty falls back to Obsidian's processFrontMatter, the only place `partial` is possible.
// Builds the request the way tests/host/investigation-notes.test.ts does (that file is at its line cap).
import { describe, expect, it } from 'vitest';
import { createFakeVault } from '../fixtures/fake-vault';
import { createFakeInvestigationFolders } from '../fixtures/fake-investigation-folders';
import { createFakeProfileStoreHarness } from '../fixtures/fake-profile-store';
import { createFixedClock } from '../fixtures/clock';
import { createInvestigationNotes } from '../../src/host/investigation-notes';
import { EVIDENCE_BEGIN, EVIDENCE_END } from '../../src/application/investigation/note-model';
import type { RefreshNoteRequest } from '../../src/application/ports/investigation-notes-port';

const OLD_BLOCK = `${EVIDENCE_BEGIN}\n## Context\nfirst\n${EVIDENCE_END}`;
const NEW_BLOCK = `${EVIDENCE_BEGIN}\n## Context\nsecond\n${EVIDENCE_END}`;
const PATH = 'Notes/UN-1 x.md';
const BODY = `${OLD_BLOCK}\n\n## Decision\n_decide_\n`;

const frontmatterLines = (extra: readonly string[] = []): string[] => [
  '---', 'type: codebase-investigation', 'codebase_id: p1', "entity_id: 'file:src/a.ts'", 'finding_id: UN-1',
  "finding_fingerprint: 'src/a.ts#UN-1'", '# the reviewer keeps this comment',
  "source_path: 'src/a.ts'", `snapshot_id: 's1'`, "reviewer: 'me'   # trailing words", ...extra, '---',
];

async function noteWith(lines: readonly string[]) {
  const fake = createFakeVault({ basePath: '/vault' });
  const harness = createFakeProfileStoreHarness();
  await harness.writeRaw({ profiles: [{ profileId: 'p1', name: 'Alpha', bindingId: null, exclusions: [], maxFileBytes: 1_000_000 }] });
  const notes = createInvestigationNotes(fake.app, {
    folders: createFakeInvestigationFolders(), profiles: harness.store, clock: createFixedClock('2026-09-25T10:00:00.000Z'), registerEvent: () => undefined,
  });
  await fake.app.vault.createFolder('Notes');
  await fake.app.vault.create(PATH, `${lines.join('\n')}\n\n${BODY}`);
  return { fake, notes };
}

const refreshRequest = (): RefreshNoteRequest => ({ path: PATH, codebaseId: 'p1', block: NEW_BLOCK, snapshotId: 's2', sourcePath: 'src/b.ts' });

describe('refresh rewrites two frontmatter lines (GRB5)', () => {
  it('keeps the note\'s comments and quoting: one vault.process, no processFrontMatter', async () => {
    const { fake, notes } = await noteWith(frontmatterLines());
    const before = fake.text(PATH) ?? '';
    expect(await notes.refresh(refreshRequest())).toBe('refreshed');
    expect(fake.calls.process).toBe(1);
    expect(fake.calls.processFrontMatter).toBe(0);
    const expected = before.replace("source_path: 'src/a.ts'", 'source_path: "src/b.ts"').replace("snapshot_id: 's1'", 'snapshot_id: "s2"').replace(OLD_BLOCK, NEW_BLOCK);
    expect(fake.text(PATH)).toBe(expected);
    expect(fake.text(PATH)).toContain('# the reviewer keeps this comment');
    expect(fake.text(PATH)).toContain("entity_id: 'file:src/a.ts'");
  });

  it('a value with a comment on its line falls back to processFrontMatter', async () => {
    const lines = frontmatterLines().map((l) => (l.startsWith('snapshot_id') ? "snapshot_id: 's1'  # old" : l));
    const { fake, notes } = await noteWith(lines);
    expect(await notes.refresh(refreshRequest())).toBe('refreshed');
    expect(fake.calls.process).toBe(1);
    expect(fake.calls.processFrontMatter).toBe(1);
    expect(fake.text(PATH)).toContain('snapshot_id: s2');
    expect(fake.text(PATH)).toContain(NEW_BLOCK);
  });

  it('a value continued on the next line falls back to processFrontMatter', async () => {
    const lines = frontmatterLines().map((l) => (l.startsWith('source_path') ? 'source_path: >-\n  src/a.ts' : l));
    const { fake, notes } = await noteWith(lines);
    expect(await notes.refresh(refreshRequest())).toBe('refreshed');
    expect(fake.calls.processFrontMatter).toBe(1);
    expect(fake.text(PATH)).toContain('src/b.ts');
  });

  it('partial is reachable only on the fallback path: a failing processFrontMatter is never reached on a clean note', async () => {
    const clean = await noteWith(frontmatterLines());
    clean.fake.app.fileManager.processFrontMatter = () => Promise.reject(new Error('locked'));
    expect(await clean.notes.refresh(refreshRequest())).toBe('refreshed');

    const lines = frontmatterLines().map((l) => (l.startsWith('snapshot_id') ? "snapshot_id: 's1'  # old" : l));
    const fallback = await noteWith(lines);
    fallback.fake.app.fileManager.processFrontMatter = () => Promise.reject(new Error('locked'));
    expect(await fallback.notes.refresh(refreshRequest())).toBe('partial');
    expect(fallback.fake.text(PATH)).toContain(NEW_BLOCK);
  });

  it('markers edited meanwhile: markers-edited, text byte-identical, no frontmatter rewrite', async () => {
    const { fake, notes } = await noteWith(frontmatterLines());
    fake.userWrite(PATH, (fake.text(PATH) ?? '').replace(`${EVIDENCE_END}\n`, ''));
    const before = fake.text(PATH);
    expect(await notes.refresh(refreshRequest())).toBe('markers-edited');
    expect(fake.text(PATH)).toBe(before);
    expect(fake.calls.processFrontMatter).toBe(0);
  });
});
