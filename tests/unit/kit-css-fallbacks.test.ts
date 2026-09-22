import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const read = (name: string): string => readFileSync(resolve(process.cwd(), 'src', 'ui', 'styles', name), 'utf8');

const SCREEN_SHEETS = ['screens.css', 'screens-explore.css', 'screens-audit.css', 'screens-act.css', 'screens-configure.css'] as const;

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

  it('main.ts imports every stylesheet in cascade order (E55)', () => {
    const main = readFileSync(resolve(process.cwd(), 'src', 'main.ts'), 'utf8');
    const order = ['kit.css', 'shell.css', ...SCREEN_SHEETS].map((n) => main.indexOf(`./ui/styles/${n}'`));
    expect(order).toHaveLength(7);
    expect(order.every((i) => i >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });
});
