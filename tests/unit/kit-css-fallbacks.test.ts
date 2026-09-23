import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const read = (name: string): string => readFileSync(resolve(process.cwd(), 'src', 'ui', 'styles', name), 'utf8');

const SCREEN_SHEETS = ['screens.css', 'screens-explore.css', 'screens-audit.css', 'screens-act.css', 'screens-configure.css'] as const;

/** Part 4 X17: the cascade order. styles.css (the WP-01 token bridge) always comes first. */
const CASCADE = ['kit.css', 'shell.css', ...SCREEN_SHEETS] as const;
const CASCADE_PATHS = ['styles.css', ...CASCADE.map((n) => `styles/${n}`)];

// Part 2 §5 (deferred minor): every Obsidian font-size variable the WP-02 stylesheets read
// carries an em fallback, so a theme that drops one never collapses text to the UA default.
describe('WP-02 stylesheets', () => {
  for (const name of ['kit.css', 'shell.css', ...SCREEN_SHEETS]) {
    it(`${name}: every var(--font-ui-*) has a fallback`, () => {
      const css = readFileSync(resolve(process.cwd(), 'src', 'ui', 'styles', name), 'utf8');
      expect(css.match(/var\(--font-ui-[a-z]+\)/g) ?? []).toEqual([]);
    });
  }

  // Final review m8: ONE shared pending/added style for every aria-disabled button, so
  // new press-to-disable controls (e.g. the Finding dialog's) are covered without a rule each.
  it('styles every aria-disabled button with one shared kit rule, none per class', () => {
    expect(read('kit.css')).toContain(':where(.codebase-inspector-root) button[aria-disabled="true"]');
    for (const name of SCREEN_SHEETS) {
      expect(read(name)).not.toMatch(/button\.[\w-]+\[aria-disabled="true"\]/);
    }
  });

  it('no screen stylesheet reaches the 400-line mark (E55)', () => {
    for (const name of SCREEN_SHEETS) {
      expect(read(name).split('\n').length, name).toBeLessThan(400);
    }
  });

  it('the sheet list is the folder on disk, so a new stylesheet fails here until it is wired in (Part 4 X17)', () => {
    const onDisk = readdirSync(resolve(process.cwd(), 'src', 'ui', 'styles')).filter((n) => n.endsWith('.css')).sort();
    expect(onDisk).toEqual([...CASCADE].sort());
  });

  it('main.ts imports styles.css first, then every sheet in cascade order, and nothing else (E55, X17)', () => {
    const main = readFileSync(resolve(process.cwd(), 'src', 'main.ts'), 'utf8');
    const imported = [...main.matchAll(/^import '\.\/ui\/([\w/.-]+\.css)';/gm)].map((m) => m[1]);
    expect(imported).toEqual(CASCADE_PATHS);
  });

  it('the harness serves the same sheets in the same order (X17)', () => {
    const config = readFileSync(resolve(process.cwd(), 'vite.harness.config.ts'), 'utf8');
    const list = /const pluginStylesheets = \[([\s\S]*?)\]/.exec(config);
    expect(list, 'vite.harness.config.ts no longer declares pluginStylesheets').not.toBeNull();
    const served = [...list![1]!.matchAll(/'([\w/.-]+\.css)'/g)].map((m) => m[1]);
    expect(served).toEqual(CASCADE_PATHS);
  });

  // Part 6 Task 10 fix round 2 (E46): in the ~200px fallow card, a max-content label column
  // left every value one character wide. The base list stacks labels over values; only the
  // wide variant (the S14 review step) puts them side by side, with a bounded label column.
  it('the fallow facts list is one column unless wide, and the wide label column is bounded (E46)', () => {
    const css = read('screens-configure.css');
    const base = /\.ci-fallow-facts\s*\{([^}]*)\}/.exec(css)?.[1];
    const wide = /\.ci-fallow-facts--wide\s*\{([^}]*)\}/.exec(css)?.[1];
    expect(base, 'the .ci-fallow-facts rule').toBeDefined();
    expect(base).toMatch(/grid-template-columns:\s*minmax\(0, 1fr\);/);
    expect(base).not.toContain('max-content');
    expect(wide, 'the .ci-fallow-facts--wide rule').toBeDefined();
    expect(wide).toMatch(/grid-template-columns:\s*fit-content\(40%\) minmax\(0, 1fr\);/);
  });
});
