// WP-04 Task 9 (IN12, IN18, IN26–IN32, IP8, IP9, IP26, IPF8, IPF16; Review Focus 3 and 5):
// the host notes port against the fake vault, on a case-insensitive vault (the observed
// Windows host) and a case-sensitive one: plan, create, the race, the exclusion, refresh,
// open, destination and sourceNotePath.
import { describe, expect, it } from 'vitest';
import { Platform } from 'obsidian';
import { parseYaml, stringifyYaml } from '../mocks/obsidian';
import { createFakeVault } from '../fixtures/fake-vault';
import type { FakeVault, FakeVaultOptions } from '../fixtures/fake-vault';
import { createFakeInvestigationFolders } from '../fixtures/fake-investigation-folders';
import { createFakeProfileStoreHarness } from '../fixtures/fake-profile-store';
import { createFixedClock } from '../fixtures/clock';
import { createInvestigationNotes } from '../../src/host/investigation-notes';
import { EVIDENCE_BEGIN, EVIDENCE_END, noteFrontmatter } from '../../src/application/investigation/note-model';
import type { NoteIdentity } from '../../src/application/investigation/note-model';
import type { CreateNoteRequest, RefreshNoteRequest } from '../../src/application/ports/investigation-notes-port';

const IDENTITY: NoteIdentity = { codebaseId: 'p1', sourcePath: 'src/a.ts', snapshotId: 's1', findingId: 'UN-1' };
const OLD_BLOCK = `${EVIDENCE_BEGIN}\n## Context\nfirst\n${EVIDENCE_END}`;
const NEW_BLOCK = `${EVIDENCE_BEGIN}\n## Context\nsecond, longer\n\n## Uncertainties\n- new\n${EVIDENCE_END}`;
const BODY = `${OLD_BLOCK}\n\n## Investigation notes\n_prompt_\n\n## Decision\n_decide_\n`;
const PATH = 'Notes/UN-1 x.md';

async function setup(options: FakeVaultOptions & { stored?: Record<string, string> } = {}) {
  const { stored, ...vaultOptions } = options;
  const fake = createFakeVault({ basePath: '/vault', ...vaultOptions });
  const harness = createFakeProfileStoreHarness();
  await harness.writeRaw({ profiles: [{ profileId: 'p1', name: 'Alpha', bindingId: null, exclusions: ['.git'], maxFileBytes: 1_000_000 }] });
  const clock = createFixedClock('2026-09-25T10:00:00.000Z');
  const notes = createInvestigationNotes(fake.app, {
    folders: createFakeInvestigationFolders(stored), profiles: harness.store, clock, registerEvent: () => undefined,
  });
  const writes = (): number => fake.calls.create + fake.calls.createFolder + fake.calls.process + fake.calls.processFrontMatter;
  return { fake, profiles: harness.store, clock, notes, writes };
}

function request(overrides: Partial<CreateNoteRequest> = {}): CreateNoteRequest {
  return { identity: IDENTITY, folder: 'Notes', baseName: 'UN-1 x', body: BODY, excludeFolder: false, rootPath: null, ...overrides };
}

const VAULTS: readonly (readonly [string, boolean])[] = [['case-insensitive', true], ['case-sensitive', false]];

// Runs `read` with Obsidian's Platform.isLinux set, then restores it.
function onPlatform<T>(isLinux: boolean, read: () => T): T {
  const saved = Platform.isLinux;
  Platform.isLinux = isLinux;
  try { return read(); } finally { Platform.isLinux = saved; }
}

describe('plan (IN26, IN27, IP9)', () => {
  it('names the note in the folder when nothing is taken', async () => {
    const { notes } = await setup();
    expect(notes.plan('Notes', 'UN-1 x', null)).toEqual({
      status: 'ok', folder: 'Notes', fileName: 'UN-1 x.md', path: 'Notes/UN-1 x.md', renamed: false,
      overlapsRoot: false, rootRelativeFolder: null,
    });
  });

  it('adds (2) when the name is taken', async () => {
    const { fake, notes } = await setup();
    await fake.app.vault.createFolder('Notes');
    await fake.app.vault.create('Notes/UN-1 x.md', 'x');
    expect(notes.plan('Notes', 'UN-1 x', null)).toMatchObject({ status: 'ok', fileName: 'UN-1 x (2).md', path: 'Notes/UN-1 x (2).md', renamed: true });
  });

  it.each(VAULTS)('case-only collision on a %s vault: the existing folder case, and (2)', async (_label, caseInsensitive) => {
    const { fake, notes } = await setup({ caseInsensitive });
    await fake.app.vault.createFolder('notes');
    await fake.app.vault.createFolder('notes/sub');
    await fake.app.vault.create('notes/sub/un-1 x.md', 'theirs');
    expect(notes.plan('Notes/SUB', 'UN-1 x', null)).toMatchObject({ status: 'ok', folder: 'notes/sub', fileName: 'UN-1 x (2).md', renamed: true });
  });

  it.each(VAULTS)('a folder segment that is a file refuses on a %s vault', async (_label, caseInsensitive) => {
    const { fake, notes } = await setup({ caseInsensitive });
    await fake.app.vault.create('notes', 'a file, not a folder');
    expect(notes.plan('Notes', 'x', null)).toEqual({ status: 'folder-is-file' });
    expect(notes.plan('notes/deeper', 'x', null)).toEqual({ status: 'folder-is-file' });
  });

  it('refuses a folder or a name the rules refuse', async () => {
    const { notes } = await setup();
    expect(notes.plan('../x', 'x', null)).toEqual({ status: 'invalid-folder', problem: 'not-relative' });
    expect(notes.plan('.obsidian/x', 'x', null)).toEqual({ status: 'invalid-folder', problem: 'config-dir' });
    expect(notes.plan('Notes', 'a#b', null)).toEqual({ status: 'invalid-name', problem: 'unsafe-name' });
  });

  it('gives no-free-name when the name and (2) to (99) are all taken', async () => {
    const { fake, notes } = await setup();
    await fake.app.vault.createFolder('Notes');
    await fake.app.vault.create('Notes/x.md', '');
    for (let n = 2; n <= 98; n += 1) await fake.app.vault.create(`Notes/x (${n}).md`, '');
    expect(notes.plan('Notes', 'x', null)).toMatchObject({ fileName: 'x (99).md' });
    await fake.app.vault.create('Notes/x (99).md', '');
    expect(notes.plan('Notes', 'x', null)).toEqual({ status: 'no-free-name' });
  });

  it('a deleted note frees its name', async () => {
    const { fake, notes } = await setup();
    await fake.app.vault.createFolder('Notes');
    await fake.app.vault.create('Notes/un-1 x.md', '');
    fake.userDelete('Notes/un-1 x.md');
    expect(notes.plan('Notes', 'UN-1 x', null)).toMatchObject({ fileName: 'UN-1 x.md', renamed: false });
  });
});

describe('plan: overlap with the codebase root (IN29, IP26)', () => {
  it.each([
    ['a folder inside the root', '/vault', '/vault/code', 'code/notes', true, 'notes'],
    ['a folder outside the root', '/vault', '/vault/code', 'Notes', false, null],
    ['the vault is the root', '/vault', '/vault', 'Notes', true, 'Notes'],
    ['the folder is the root', '/vault', '/vault/code', 'code', true, null],
    ['a Windows root', 'C:\\v', 'C:\\v\\code', 'code/notes', true, 'notes'],
  ] as const)('%s', async (_label, basePath, rootPath, folder, overlapsRoot, rootRelativeFolder) => {
    const { notes } = await setup({ basePath });
    expect(notes.plan(folder, 'x', rootPath)).toMatchObject({ status: 'ok', overlapsRoot, rootRelativeFolder });
  });

  it.each([[false, true, 'notes'], [true, false, null]] as const)('a root differing only in case, Platform.isLinux %s: overlapsRoot %s', async (isLinux, overlapsRoot, rootRelativeFolder) => {
    const { notes } = await setup();
    expect(onPlatform(isLinux, () => notes.plan('code/notes', 'x', '/vault/Code'))).toMatchObject({ overlapsRoot, rootRelativeFolder });
  });

  it('a mobile vault (no base path) never overlaps', async () => {
    const { notes } = await setup({ basePath: null });
    expect(notes.plan('code/notes', 'x', '/vault/code')).toMatchObject({ status: 'ok', overlapsRoot: false, rootRelativeFolder: null });
  });
});

describe('create (IN27, IN28)', () => {
  it('creates a then a/b, writes the frontmatter and body, and the index links it', async () => {
    const { fake, notes, clock, writes } = await setup();
    expect(notes.list('p1').byFingerprint.size).toBe(0);
    notes.plan('a/b', 'UN-1 x', null);
    expect(writes()).toBe(0);
    const linked = new Promise<void>((resolve) => { notes.subscribe(() => { resolve(); }); });
    expect(await notes.create(request({ folder: 'a/b' }))).toEqual({ status: 'created', path: 'a/b/UN-1 x.md', exclusion: 'not-requested' });
    expect(fake.calls.createFolder).toBe(2);
    const text = fake.text('a/b/UN-1 x.md') ?? '';
    expect(text.startsWith('---\n')).toBe(true);
    const close = text.indexOf('\n---\n', 3);
    expect(parseYaml(text.slice(4, close + 1))).toEqual(noteFrontmatter(IDENTITY, clock.nowIso()));
    expect(text.slice(close + 5)).toBe(`\n${BODY}`);
    await linked;
    expect(notes.list('p1').byFingerprint.get('src/a.ts#UN-1')?.map((l) => l.path)).toEqual(['a/b/UN-1 x.md']);
  });

  it.each(VAULTS)('reuses an existing segment in its own case on a %s vault', async (_label, caseInsensitive) => {
    const { fake, notes } = await setup({ caseInsensitive });
    await fake.app.vault.createFolder('notes');
    await fake.app.vault.create('notes/un-1 x.md', 'theirs');
    const before = fake.calls.createFolder;
    expect(await notes.create(request())).toEqual({ status: 'refused', reason: 'exists' });
    expect(await notes.create(request({ baseName: 'UN-1 x (2)' }))).toMatchObject({ status: 'created', path: 'notes/UN-1 x (2).md' });
    expect(fake.calls.createFolder).toBe(before);
    expect(fake.paths()).toEqual(['notes/UN-1 x (2).md', 'notes/un-1 x.md']);
    expect(fake.text('notes/un-1 x.md')).toBe('theirs');
  });

  it('IPF8: a taken 100-code-point name is planned and created as its (2) name', async () => {
    const { fake, notes } = await setup();
    const long = 'x'.repeat(100);
    await fake.app.vault.createFolder('Notes');
    await fake.app.vault.create(`Notes/${long}.md`, 'theirs');
    const plan = notes.plan('Notes', long, null);
    const stem = `${'x'.repeat(95)} (2)`;
    expect(plan).toMatchObject({ status: 'ok', fileName: `${stem}.md`, renamed: true });
    expect(await notes.create(request({ baseName: stem }))).toMatchObject({ status: 'created', path: `Notes/${stem}.md` });
  });

  it('refuses an invalid plan or a body without one evidence block, writing nothing', async () => {
    const { notes, writes } = await setup();
    expect(await notes.create(request({ folder: '../x' }))).toEqual({ status: 'refused', reason: 'invalid' });
    expect(await notes.create(request({ body: 'no markers' }))).toEqual({ status: 'refused', reason: 'invalid' });
    expect(await notes.create(request({ body: `${EVIDENCE_END}\n${EVIDENCE_BEGIN}\n` }))).toEqual({ status: 'refused', reason: 'invalid' });
    expect(writes()).toBe(0);
  });

  it.each([
    ['a traversing source path', { sourcePath: '../a.ts' }],
    ['an absolute source path', { sourcePath: '/etc/a.ts' }],
    ['a backslash source path', { sourcePath: 'src\\a.ts' }],
    ['an empty finding id', { findingId: '' }],
    ['an empty codebase id', { codebaseId: '' }],
    ['an over-long snapshot id', { snapshotId: 's'.repeat(2049) }],
    ['a fingerprint over 2,048 characters', { sourcePath: 'a'.repeat(1024), findingId: 'f'.repeat(1024) }],
  ] as const)('refuses an identity with %s as invalid, writing nothing', async (_label, overrides) => {
    const { notes, writes } = await setup();
    expect(await notes.create(request({ identity: { ...IDENTITY, ...overrides } }))).toEqual({ status: 'refused', reason: 'invalid' });
    expect(writes()).toBe(0);
  });

  it('accepts identity values at the 2,048-character bound', async () => {
    const { notes } = await setup();
    const identity = { ...IDENTITY, sourcePath: 'a'.repeat(1023), findingId: 'f'.repeat(1024), snapshotId: 's'.repeat(2048) };
    expect(await notes.create(request({ identity }))).toMatchObject({ status: 'created' });
  });

  it('a failed write is write-failed', async () => {
    const { fake, notes } = await setup();
    fake.app.vault.create = () => Promise.reject(new Error('disk full'));
    expect(await notes.create(request())).toEqual({ status: 'refused', reason: 'write-failed' });
  });
});

describe('create: the race (IN27, IPF16, Review Focus 3)', () => {
  it.each(VAULTS)('another writer at the same path wins on a %s vault: exists, their text kept', async (_label, caseInsensitive) => {
    const { fake, notes } = await setup({ caseInsensitive });
    fake.raceNextCreate('Notes/UN-1 x.md', 'theirs');
    expect(await notes.create(request())).toEqual({ status: 'refused', reason: 'exists' });
    expect(fake.text('Notes/UN-1 x.md')).toBe('theirs');
  });

  it('a request whose re-plan renames is refused as exists, writing nothing', async () => {
    const { fake, notes, writes } = await setup();
    await fake.app.vault.createFolder('Notes');
    await fake.app.vault.create('Notes/UN-1 x.md', 'theirs');
    const before = writes();
    expect(await notes.create(request())).toEqual({ status: 'refused', reason: 'exists' });
    expect(writes()).toBe(before);
    expect(fake.text('Notes/UN-1 x.md')).toBe('theirs');
  });
});

describe('create: the exclusion (IN29, IP26)', () => {
  const inside = { folder: 'code/notes', rootPath: '/vault/code', excludeFolder: true };

  it('adds the root-relative folder to the profile', async () => {
    const { notes, profiles } = await setup();
    expect(await notes.create(request(inside))).toMatchObject({ status: 'created', exclusion: 'added' });
    expect((await profiles.get('p1'))?.exclusions).toEqual(['.git', 'notes']);
  });

  it.each([['the folder', 'code/notes'], ['a parent', 'code/notes/deep']] as const)('%s already excluded: already, profile unchanged', async (_label, folder) => {
    const { notes, profiles } = await setup();
    await profiles.update('p1', (p) => ({ ...p, exclusions: ['.git', 'notes'] }));
    expect(await notes.create(request({ ...inside, folder }))).toMatchObject({ status: 'created', exclusion: 'already' });
    expect((await profiles.get('p1'))?.exclusions).toEqual(['.git', 'notes']);
  });

  it('an exclusion that is only a name prefix is not a parent: added', async () => {
    const { notes, profiles } = await setup();
    await profiles.update('p1', (p) => ({ ...p, exclusions: ['.git', 'note'] }));
    expect(await notes.create(request(inside))).toMatchObject({ exclusion: 'added' });
    expect((await profiles.get('p1'))?.exclusions).toEqual(['.git', 'note', 'notes']);
  });

  it('not requested, outside the root, or equal to the root: not-requested, profile unchanged', async () => {
    const { notes, profiles } = await setup();
    expect(await notes.create(request({ ...inside, excludeFolder: false }))).toMatchObject({ exclusion: 'not-requested' });
    expect(await notes.create(request({ ...inside, folder: 'Notes' }))).toMatchObject({ exclusion: 'not-requested' });
    expect(await notes.create(request({ ...inside, folder: 'code' }))).toMatchObject({ exclusion: 'not-requested' });
    expect((await profiles.get('p1'))?.exclusions).toEqual(['.git']);
  });

  it('the profile removed meanwhile: failed, and the note still exists', async () => {
    const { fake, notes, profiles } = await setup();
    await profiles.remove('p1');
    expect(await notes.create(request(inside))).toEqual({ status: 'created', path: 'code/notes/UN-1 x.md', exclusion: 'failed' });
    expect(fake.text('code/notes/UN-1 x.md')).toBeDefined();
  });
});

async function created(identity: NoteIdentity = IDENTITY) {
  const context = await setup();
  expect(await context.notes.create(request({ identity }))).toMatchObject({ status: 'created', path: PATH });
  return context;
}

function split(text: string): { frontmatter: Record<string, unknown>; body: string } {
  const close = text.indexOf('\n---\n', 3);
  return { frontmatter: parseYaml(text.slice(4, close + 1)) as Record<string, unknown>, body: text.slice(close + 5) };
}

// The user's own edits: a new key, their status, and words under "Investigation notes".
function userEdits(fake: FakeVault): string {
  const { frontmatter, body } = split(fake.text(PATH) ?? '');
  const edited = body.replace('_prompt_\n', '_prompt_\nIt is used by the plugin loader.\n');
  fake.userWrite(PATH, `---\n${stringifyYaml({ ...frontmatter, status: 'done', reviewer: 'me' })}---\n${edited}`);
  return edited;
}

function refreshRequest(overrides: Partial<RefreshNoteRequest> = {}): RefreshNoteRequest {
  return { path: PATH, codebaseId: 'p1', block: NEW_BLOCK, snapshotId: 's2', sourcePath: 'src/b.ts', ...overrides };
}

describe('refresh (IN31, IN32, IP8)', () => {
  it('replaces only the block; the human text is byte-identical and the user values are kept', async () => {
    const { fake, notes, clock } = await created();
    const body = userEdits(fake);
    expect(await notes.refresh(refreshRequest())).toBe('refreshed');
    const after = split(fake.text(PATH) ?? '');
    expect(after.body).toBe(body.replace(OLD_BLOCK, NEW_BLOCK));
    expect(after.body.slice(after.body.indexOf(EVIDENCE_END))).toBe(body.slice(body.indexOf(EVIDENCE_END)));
    expect(after.frontmatter).toMatchObject({ snapshot_id: 's2', source_path: 'src/b.ts', reviewer: 'me', status: 'done', created: clock.nowIso() });
  });

  // The body only: the fake's frontmatter reader, unlike the real cache, needs LF there.
  it('keeps a CRLF body CRLF outside the block', async () => {
    const { fake, notes } = await created();
    const text0 = fake.text(PATH) ?? '';
    const close = text0.indexOf('\n---\n', 3) + 5;
    fake.userWrite(PATH, `${text0.slice(0, close)}${text0.slice(close).split('\n').join('\r\n')}`);
    expect(await notes.refresh(refreshRequest())).toBe('refreshed');
    const text = fake.text(PATH) ?? '';
    expect(text.endsWith('## Decision\r\n_decide_\r\n')).toBe(true);
    expect(text).toContain(NEW_BLOCK.split('\n').join('\r\n'));
  });

  it.each([
    ['an indented end marker', (t: string) => t.replace(EVIDENCE_END, ` ${EVIDENCE_END}`)],
    ['a duplicated begin marker', (t: string) => t.replace('_prompt_', EVIDENCE_BEGIN)],
    ['a vanished end marker', (t: string) => t.replace(`${EVIDENCE_END}\n`, '')],
  ] as const)('%s: markers-edited, text byte-identical, no frontmatter write', async (_label, disturb) => {
    const { fake, notes } = await created();
    fake.userWrite(PATH, disturb(fake.text(PATH) ?? ''));
    const before = fake.text(PATH);
    const frontmatterWrites = fake.calls.processFrontMatter;
    expect(await notes.refresh(refreshRequest())).toBe('markers-edited');
    expect(fake.text(PATH)).toBe(before);
    expect(fake.calls.processFrontMatter).toBe(frontmatterWrites);
  });

  it('re-validates the markers against the text vault.process hands it, not the text read before', async () => {
    const { fake, notes } = await created();
    const broken = (fake.text(PATH) ?? '').replace(`${EVIDENCE_END}\n`, '');
    const process = fake.app.vault.process.bind(fake.app.vault);
    fake.app.vault.process = (file, fn) => { fake.userWrite(PATH, broken); return process(file, fn); };
    expect(await notes.refresh(refreshRequest())).toBe('markers-edited');
    expect(fake.text(PATH)).toBe(broken);
  });

  it('a missing path is missing', async () => {
    const { notes } = await created();
    expect(await notes.refresh(refreshRequest({ path: 'Notes/gone.md' }))).toBe('missing');
  });

  it('a note of another codebase, or with its type removed, is not-linked and untouched', async () => {
    const { fake, notes } = await created({ ...IDENTITY, codebaseId: 'p2' });
    const before = fake.text(PATH);
    expect(await notes.refresh(refreshRequest())).toBe('not-linked');
    expect(fake.text(PATH)).toBe(before);
    const { frontmatter, body } = split(before ?? '');
    const { type: _type, ...untyped } = frontmatter;
    fake.userWrite(PATH, `---\n${stringifyYaml({ ...untyped, codebase_id: 'p1' })}---\n${body}`);
    const untypedText = fake.text(PATH);
    expect(await notes.refresh(refreshRequest())).toBe('not-linked');
    expect(fake.text(PATH)).toBe(untypedText);
  });

  it('WP-04 E15: a frontmatter write that fails after the block was replaced is partial, not write-failed', async () => {
    const { fake, notes } = await created();
    fake.app.fileManager.processFrontMatter = () => Promise.reject(new Error('locked'));
    expect(await notes.refresh(refreshRequest())).toEqual({ status: 'partial' });
    const after = split(fake.text(PATH) ?? '');
    expect(after.body).toContain(NEW_BLOCK);
    expect(after.frontmatter).toMatchObject({ snapshot_id: 's1', source_path: 'src/a.ts' });
  });

  it.each([
    ['a traversing source path', { sourcePath: '../x.ts' }],
    ['a backslash source path', { sourcePath: 'src\\b.ts' }],
    ['an empty snapshot id', { snapshotId: '' }],
    ['an over-long snapshot id', { snapshotId: 's'.repeat(2049) }],
  ] as const)('%s is write-failed, nothing written', async (_label, overrides) => {
    const { fake, notes, writes } = await created();
    const before = fake.text(PATH);
    const count = writes();
    expect(await notes.refresh(refreshRequest(overrides))).toBe('write-failed');
    expect(fake.text(PATH)).toBe(before);
    expect(writes()).toBe(count);
  });

  it.each([
    ['no markers', 'plain'],
    ['a second begin inside', `${EVIDENCE_BEGIN}\n${EVIDENCE_BEGIN}\n${EVIDENCE_END}`],
    ['a CR inside', `${EVIDENCE_BEGIN}\nx\ry\n${EVIDENCE_END}`],
  ] as const)('a block with %s is write-failed, nothing written', async (_label, block) => {
    const { fake, notes, writes } = await created();
    const before = fake.text(PATH);
    const count = writes();
    expect(await notes.refresh(refreshRequest({ block }))).toBe('write-failed');
    expect(fake.text(PATH)).toBe(before);
    expect(writes()).toBe(count);
  });

  it('a failing write is write-failed', async () => {
    const { fake, notes } = await created();
    fake.app.vault.process = () => Promise.reject(new Error('locked'));
    expect(await notes.refresh(refreshRequest())).toBe('write-failed');
  });
});

describe('open (IN30)', () => {
  it('opens an existing note in a new leaf, and refuses a missing one', async () => {
    const { fake, notes } = await created();
    expect(await notes.open(PATH)).toBe(true);
    expect(fake.opened).toEqual([PATH]);
    expect(await notes.open('Notes/gone.md')).toBe(false);
    expect(fake.opened).toEqual([PATH]);
  });
});

describe('destination (IN18, IP11)', () => {
  it('defaults to the profile name, a stored folder wins, an unknown profile gets the root default', async () => {
    expect(await (await setup()).notes.destination('p1')).toEqual({ folder: 'Codebase investigations/Alpha', isDefault: true });
    expect(await (await setup({ stored: { p1: 'My/Notes' } })).notes.destination('p1')).toEqual({ folder: 'My/Notes', isDefault: false });
    expect(await (await setup()).notes.destination('nobody')).toEqual({ folder: 'Codebase investigations', isDefault: true });
  });
});

describe('sourceNotePath (IN12)', () => {
  async function withDocs(options: FakeVaultOptions = {}) {
    const context = await setup(options);
    await context.fake.app.vault.createFolder('docs');
    await context.fake.app.vault.create('docs/guide.md', '# Guide');
    await context.fake.app.vault.create('docs/a.ts', 'export {}');
    return context.notes;
  }

  it('returns the vault path of a Markdown file the vault holds under the root', async () => {
    expect((await withDocs()).sourceNotePath('/vault/docs', 'guide.md')).toBe('docs/guide.md');
    expect((await withDocs()).sourceNotePath('/vault', 'docs/guide.md')).toBe('docs/guide.md');
    expect((await withDocs({ basePath: 'C:\\v' })).sourceNotePath('C:\\v\\docs', 'guide.md')).toBe('docs/guide.md');
  });

  it.each([[false, 'docs/guide.md'], [true, null]] as const)('a root whose vault part differs in case, Platform.isLinux %s: %s', async (isLinux, expected) => {
    const notes = await withDocs();
    expect(onPlatform(isLinux, () => notes.sourceNotePath('/VAULT/docs', 'guide.md'))).toBe(expected);
  });

  it('refuses a code file, a root outside the vault, a mobile vault and a file the vault does not hold', async () => {
    const notes = await withDocs();
    expect(notes.sourceNotePath('/vault/docs', 'a.ts')).toBeNull();
    expect(notes.sourceNotePath('/elsewhere/docs', 'guide.md')).toBeNull();
    expect(notes.sourceNotePath('/vault/docs', 'missing.md')).toBeNull();
    expect(notes.sourceNotePath('/vault/docs', '../../outside.md')).toBeNull();
    expect((await withDocs({ basePath: null })).sourceNotePath('/vault/docs', 'guide.md')).toBeNull();
  });
});
