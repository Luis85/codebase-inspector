// Task 7 (IN37): the in-memory vault fixture and the mock's parseYaml/stringifyYaml.
import { describe, expect, it } from 'vitest';
import { parseYaml, stringifyYaml, TFile } from '../mocks/obsidian';
import { createFakeVault } from '../fixtures/fake-vault';
import type { FakeVault } from '../fixtures/fake-vault';

// Fix round 1 (WP-04 E12): "changed" now fires asynchronously (queueMicrotask inside the
// fixture, never inline). A test must register this BEFORE the triggering call and await
// it afterward -- never assume the event already happened right after that call returns.
function nextChanged(fakeVault: FakeVault): Promise<void> {
  return new Promise((resolve) => {
    fakeVault.app.metadataCache.on('changed', () => resolve());
  });
}

// IN20: every value the note renderer writes into frontmatter is a string, including
// values that LOOK like other YAML types (a bare `yes`, `null`, a leading-zero number, a
// boolean word) or that could be mis-parsed as YAML syntax (a mapping, a comment, a
// wikilink, a list item, an apostrophe, a quoted string). IP29: only the PARSED values
// are asserted -- never the bytes stringifyYaml wrote, because real Obsidian's own
// serialiser (not this `yaml` library) is what actually produces those bytes.
const YAML_ROUND_TRIP_VALUES: Record<string, string> = {
  mapping: 'a: b',
  comment: '#x',
  wikilink: '[[x]]',
  listItem: '- y',
  apostrophe: "it's",
  quoted: '"q"',
  bareYes: 'yes',
  bareNull: 'null',
  leadingZero: '0012',
  bareTrue: 'true',
  snapshotId: 'snapshot:p1:2026-09-25T10:00:00.000Z',
  fingerprint: 'src/a.ts#UN-00000001',
};

describe('parseYaml/stringifyYaml (IN20, IP29)', () => {
  it('round-trips every value as a string', () => {
    const text = stringifyYaml(YAML_ROUND_TRIP_VALUES);
    const parsed = parseYaml(text);
    expect(parsed).toEqual(YAML_ROUND_TRIP_VALUES);
    const values = Object.values(parsed as Record<string, unknown>);
    expect(values.length).toBeGreaterThan(0);
    for (const value of values) expect(typeof value).toBe('string');
  });
});

describe('createFakeVault: create (IPF16)', () => {
  it('rejects an existing path and leaves the text unchanged', async () => {
    const fakeVault = createFakeVault();
    await fakeVault.app.vault.create('note.md', 'first');
    await expect(fakeVault.app.vault.create('note.md', 'second')).rejects.toThrow('File already exists.');
    expect(fakeVault.text('note.md')).toBe('first');
  });

  it('rejects a case-only duplicate by default (a case-insensitive vault)', async () => {
    const fakeVault = createFakeVault();
    await fakeVault.app.vault.create('Note.md', 'first');
    await expect(fakeVault.app.vault.create('note.md', 'second')).rejects.toThrow('File already exists.');
    expect(fakeVault.text('Note.md')).toBe('first');
  });

  it('a case-sensitive fake (Task 9\'s other vault) allows the case-only variant', async () => {
    const fakeVault = createFakeVault({ caseInsensitive: false });
    await fakeVault.app.vault.create('Note.md', 'first');
    await expect(fakeVault.app.vault.create('note.md', 'second')).resolves.toBeInstanceOf(Object);
    expect(fakeVault.paths()).toEqual(['Note.md', 'note.md']);
  });

  it('rejects when the parent folder is missing', async () => {
    const fakeVault = createFakeVault();
    await expect(fakeVault.app.vault.create('missing/note.md', 'x')).rejects.toThrow();
    expect(fakeVault.paths()).toEqual([]);
  });

  it('getAbstractFileByPath stays exact and case-sensitive, unlike create', async () => {
    const fakeVault = createFakeVault();
    await fakeVault.app.vault.create('Note.md', 'x');
    expect(fakeVault.app.vault.getAbstractFileByPath('note.md')).toBeNull();
    expect(fakeVault.app.vault.getAbstractFileByPath('Note.md')).not.toBeNull();
  });
});

describe('createFakeVault: createFolder (IPF20, IN28)', () => {
  it('rejects a nested folder before its parent exists, then succeeds once the parent does', async () => {
    const fakeVault = createFakeVault();
    await expect(fakeVault.app.vault.createFolder('a/b')).rejects.toThrow();
    await fakeVault.app.vault.createFolder('a');
    await expect(fakeVault.app.vault.createFolder('a/b')).resolves.toBeInstanceOf(Object);
  });

  it('rejects a folder that already exists', async () => {
    const fakeVault = createFakeVault();
    await fakeVault.app.vault.createFolder('a');
    await expect(fakeVault.app.vault.createFolder('a')).rejects.toThrow('Folder already exists.');
  });
});

describe('createFakeVault: processFrontMatter (IPF18, IPF19)', () => {
  it('changes one key and leaves the body byte-identical', async () => {
    const fakeVault = createFakeVault();
    const original = '---\nstatus: open\ncodebase_id: p1\n---\nBody line one.\nBody line two.\n';
    const file = await fakeVault.app.vault.create('note.md', original);

    await fakeVault.app.fileManager.processFrontMatter(file, (frontmatter) => {
      (frontmatter as Record<string, unknown>).status = 'closed';
    });

    const next = fakeVault.text('note.md')!;
    const originalBodyStart = original.indexOf('---\n', 4) + 4;
    const nextBodyStart = next.indexOf('---\n', 4) + 4;
    expect(next.slice(nextBodyStart)).toBe(original.slice(originalBodyStart));
    expect(parseYaml(next.slice(4, next.indexOf('---\n', 4)))).toEqual({ status: 'closed', codebase_id: 'p1' });
  });

  it('metadataCache.getFileCache parses the same way: undefined when the block is absent or not a mapping', async () => {
    const fakeVault = createFakeVault();
    const plain = await fakeVault.app.vault.create('plain.md', 'no frontmatter here');
    expect(fakeVault.app.metadataCache.getFileCache(plain)?.frontmatter).toBeUndefined();

    const listBlock = await fakeVault.app.vault.create('list.md', '---\n- a\n- b\n---\nBody\n');
    expect(fakeVault.app.metadataCache.getFileCache(listBlock)?.frontmatter).toBeUndefined();

    const mapping = await fakeVault.app.vault.create('mapping.md', '---\nstatus: open\n---\nBody\n');
    expect(fakeVault.app.metadataCache.getFileCache(mapping)?.frontmatter).toEqual({ status: 'open' });
  });

  it('a genuinely malformed block (yaml.parse throws) leaves the cache undefined; processFrontMatter starts fresh', async () => {
    const fakeVault = createFakeVault();
    // An unterminated flow sequence: yaml.parse throws rather than returning a value.
    const malformed = '---\nstatus: [open\n---\nBody\n';
    const file = await fakeVault.app.vault.create('broken.md', malformed);

    expect(fakeVault.app.metadataCache.getFileCache(file)?.frontmatter).toBeUndefined();

    await fakeVault.app.fileManager.processFrontMatter(file, (frontmatter) => {
      (frontmatter as Record<string, unknown>).status = 'closed';
    });

    const next = fakeVault.text('broken.md')!;
    expect(parseYaml(next.slice(4, next.indexOf('---\n', 4)))).toEqual({ status: 'closed' });
    expect(next.endsWith('---\nBody\n')).toBe(true);
  });
});

describe('createFakeVault: vault.process fires "changed" (IPF18)', () => {
  it('writes the callback\'s return value and fires metadata "changed" once the write settles', async () => {
    const fakeVault = createFakeVault();
    const file = await fakeVault.app.vault.create('note.md', 'before');
    const changed = nextChanged(fakeVault);

    const result = await fakeVault.app.vault.process(file, (data) => `${data}-after`);

    expect(result).toBe('before-after');
    expect(fakeVault.text('note.md')).toBe('before-after');
    await changed;
  });
});

// Fix round 1 (WP-04 E12): the real metadata cache re-parses off the write -- the Task 0
// native probe had to poll for `changed`. The fake must fire it the same way: never
// synchronously inside create/process/processFrontMatter, only once queued work runs.
describe('createFakeVault: "changed" fires asynchronously, never synchronously (WP-04 E12)', () => {
  it('has not fired "changed" synchronously right after vault.create returns its promise', async () => {
    const fakeVault = createFakeVault();
    let firedSync = false;
    const changed = nextChanged(fakeVault);
    fakeVault.app.metadataCache.on('changed', () => { firedSync = true; });

    const created = fakeVault.app.vault.create('note.md', 'hello');
    // Checked synchronously, before any microtask has run.
    expect(firedSync).toBe(false);

    await created;
    await changed;
    expect(firedSync).toBe(true);
  });
});

describe('createFakeVault: user-driven edits and listeners', () => {
  it('userRename fires vault "rename" synchronously, then metadata "changed" once the write settles', async () => {
    const fakeVault = createFakeVault();
    await fakeVault.app.vault.create('old.md', 'hello');
    const events: string[] = [];
    fakeVault.app.vault.on('rename', () => { events.push('rename'); });
    const changed = nextChanged(fakeVault);

    fakeVault.userRename('old.md', 'new.md');

    // "rename" is synchronous; "changed" (E12) is not -- checked right here, before any
    // microtask has run.
    expect(events).toEqual(['rename']);
    await changed;
    events.push('changed');

    expect(events).toEqual(['rename', 'changed']);
    expect(fakeVault.text('new.md')).toBe('hello');
    expect(fakeVault.text('old.md')).toBeUndefined();
  });

  it('userRename throws on a colliding destination instead of silently overwriting it', async () => {
    const fakeVault = createFakeVault();
    await fakeVault.app.vault.create('old.md', 'old text');
    await fakeVault.app.vault.create('new.md', 'already here');

    expect(() => fakeVault.userRename('old.md', 'new.md')).toThrow();

    expect(fakeVault.text('old.md')).toBe('old text');
    expect(fakeVault.text('new.md')).toBe('already here');
  });

  // Fix round 2: a case-only rename of a file TO ITSELF is legitimate in real Obsidian
  // (Windows/macOS case-insensitive disks let a user correct a name's case) and must not
  // be mistaken for a collision against the file's own existing entry.
  it('a case-only rename to itself succeeds (moves, keeps content, fires "rename")', async () => {
    const fakeVault = createFakeVault();
    await fakeVault.app.vault.create('note.md', 'hello');
    const events: string[] = [];
    fakeVault.app.vault.on('rename', () => { events.push('rename'); });

    fakeVault.userRename('note.md', 'Note.md');

    expect(events).toEqual(['rename']);
    expect(fakeVault.text('Note.md')).toBe('hello');
    expect(fakeVault.text('note.md')).toBeUndefined();
    expect(fakeVault.paths()).toEqual(['Note.md']);
  });

  it('renaming onto a DIFFERENT existing file still throws, even when it differs only by case', async () => {
    const fakeVault = createFakeVault();
    await fakeVault.app.vault.create('old.md', 'old text');
    await fakeVault.app.vault.create('New.md', 'already here');

    expect(() => fakeVault.userRename('old.md', 'new.md')).toThrow();

    expect(fakeVault.text('old.md')).toBe('old text');
    expect(fakeVault.text('New.md')).toBe('already here');
  });

  it('userDelete fires vault "delete"', async () => {
    const fakeVault = createFakeVault();
    await fakeVault.app.vault.create('note.md', 'hello');
    const events: string[] = [];
    fakeVault.app.vault.on('delete', () => { events.push('delete'); });

    fakeVault.userDelete('note.md');

    expect(events).toEqual(['delete']);
    expect(fakeVault.text('note.md')).toBeUndefined();
  });

  it('userWrite writes the text and fires metadata "changed" once the write settles', async () => {
    const fakeVault = createFakeVault();
    await fakeVault.app.vault.create('note.md', 'before');
    const changed = nextChanged(fakeVault);

    fakeVault.userWrite('note.md', 'after');

    expect(fakeVault.text('note.md')).toBe('after');
    await changed;
  });

  it('resolve() fires metadata "resolved"', () => {
    const fakeVault = createFakeVault();
    let fired = false;
    fakeVault.app.metadataCache.on('resolved', () => { fired = true; });

    fakeVault.resolve();

    expect(fired).toBe(true);
  });
});

describe('createFakeVault: raceNextCreate', () => {
  it('makes the next create of that path reject, with the other writer\'s text in place', async () => {
    const fakeVault = createFakeVault();
    fakeVault.raceNextCreate('note.md', 'other writer text');

    await expect(fakeVault.app.vault.create('note.md', 'mine')).rejects.toThrow('File already exists.');

    expect(fakeVault.text('note.md')).toBe('other writer text');
    expect(fakeVault.calls.create).toBe(1);
  });
});

describe('createFakeVault: call counts, opened paths and the full path list', () => {
  it('tracks every produced surface together', async () => {
    const fakeVault = createFakeVault();
    await fakeVault.app.vault.create('a.md', 'A');
    await fakeVault.app.vault.create('b.md', 'B');
    await fakeVault.app.vault.create('c.txt', 'C');
    await fakeVault.app.vault.createFolder('folder');

    const markdown = fakeVault.app.vault.getMarkdownFiles();
    expect(markdown.map((f) => f.path)).toEqual(['a.md', 'b.md']);

    const fileA = fakeVault.app.vault.getAbstractFileByPath('a.md');
    if (!(fileA instanceof TFile)) throw new Error('expected a.md to exist as a file');
    await fakeVault.app.workspace.getLeaf(true).openFile(fileA);

    expect(fakeVault.calls).toEqual({ getMarkdownFiles: 1, create: 3, createFolder: 1, process: 0, processFrontMatter: 0 });
    expect(fakeVault.paths()).toEqual(['a.md', 'b.md', 'c.txt']);
    expect(fakeVault.opened).toEqual(['a.md']);
  });
});
