// E55 / Part 5 V21: a screen never borrows another screen's block class; shared looks live
// in kit.css. Every ci-<block> root named by a screen file must belong to one screen, be a
// kit class, or be one of the WP-01 component blocks CityWorkspace composes.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const UI = resolve(process.cwd(), 'src', 'ui');
const SCREENS = join(UI, 'screens');
const STYLES = join(UI, 'styles');
function vueFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? vueFiles(p) : p.endsWith('.vue') ? [p] : [];
  });
}
interface SourceFile { path: string; text: string }
const load = (base: string): SourceFile[] =>
  vueFiles(base).map((p) => ({ path: relative(base, p).replace(/\\/g, '/'), text: readFileSync(p, 'utf8') }));
const FILES = load(UI);
const SCREEN_FILES = load(SCREENS);
const stripCssComments = (css: string): string => css.replace(/\/\*[\s\S]*?\*\//g, '');
const KIT = stripCssComments(readFileSync(join(STYLES, 'kit.css'), 'utf8'));

/** WP-01 component blocks CityWorkspace composes (styled in styles.css, never edited). */
const WP01_BLOCKS: readonly string[] = ['ci-app', 'ci-viewport', 'ci-file-list', 'ci-search', 'ci-shell', 'ci-welcome', 'ci-selection-notice'];
/** A directory or file stem whose screen key differs from its name. */
const OWNER_ALIAS: Readonly<Record<string, string>> = { file: 'filedetail', 'test-confidence': 'tests', cityworkspace: 'city' };

/** Path relative to src/ui/screens → the screen that owns it. */
function ownerOf(path: string): string {
  const parts = path.split('/');
  const head = parts[0] ?? '';
  const key = parts.length > 1 ? head : head.replace(/\.vue$/, '').replace(/Screen$/, '').toLowerCase();
  return OWNER_ALIAS[key] ?? key;
}

/** Every ci-<block> root a file names in class attributes, :class bindings and selector
 *  strings: comments are dropped, useUniqueId('…') ids are skipped, and a root ends where
 *  `__` or `--` begins. */
function blockRoots(text: string): Set<string> {
  const code = text
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|\s)\/\/[^\n]*/g, '$1')
    .replace(/useUniqueId\(\s*(['"`])[^'"`]*\1\s*\)/g, 'useUniqueId()');
  return new Set([...code.matchAll(/(?<![\w-])ci-[a-z0-9]+(?:-[a-z0-9]+)*/g)].map((m) => m[0]));
}

/** root → its owners, for every root named by more than one owner. */
function sharedRoots(files: readonly SourceFile[]): Map<string, string[]> {
  const owners = new Map<string, Set<string>>();
  for (const f of files) {
    for (const root of blockRoots(f.text)) {
      const set = owners.get(root) ?? new Set<string>();
      set.add(ownerOf(f.path));
      owners.set(root, set);
    }
  }
  return new Map([...owners].filter(([, set]) => set.size > 1).map(([root, set]) => [root, [...set].sort()]));
}
const definedInKit = (root: string): boolean =>
  new RegExp(`:where\\(\\.codebase-inspector-root\\)[^{}]*\\.${root}(?![\\w-])`).test(KIT);

const RETIRED = [
  'ci-hotspots__note', 'ci-hotspots__selected', 'ci-overview__cards', 'ci-overview__grid', 'ci-overview__empty', 'ci-findings-table__empty',
  'ci-finding__', 'ci-scatter__legend', 'ci-scatter__key', 'ci-severity--medium', 'ci-severity--low',
];
const RETIRED_SELECTORS = ['.ci-finding__', '.ci-finding {', '.ci-scatter__legend', '.ci-scatter__key', '.ci-severity--medium', '.ci-severity--low'];

const SNIPPET = [
  '<!-- ci-commented__out -->',
  '<figcaption class="ci-scatter__legend">',
  '  <span :class="\'ci-scatter__key--\' + band" />',
  '</figcaption>',
  '<script setup lang="ts">',
  'const id = useUniqueId(\'ci-hotspots-filter\');',
  '// ci-in-a-comment',
  'const row = root.querySelector<HTMLElement>(\'.ci-table__row\');',
  '</script>',
].join('\n');

describe('CSS class scope (E55, Part 5 V21)', () => {
  it('finds the Vue files', () => {
    expect(FILES.length).toBeGreaterThan(50);
    expect(SCREEN_FILES.length).toBeGreaterThan(40);
  });

  it('the extractor finds a borrowed block in a synthetic snippet, and skips comments and useUniqueId ids', () => {
    expect([...blockRoots(SNIPPET)].sort()).toEqual(['ci-scatter', 'ci-table']);
    const borrowed = sharedRoots([
      { path: 'test-confidence/Legend.vue', text: SNIPPET },
      { path: 'HotspotsScreen.vue', text: '<div class="ci-screen ci-scatter"></div>' },
    ]);
    expect(borrowed).toEqual(new Map([['ci-scatter', ['hotspots', 'tests']]]));
  });

  it('maps every file to its screen', () => {
    expect(ownerOf('file/FileHeader.vue')).toBe(ownerOf('FileDetailScreen.vue'));
    expect(ownerOf('test-confidence/CoverageMap.vue')).toBe(ownerOf('TestsScreen.vue'));
    expect(ownerOf('CityWorkspace.vue')).toBe(ownerOf('city/CitySummaryCards.vue'));
    expect(ownerOf('CityScreen.vue')).toBe('city');
    expect(ownerOf('shared/EvidenceSourceDialog.vue')).toBe('shared');
    expect(ownerOf('NoSnapshot.vue')).toBe('nosnapshot');
  });

  it('every ci-<block> root is used by one screen, or is a kit or WP-01 component block', () => {
    const shared = sharedRoots(SCREEN_FILES);
    expect(shared.size).toBeGreaterThan(0);   // E27: the kit classes are shared, so the scan found something
    const offenders = [...shared]
      .filter(([root]) => !definedInKit(root) && !WP01_BLOCKS.includes(root))
      .map(([root, owners]) => `${root} (${owners.join(', ')})`);
    expect(offenders).toEqual([]);
  });

  it('uses no retired shared-by-accident class anywhere', () => {
    for (const f of FILES) for (const cls of RETIRED) expect(f.text.includes(cls), `${f.path} uses ${cls}`).toBe(false);
  });

  it('no stylesheet still styles a retired Part 5 name (V20)', () => {
    const sheets = readdirSync(STYLES).filter((n) => n.endsWith('.css'));
    expect(sheets.length).toBeGreaterThan(0);
    for (const name of sheets) {
      const css = stripCssComments(readFileSync(join(STYLES, name), 'utf8'));
      for (const sel of RETIRED_SELECTORS) expect(css.includes(sel), `${name} styles ${sel}`).toBe(false);
    }
  });

  it('kit.css defines the shared classes', () => {
    for (const cls of [
      '.ci-note', '.ci-empty', '.ci-empty__title', '.ci-selected-strip', '.ci-screen__cards', '.ci-screen__grid', '.ci-chip ', '.ci-chip--sample',
      '.ci-screen ', '.ci-severity ', '.ci-severity--critical', '.ci-severity--high', '.ci-severity--moderate', '.ci-severity--unrated', '.ci-ref-id',
      '.ci-band-legend ', '.ci-band-legend__key::before', '.ci-band-legend__key--low', '.ci-band-legend__key--mid', '.ci-band-legend__key--high',
      '.ci-file-cell ', '.ci-file-cell__name', '.ci-file-cell__path', '.ci-priority ',
    ]) {
      expect(KIT.includes(`:where(.codebase-inspector-root) ${cls}`), cls).toBe(true);
    }
  });
});
