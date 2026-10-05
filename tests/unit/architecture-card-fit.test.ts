// GRC9 (WP-03 Polish E4): the Architecture screen's five cards fit one row at 1280 px. The fit is computed from
// the declared CSS (kit.css and screens-explore.css), not measured in a browser: nav column, content padding,
// card gap and the card minimum are all read from the stylesheets.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = ':where(.codebase-inspector-root)';
const read = (...parts: string[]): string =>
  readFileSync(resolve(process.cwd(), 'src', 'ui', ...parts), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
const BRIDGE = read('styles.css');
const KIT = read('styles', 'kit.css');
const EXPLORE = read('styles', 'screens-explore.css');

/** The last value `css` declares for `property` in a rule whose selector list contains `selector`, or null. */
function declared(css: string, selector: string, property: string): string | null {
  const pattern = new RegExp(`(?:^|;)\\s*${property}\\s*:\\s*([^;]+)`);
  let value: string | null = null;
  for (const m of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    if (!m[1]!.split(',').map((s) => s.trim().replace(/\s+/g, ' ')).includes(selector)) continue;
    const hit = pattern.exec(m[2]!);
    if (hit) value = hit[1]!.trim();
  }
  return value;
}
/** A px length, resolving one `var(--x)` through the root's custom properties. */
function px(text: string): number {
  const v = /^var\((--[\w-]+)\)$/.exec(text.trim());
  if (!v) return parseFloat(text);
  const value = declared(BRIDGE, ROOT, v[1]!) ?? declared(KIT, ROOT, v[1]!);
  if (value === null) throw new Error(`${v[1]} is not declared`);
  return px(value);
}
const minOf = (columns: string | null): number => {
  const m = /minmax\((\d+)px/.exec(columns ?? '');
  if (!m) throw new Error(`no minmax(<n>px, ...) in "${columns ?? 'null'}"`);
  return Number(m[1]);
};

const VIEWPORT = 1280;
const BASE = `${ROOT} .ci-screen__cards`;
const ARCH = `${ROOT} .ci-screen--architecture .ci-screen__cards`;

describe('GRC9: five Architecture cards on one row at 1280 px', () => {
  const nav = px(declared(KIT, ROOT, '--ci-nav-width')!);
  const pad = px(declared(KIT, `${ROOT} .ci-screen`, 'padding')!);
  const gap = px(declared(KIT, BASE, 'gap')!);
  // The Architecture override wins when it declares columns; otherwise the shared rule applies.
  const min = minOf(declared(EXPLORE, ARCH, 'grid-template-columns') ?? declared(KIT, BASE, 'grid-template-columns'));

  it('reads the layout numbers from the stylesheets', () => {
    expect([nav, pad, gap]).toEqual([220, 24, 16]);
  });
  it('fits at least five columns in the content width', () => {
    // 16 px is left for a vertical scrollbar; n cards need n*min + (n-1)*gap, hence the + gap.
    const available = VIEWPORT - nav - 2 * pad - 16 + gap;
    expect(Math.floor(available / (min + gap))).toBeGreaterThanOrEqual(5);
  });
  it('leaves the shared card rule at 200 px for every other screen', () => {
    expect(minOf(declared(KIT, BASE, 'grid-template-columns'))).toBe(200);
  });
});

describe('the module map node keeps the danger edge when it is also selected', () => {
  // Both rules are (0,2,1) and both set a left border colour (--selected through border-color), so the one declared
  // later wins for a node with both classes: the violation rule must come after, or selecting a violating node
  // would repaint its boundary-violation edge in the accent colour.
  const NODE = `${ROOT} button.ci-module-map__node`;
  const at = (modifier: string): number => EXPLORE.indexOf(`${NODE}--${modifier} {`);
  it('declares the --violation rule after the --selected rule', () => {
    expect(at('selected')).toBeGreaterThan(-1);
    expect(at('violation')).toBeGreaterThan(at('selected'));
  });
  it('sets the left border to the danger tone in the --violation rule', () => {
    expect(declared(EXPLORE, `${NODE}--violation`, 'border-left-color')).toBe('var(--ci-tone-danger)');
  });
});
