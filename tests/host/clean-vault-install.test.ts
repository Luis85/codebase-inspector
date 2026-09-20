// THE SCRIPTABLE HALF OF THE CLEAN-VAULT INSTALL (task 13, step 2).
//
// Step 2 of task 13 puts the three release files into a BRAND-NEW vault with no other
// plugins and enables them in a real Obsidian. A test cannot do that: there is no
// Obsidian here, no renderer, no human to look at the console. What a test CAN do is
// hold everything the human is asked to rely on to what is actually in the tree, so the
// manual half is about the product rather than about the instructions.
//
// This file therefore guards three things, and claims nothing beyond them:
//
//   1. THE INSTALLED SHAPE. Which files a by-hand install copies, where they go, and
//      that the destination folder name is the manifest id (a mismatch makes
//      onExternalSettingsChange silently never fire). Never against the real `dist/`:
//      tests/host/build-output.test.ts rebuilds it in a parallel worker and
//      vite's emptyOutDir deletes it first — a 1-in-5 flake this repository has already
//      paid for once (see tests/unit/install-script.test.ts's own comment). The names
//      come from scripts/assert-bundle.mjs's own allow-list, so the two cannot drift.
//
//   2. THE DISCLOSURES the definition of done requires (spec §10): the README's
//      out-of-vault / no-network / no-telemetry statements, a recognised LICENSE, and
//      — structurally — that nothing in src/ can reach the network at all.
//
//   3. THE CHECKPOINT #4 CHECKLIST ITSELF. This plan's manual checklists have now FIVE
//      times asked a human to verify something that did not exist: a keybinding
//      Obsidian does not expose, two over-reaches into other tasks, a frame counter
//      unreachable from a console — and, in round 1 of THIS task, an Obsidian command
//      called "Reopen last closed tab" that the host has never had. So every control the
//      implementation report tells the human to press, every key it tells them to type,
//      every command and every settings row it enumerates is checked: the ones this
//      plugin ships against src/, the ones Obsidian provides against the installed
//      host's own obsidian.asar. And the section may not name a control in PROSE at all
//      without that name appearing in one of the lists — which is what round 1 did, with
//      every list correct and the sentence between them wrong.
//
// What this file does NOT establish, stated because the document it guards is a release
// record: that the plugin enables, renders, scans or behaves at all. Every one of those
// is a human's observation at checkpoint #4 and is recorded there as NOT PERFORMED
// until it is made.
import { describe, expect, it } from 'vitest';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join, resolve } from 'node:path';

const root = resolve(process.cwd());
const read = (...parts: string[]): string => readFileSync(join(root, ...parts), 'utf8');

const REPORT = read('docs', 'superpowers', 'notes', '2026-09-17-wp01-implementation-report.md');
const COMMANDS_SOURCE = read('src', 'host', 'commands.ts');
const SETTINGS_SOURCE = read('src', 'host', 'setting-definitions.ts');

interface PackageJson { version: string }
interface ManifestJson { id: string; name: string; version: string; minAppVersion: string }

const manifest = JSON.parse(read('manifest.json')) as ManifestJson;
const pkg = JSON.parse(read('package.json')) as PackageJson;
const versions = JSON.parse(read('versions.json')) as Record<string, string>;

/** Every `.ts`/`.vue` file under `src/`, concatenated. The corpus both src-wide sweeps
 *  below read; its size is asserted in each of them, because an absence check over an
 *  empty corpus passes without doing anything. */
function sourceFiles(dir = join(root, 'src'), found: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) sourceFiles(full, found);
    else if (/\.(ts|vue)$/.test(entry.name) && !entry.name.endsWith('.d.ts')) found.push(full);
  }
  return found;
}

const SRC_FILES = sourceFiles();
const SRC_TEXT = SRC_FILES.map((f) => readFileSync(f, 'utf8')).join('\n');

/** The three installable file names, taken from the build guard's own allow-list rather
 *  than retyped here — if the release ever ships a fourth file, the checklist that tells
 *  a human to copy three must fail with it. */
function installableFiles(): string[] {
  const script = read('scripts', 'assert-bundle.mjs');
  const match = /files\.join\(','\) !== '([^']+)'/.exec(script);
  expect(match, 'assert-bundle.mjs no longer states the exact dist/ file list').not.toBeNull();
  return match![1]!.split(',');
}

/** A `- \`literal\` — …` line list between two markers in the implementation report. */
function reportList(marker: string): string[] {
  const start = REPORT.indexOf(`<!-- ${marker}:start -->`);
  const end = REPORT.indexOf(`<!-- ${marker}:end -->`);
  expect(start, `the implementation report has no ${marker} block`).toBeGreaterThan(-1);
  expect(end).toBeGreaterThan(start);
  return REPORT.slice(start, end).split('\n')
    .map((line) => /^- `([^`]+)`/.exec(line.trim()))
    .filter((m): m is RegExpExecArray => m !== null)
    .map((m) => m[1]!);
}

/** The G8 layer table, delimited by the same markers in whichever document carries it. */
function g8Slice(source: string, label: string): string {
  const start = source.indexOf('<!-- g8:table:start -->');
  const end = source.indexOf('<!-- g8:table:end -->');
  expect(start, `${label} has no G8 table`).toBeGreaterThan(-1);
  expect(end).toBeGreaterThan(start);
  return source.slice(start, end).replace(/\r\n/g, '\n').trim();
}

/** Does `literal` actually ship as user-visible text? Either as a quoted string, or as
 *  the start of a template text node on its own line (`List view` between a `>` and a
 *  `</button>` is neither quoted nor alone on a line with its punctuation). Deliberately
 *  narrower than "appears anywhere in src/": half these literals are ordinary English
 *  words, and a substring search over 77 files would pass for a control that does not
 *  exist — which is the exact failure this test is here to prevent. */
function shipsAsVisibleText(literal: string): boolean {
  const escaped = literal.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  if (new RegExp(`(['"\`])${escaped}\\1`).test(SRC_TEXT)) return true;
  return SRC_TEXT.split('\n').some((line) => line.trim().startsWith(literal));
}

describe('the release artefact installs by hand into a clean vault', () => {
  it('copies exactly the three files the build guard allows, and nothing else', () => {
    const files = installableFiles();
    expect(files).toEqual(['main.js', 'manifest.json', 'styles.css']);

    // A stand-in dist, never the real one: this test is about the SHAPE of a by-hand
    // install, which needs no relationship to the current bundle's bytes.
    const distSource = mkdtempSync(join(tmpdir(), 'ci-clean-dist-'));
    for (const file of files) writeFileSync(join(distSource, file), `stand-in ${file}`);
    copyFileSync(join(root, 'manifest.json'), join(distSource, 'manifest.json'));

    const vault = mkdtempSync(join(tmpdir(), 'ci-clean-vault-'));
    const plugins = join(vault, '.obsidian', 'plugins');
    mkdirSync(plugins, { recursive: true });
    // The folder name IS the manifest id. Anything else and onExternalSettingsChange
    // never fires — install-to-vault.mjs refuses to run for the same reason.
    const dest = join(plugins, manifest.id);
    mkdirSync(dest);
    for (const file of files) copyFileSync(join(distSource, file), join(dest, file));

    expect(basename(dest)).toBe(manifest.id);
    expect(readdirSync(dest).sort()).toEqual([...files].sort());
    // Nothing a source checkout or a package install would leave behind is needed.
    for (const unwanted of ['package.json', 'node_modules', '.git', '.hotreload']) {
      expect(readdirSync(dest)).not.toContain(unwanted);
    }
  });

  it('is NOT `npm run install:vault`, which writes a dev-only hot-reload marker', () => {
    // The checkpoint's whole point is a vault with no dev anything in it. The dev
    // installer is the obvious shortcut and it leaves a fourth file behind, so the
    // instructions must not reach for it. Positive control first, or the prohibition
    // below would be satisfied by the marker having been removed from the script.
    expect(read('scripts', 'install-to-vault.mjs'),
      'install-to-vault.mjs no longer writes .hotreload — re-check whether it is now the '
      + 'right route for a clean vault, rather than deleting this test').toContain('.hotreload');
    expect(REPORT, 'the clean-vault instructions reach for the dev installer')
      .not.toContain('install:vault');
  });

  it('agrees with package.json and versions.json on the version it ships', () => {
    expect(manifest.version).toBe(pkg.version);
    expect(Object.keys(versions)).toEqual([manifest.version]);
    expect(versions[manifest.version]).toBe(manifest.minAppVersion);
  });

  it('declares the id and the name a clean vault has to show', () => {
    expect(manifest.id).toBe('codebase-inspector');
    expect(manifest.name).toBe('Codebase Inspector');
    // Both are quoted verbatim in the G1 section the human fills in.
    expect(REPORT).toContain(manifest.id);
    expect(REPORT).toContain(manifest.name);
  });
});

describe('the disclosures spec §10 requires are actually there', () => {
  it('discloses out-of-vault reads, no network use and no telemetry in the README', () => {
    const readme = read('README.md');
    expect(readme, 'no out-of-vault disclosure').toMatch(/outside your vault/i);
    expect(readme, 'no network disclosure').toMatch(/no network requests/i);
    expect(readme, 'no telemetry disclosure').toMatch(/no telemetry/i);
  });

  it('ships a recognised LICENSE', () => {
    const license = read('LICENSE');
    expect(license).toMatch(/^MIT License/);
    expect(license).toContain('Permission is hereby granted, free of charge');
  });

  it('reaches no network API anywhere in src/, which is what earns the claim', () => {
    // `fetch` the WORD appears once in src/, inside the phrase "no data refetch" in a
    // comment, so the sweep is for call and constructor shapes, not for the bare word.
    // A URL literal is NOT swept: a documentation link in a comment is legitimate and a
    // sweep that reddens on one gets deleted. The APIs are what a request needs.
    for (const api of ['fetch(', 'XMLHttpRequest', 'WebSocket', 'EventSource',
                       'sendBeacon', 'requestUrl']) {
      const hits = SRC_FILES.filter((f) => readFileSync(f, 'utf8').includes(api));
      expect(hits, `src/ reaches ${api}`).toEqual([]);
    }
    // The corpus is real: an absence check over nothing proves nothing. The floor is a
    // floor, not an equality, so adding a file does not redden an unrelated test.
    expect(SRC_FILES.length).toBeGreaterThanOrEqual(70);
    expect(SRC_TEXT).toContain('createCityRenderer');
  });
});

describe('the checkpoint #4 checklist names only things that exist', () => {
  it('names controls that ship as visible text', () => {
    const controls = reportList('checkpoint4:controls');
    expect(controls.length, 'the control list is empty or unparsed').toBeGreaterThanOrEqual(10);
    for (const control of controls) {
      expect(shipsAsVisibleText(control), `the checklist names a control src/ does not ship: "${control}"`)
        .toBe(true);
    }
  });

  it('names only keys this plugin itself handles', () => {
    // Tab and Shift-Tab are the browser's own focus order and appear in no source file;
    // they are named in the report's prose, deliberately outside this block, so that
    // this assertion stays exactly as strong as it reads.
    const keys = reportList('checkpoint4:keys');
    expect(keys.length, 'the key list is empty or unparsed').toBeGreaterThanOrEqual(5);
    const handlers = ['src/ui/interaction/keymap.ts', 'src/ui/components/FileSearch.vue',
                      'src/ui/components/CodebaseFileList.vue', 'src/ui/App.vue']
      .map((p) => read(...p.split('/'))).join('\n');
    for (const key of keys) {
      expect(handlers.includes(`'${key}'`),
        `the checklist tells the human to press ${key}, which no handler in src/ reads`).toBe(true);
    }
  });

  it('enumerates exactly the commands commands.ts registers', () => {
    const registered = [...COMMANDS_SOURCE.matchAll(/\bid: '([a-z-]+)'/g)].map((m) => m[1]!);
    expect(registered.length, 'no commands parsed from commands.ts').toBeGreaterThan(0);
    expect(reportList('checkpoint4:commands').sort()).toEqual([...registered].sort());
  });

  it('enumerates exactly the settings rows setting-definitions.ts builds', () => {
    const built = new Set([...SETTINGS_SOURCE.matchAll(/\b(?:name|heading): '([^']+)'/g)].map((m) => m[1]!));
    expect(built.size, 'no settings rows parsed from setting-definitions.ts').toBeGreaterThan(3);
    expect(reportList('checkpoint4:settings').sort()).toEqual([...built].sort());
  });

  it('copies the G8 table without letting the copy drift from the original', () => {
    // The report reproduces "which test layers actually ran" rather than sending a
    // reader elsewhere for it. A second copy of a transcribed table is exactly how this
    // branch's counts went stale three times, so the copy is pinned to the original
    // instead of being trusted — the markers are the same in both files.
    const evidence = read('docs', 'superpowers', 'notes', '2026-09-17-wp01-gate-evidence.md');
    expect(g8Slice(REPORT, 'the implementation report'))
      .toBe(g8Slice(evidence, 'the gate-evidence document'));
  });

  // ---------------------------------------------------------------------------------
  // FIX ROUND 1, Important 1. The guard above reads the marker blocks and nothing else,
  // so a control named in PROSE was checked by nobody — and that is exactly where the
  // fifth instance of this branch's oldest defect shipped: step 9 told the human to use
  // "Reopen last closed tab", an Obsidian command that does not exist (the real one is
  // `workspace:undo-close-pane`, labelled "Undo close tab"). The marker blocks were all
  // correct; the sentence between them was not.
  //
  // So the convention is now structural rather than careful: INSIDE THE CHECKPOINT #4
  // SECTION, A CONTROL IS WRITTEN IN SINGLE-ASTERISK EMPHASIS, AND EVERY SUCH PHRASE
  // MUST APPEAR IN ONE OF THE FOUR BLOCKS. Ordinary emphasis in that section is written
  // with double asterisks instead, so the two cannot be confused by a reader or by this
  // test. The one derived exception is the plugin's own name, which lives in
  // manifest.json rather than in any list.
  //
  // WHAT THIS STILL DOES NOT CATCH, named rather than left to be discovered: a control
  // named in that section with NO emphasis at all. The convention is the whole of the
  // mitigation for that, exactly as the evidence documents' own count convention is.
  it('lets no control be named in the checkpoint section outside the lists', () => {
    const start = REPORT.indexOf('## CHECKPOINT #4');
    expect(start, 'the checkpoint #4 section is gone').toBeGreaterThan(-1);
    const section = REPORT.slice(start, REPORT.indexOf('\n## ', start + 5));
    const listed = new Set([
      ...reportList('checkpoint4:controls'), ...reportList('checkpoint4:keys'),
      ...reportList('checkpoint4:commands'), ...reportList('checkpoint4:settings'),
      ...reportList('checkpoint4:host-controls'), manifest.name,
    ]);
    // ACROSS LINE BREAKS, and that is the whole point of this line. Fix round 1 wrote
    // `[^*\n]+`, which forbids a newline — so a control name that happened to wrap at
    // the right margin escaped the guard completely, and TWO of this document's own
    // names already wrapped that way. A guard whose stated scope is wider than its real
    // scope is the same overclaim this task exists to avoid, one level in.
    // A blank line ends emphasis in markdown, so a match spanning one is a stray pair of
    // asterisks rather than a name, and is dropped. Whitespace is then flattened, so a
    // wrapped name compares equal to the single-line entry in its list.
    const emphasised = [...section.matchAll(/(?<!\*)\*([^*]+)\*(?!\*)/g)]
      .map((m) => m[1]!)
      .filter((phrase) => !/\n\s*\n/.test(phrase))
      .map((phrase) => phrase.replace(/\s+/g, ' ').trim());
    // The sweep must have found the real ones, or a convention nobody follows passes.
    expect(emphasised.length, 'no emphasised control names at all — is the convention still used?')
      .toBeGreaterThanOrEqual(5);
    for (const phrase of emphasised) {
      expect(listed.has(phrase),
        `the checkpoint section names "${phrase}" in prose, and no checkpoint4 list carries it`)
        .toBe(true);
    }
  });

  it('names only host controls the installed Obsidian actually has', () => {
    // These are Obsidian's, not ours: nothing in src/ can confirm them, and the
    // marker-block guards above would pass them vacuously. They are checked against the
    // host's own bundle, byte-exactly. The document records which version that was.
    const hostControls = reportList('checkpoint4:host-controls');
    expect(hostControls.length, 'the host-control list is empty or unparsed').toBeGreaterThanOrEqual(2);
    const local = process.env.LOCALAPPDATA;
    const asarPath = process.env.CODEBASE_INSPECTOR_OBSIDIAN_ASAR
      ?? (local ? join(local, 'Programs', 'Obsidian', 'resources', 'obsidian.asar') : '');
    if (!asarPath || !existsSync(asarPath)) {
      // No host to check against. NOT a pass for the claim: the document must still say
      // which host the names were verified on, so a reader is never left to assume.
      expect(REPORT, 'no Obsidian to check against, and the report does not say where '
        + 'these names were verified either').toMatch(/verified against Obsidian \*\*\d+\.\d+\.\d+\*\*/);
      return;
    }
    const asar = readFileSync(asarPath);
    for (const control of hostControls) {
      expect(asar.includes(control), `Obsidian has no "${control}"`).toBe(true);
    }
    // The negative control, and the actual defect this test was written for: the name
    // that shipped in round 1 is NOT in the host, so the scan above is discriminating
    // rather than matching everything.
    expect(asar.includes('Reopen last closed tab'),
      'the asar scan matches a name Obsidian does not have — it is not discriminating').toBe(false);
  });

  it('records G4 and G7 as OPEN, never as gates this release passed', () => {
    // The release gate reads the accessibility matrix; the one thing it must not do is
    // read an unperformed row as a passing one. The counts themselves are swept by
    // tests/unit/evidence-numbers.test.ts, which now reads this document too.
    for (const gate of ['G4', 'G7']) {
      const line = REPORT.split('\n').find((l) => l.includes(`**${gate}**`));
      expect(line, `the report says nothing about ${gate}`).toBeDefined();
      expect(line, `${gate} is not recorded as open`).toMatch(/OPEN/);
    }
    expect(REPORT).toContain('NOT PERFORMED');
  });
});
