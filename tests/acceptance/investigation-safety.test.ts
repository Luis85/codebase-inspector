// WP-04 IN39 (IP44), IN27, IN31, IN35 and Review Focus 1–3 as acceptance cases over the
// Investigate screen, the REAL host notes port and the fake vault: report text that is
// Markdown or Obsidian syntax (a symbol, a specifier, a zone name, a file path), traversal in
// the create dialog, exact and case-only collisions, a vanished or doubled marker, and "only
// the dialogs write". Every report goes through the real parser and normaliser.
import { beforeEach, describe, expect, it } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import type { CodebaseSnapshot } from '../../src/domain/model';
import { EVIDENCE_BEGIN, EVIDENCE_END } from '../../src/application/investigation/note-model';
import { NOTE_VOCABULARY, NOTES_FOLDER_PROBLEM, NOTE_CREATE_RENAMED, REFRESH_MARKERS_EDITED } from '../../src/ui/inspector-copy';
import { parseYaml } from '../mocks/obsidian';
import { buildSnapshotFixture } from '../fixtures/snapshot-builder';
import { snapshotWithPaths, syntheticFallowJson } from '../fixtures/evidence-report';
import type { FakeVault } from '../fixtures/fake-vault';
import {
  click, createThroughDialog, mountWorld, refreshThroughDialog, reportFor, rowWhere, selectRow, show, textOf, writeCalls,
} from './investigation-support';
import type { Mounted } from './investigation-support';
import type { FindingCategory } from '../../src/application/evidence/model';

const SAFETY_TIMEOUT = 30_000;
/** E9: the bidi override is built from its number, never typed into this file. */
const RLO = String.fromCharCode(0x202e);
/** IN39's hostile text: every Markdown and Obsidian opener, a marker comment, bare URLs, a
 *  bidi override, and a line break followed by a heading and an ordered-list item. */
const H = `[[x]] ![[x]] <script>alert(1)</script> ${EVIDENCE_END} #tag $x$ %%c%% ==x== https://x www.x ${RLO}evil\n# h\n1) item`;
const IN20_KEYS = [
  'type', 'codebase_id', 'entity_id', 'source_path', 'snapshot_id', 'finding_id', 'finding_fingerprint', 'provider', 'status', 'created',
];
const HEADING_LINES = Object.values(NOTE_VOCABULARY.headings).map((h) => `## ${h}`);

interface RawReport { check: { unresolved_imports: { specifier: string }[]; boundary_violations: { from_zone: string }[] } }

function eightFiles(): CodebaseSnapshot {
  const base = buildSnapshotFixture({ files: 8, directories: 2 });
  return { ...base, scope: { ...base.scope, rootPath: '/elsewhere/code' } };
}

/** IP44: the symbol through the generator's own option; the specifier and a zone name by
 *  editing its JSON before the real parser reads it. */
function hostileJson(snapshot: CodebaseSnapshot): string {
  const raw = JSON.parse(syntheticFallowJson(snapshot, { symbol: H })) as RawReport;
  raw.check.unresolved_imports[0]!.specifier = H;
  raw.check.boundary_violations[0]!.from_zone = H;
  return JSON.stringify(raw);
}

async function world(snapshot: CodebaseSnapshot = eightFiles(), json: string = syntheticFallowJson(snapshot)) {
  const report = await reportFor(snapshot, json, 'synthetic-fallow.json');
  const { fake, w } = await mountWorld({ snapshot, report, root: null, vaultPath: '/vault' });
  const first = snapshot.entities.find((e) => e.kind === 'file')!.path;
  const rowOf = (kind: FindingCategory) => rowWhere((r) => r.kind === kind && r.anchorPath === first, kind);
  return { snapshot, fake, w, rowOf };
}

function frontmatterOf(text: string): Record<string, unknown> {
  const match = /^---\n([\s\S]*?)\n---\n/.exec(text);
  if (!match) throw new Error('the note has no frontmatter block');
  return parseYaml(match[1]!) as Record<string, unknown>;
}

/** An occurrence of `token` that no backslash escapes (its first character not preceded by `\`). */
function unescaped(text: string, token: string): boolean {
  let at = text.indexOf(token);
  while (at !== -1) {
    if (at === 0 || text[at - 1] !== '\\') return true;
    at = text.indexOf(token, at + 1);
  }
  return false;
}

/** IN22–IN24: a note whose structure no report text changed. */
function expectInert(text: string): void {
  const lines = text.split('\n');
  expect(lines.filter((l) => l === EVIDENCE_BEGIN)).toHaveLength(1);
  expect(lines.filter((l) => l === EVIDENCE_END)).toHaveLength(1);
  // The only headings are our own eight, in order; no line opens an ordered list.
  expect(lines.filter((l) => l.startsWith('#'))).toEqual(HEADING_LINES);
  expect(lines.filter((l) => /^\s*\d+[.)]/.test(l))).toEqual([]);
  // Every list line is one of ours: a label, a checklist box, a nested code item, or an uncertainty.
  const uncertainties = lines.indexOf(`## ${NOTE_VOCABULARY.headings.uncertainties}`);
  const listLines = lines.map((l, i) => ({ l, i })).filter(({ l }) => /^\s*[-+*] /.test(l));
  expect(listLines.length).toBeGreaterThan(0);
  for (const { l, i } of listLines) {
    const ours = l.startsWith('- [ ] ') || l.startsWith('  - `') || /^- [A-Z][A-Za-z ]*: /.test(l) || /^- [A-Z][A-Za-z ]*:$/.test(l)
      || (i > uncertainties && i < lines.indexOf(EVIDENCE_END) && l.startsWith('- '));
    expect(ours, `a list line that is not ours: ${l}`).toBe(true);
  }
  // The payload stayed on one line: each line carrying it carries all of it, flattened.
  const carriers = lines.filter((l) => l.includes('evil'));
  expect(carriers.length).toBeGreaterThan(0);
  for (const line of carriers) expect(line).toContain('evil \\# h 1) item');
  for (const token of ['[[', '<script', '%%', '==x==', '$x$', 'https://', 'www.', RLO]) {
    expect(unescaped(text, token), `unescaped ${token}`).toBe(false);
  }
  expect(Object.keys(frontmatterOf(text))).toEqual(IN20_KEYS);
}

describe('injection through report text (IN39, Review Focus 2)', () => {
  beforeEach(() => { setActivePinia(createPinia()); });

  it('a symbol, a specifier and a zone name holding every opener give inert notes; the screen shows the text as text', async () => {
    const snapshot = eightFiles();
    const { fake, w, rowOf } = await world(snapshot, hostileJson(snapshot));
    const kinds: FindingCategory[] = ['unused-exports', 'unresolved-import', 'boundary'];
    for (const kind of kinds) {
      await selectRow(w, rowOf(kind));
      expect(w.find('script').exists()).toBe(false);
      const path = await createThroughDialog(w);
      const text = textOf(fake, path);
      expect(text).toContain('evil');
      expectInert(text);
    }
    expect(fake.paths()).toHaveLength(kinds.length);
    // Rendered by interpolation only: the row shows H verbatim, and no element came of it.
    expect(document.body.textContent).toContain(`${RLO}evil`);
    expect(w.findAll('.ci-investigate-row').some((r) => (r.element.textContent ?? '').includes(H))).toBe(true);
    expect(document.querySelector('script')).toBeNull();
    w.unmount();
  }, SAFETY_TIMEOUT);

  it('a hostile file name: the proposed name holds none of [ ] # ^ |, and source_path round-trips exactly', async () => {
    const hostilePath = 'src/[[x]]#^|a.ts';
    const snapshot = { ...snapshotWithPaths([hostilePath]), scope: { ...eightFiles().scope } };
    const { fake, w, rowOf } = await world(snapshot);
    const row = rowOf('unused-exports');
    await selectRow(w, row);
    await click(w, '.ci-notes-panel__create');
    const proposed = (w.find('.ci-create-note__name').element as HTMLInputElement).value;
    expect(proposed.length).toBeGreaterThan(0);
    for (const ch of ['[', ']', '#', '^', '|']) expect(proposed).not.toContain(ch);
    await click(w, '.ci-create-note__confirm');
    const [path] = fake.paths();
    expect(path).toBe(w.find('.ci-notes-panel__open').attributes('data-path'));
    const fm = frontmatterOf(textOf(fake, path!));
    expect(fm.source_path).toBe(hostilePath);
    expect(fm.finding_fingerprint).toBe(`${hostilePath}#${row.id}`);
    w.unmount();
  }, SAFETY_TIMEOUT);
});

describe('the create dialog never writes outside a valid folder, nor over a note (IN19, IN27)', () => {
  beforeEach(() => { setActivePinia(createPinia()); });

  it.each(['../x', '/abs', 'C:\\x', '.obsidian/x', 'a/./b'])('traversal: %s is refused in the dialog and nothing is written', async (folder) => {
    const { fake, w, rowOf } = await world();
    await selectRow(w, rowOf('unused-exports'));
    await click(w, '.ci-notes-panel__create');
    await w.find('.ci-create-note__folder').setValue(folder);
    expect(Object.values(NOTES_FOLDER_PROBLEM)).toContain(w.find('.ci-create-note__problem').text());
    expect(w.find('.ci-create-note__path').exists()).toBe(false);
    expect(w.find('.ci-create-note__confirm').attributes('aria-disabled')).toBe('true');
    await click(w, '.ci-create-note__confirm');
    expect(fake.paths()).toEqual([]);
    expect(writeCalls(fake)).toBe(0);
    w.unmount();
  }, SAFETY_TIMEOUT);

  it('exact collision: two creates for one finding give <name>.md and <name> (2).md, the first byte-identical', async () => {
    const { fake, w, rowOf } = await world();
    await selectRow(w, rowOf('unused-exports'));
    const first = await createThroughDialog(w);
    const firstText = textOf(fake, first);
    const second = await createThroughDialog(w);
    expect(second).toBe(`${first.slice(0, -'.md'.length)} (2).md`);
    expect(fake.paths()).toEqual([second, first].sort());
    expect(textOf(fake, first)).toBe(firstText);
    w.unmount();
  }, SAFETY_TIMEOUT);

  it('case-only collision: with a lower-cased copy in the folder, the dialog proposes <name> (2).md before confirm', async () => {
    const { fake, w, rowOf } = await world();
    await selectRow(w, rowOf('unused-exports'));
    await click(w, '.ci-notes-panel__create');
    const planned = w.find('.ci-create-note__path').text();
    const folder = planned.slice(0, planned.lastIndexOf('/'));
    const name = planned.slice(planned.lastIndexOf('/') + 1, -'.md'.length);
    expect(name.toLowerCase()).not.toBe(name);
    await click(w, '.ci-create-note__cancel');
    let parent = '';
    for (const segment of folder.split('/')) {
      parent = parent === '' ? segment : `${parent}/${segment}`;
      await fake.app.vault.createFolder(parent);
    }
    await fake.app.vault.create(`${folder}/${name.toLowerCase()}.md`, 'theirs\n');
    await click(w, '.ci-notes-panel__create');
    expect(w.find('.ci-create-note__path').text()).toBe(`${folder}/${name} (2).md`);
    expect(w.find('.ci-create-note__renamed').text()).toBe(NOTE_CREATE_RENAMED(`${name} (2).md`));
    await click(w, '.ci-create-note__confirm');
    expect(fake.paths()).toEqual([`${folder}/${name} (2).md`, `${folder}/${name.toLowerCase()}.md`].sort());
    expect(textOf(fake, `${folder}/${name.toLowerCase()}.md`)).toBe('theirs\n');
    w.unmount();
  }, SAFETY_TIMEOUT);
});

/** IN31: Refresh evidence on a note whose markers were disturbed is refused, and the note is untouched. */
async function refuseRefresh(w: Mounted, fake: FakeVault, path: string): Promise<void> {
  const before = textOf(fake, path);
  const processed = fake.calls.process;
  await refreshThroughDialog(w, path);
  expect(w.find('.ci-refresh-note__error[role="alert"]').text()).toBe(REFRESH_MARKERS_EDITED);
  expect(textOf(fake, path)).toBe(before);
  // IN31: one `process`, whose callback refused and returned the text unchanged; no frontmatter write.
  expect(fake.calls.process - processed).toBe(1);
  expect(fake.calls.processFrontMatter).toBe(0);
  await click(w, '.ci-refresh-note__cancel');
}

describe('refresh and the markers, and who writes (IN31, IN35; Review Focus 1)', () => {
  beforeEach(() => { setActivePinia(createPinia()); });

  it('vanished or doubled marker: each refresh reports REFRESH_MARKERS_EDITED and each note is byte-identical', async () => {
    const { fake, w, rowOf } = await world();
    const vanished = rowOf('unused-exports');
    const doubled = rowOf('complexity');
    await selectRow(w, vanished);
    const a = await createThroughDialog(w);
    await selectRow(w, doubled);
    const b = await createThroughDialog(w);
    fake.userWrite(a, textOf(fake, a).replace(`${EVIDENCE_END}\n`, ''));
    fake.userWrite(b, textOf(fake, b).replace(`${EVIDENCE_BEGIN}\n`, `${EVIDENCE_BEGIN}\n${EVIDENCE_BEGIN}\n`));
    await selectRow(w, vanished);
    await refuseRefresh(w, fake, a);
    await selectRow(w, doubled);
    await refuseRefresh(w, fake, b);
    w.unmount();
  }, SAFETY_TIMEOUT);

  it('IN35: attaching a new report, rescanning and re-selecting write nothing to the vault', async () => {
    const { snapshot, fake, w, rowOf } = await world();
    const row = rowOf('unused-exports');
    await selectRow(w, row);
    const path = await createThroughDialog(w);
    const text = textOf(fake, path);
    const calls = { ...fake.calls };
    await show(snapshot, await reportFor(snapshot, syntheticFallowJson(snapshot), 'again.json'));
    const next = { ...snapshot, snapshotId: 'snapshot-rescanned' };
    await show(next, await reportFor(next, syntheticFallowJson(next), 'rescanned.json'));
    for (const kind of ['complexity', 'unused-exports', 'boundary'] as const) await selectRow(w, rowOf(kind));
    const { getMarkdownFiles: _reads, ...writesAfter } = fake.calls;
    const { getMarkdownFiles: _readsBefore, ...writesBefore } = calls;
    expect(writesAfter).toEqual(writesBefore);
    expect(fake.paths()).toEqual([path]);
    expect(textOf(fake, path)).toBe(text);
    w.unmount();
  }, SAFETY_TIMEOUT);
});
