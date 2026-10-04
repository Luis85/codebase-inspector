// GRC3/GRC4 (GCO12, GCO16): WCAG contrast computed from the tokens themselves, through tests/support/css-tokens.ts
// (the vendored Obsidian app.css 1.12.4 plus styles.css and kit.css). It measures the default theme, both modes.
// Text needs 4.5:1; the focus ring and the hover edge, non-text indicators, need 3:1. A hover FILL cannot reach 3:1
// against the panel while its text keeps 4.5:1 (spec GRC3), so --ci-hover and --ci-raised are not gated as
// indicators: the 1px --ci-hover-edge carries the hover's 3:1.
import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { contrast, type Theme } from '../support/css-tokens';

const THEMES: readonly Theme[] = ['dark', 'light'];
const v = (token: string): string => `var(${token})`;

describe('the resolver reproduces the audit figures (calibration)', () => {
  // The audit's own numbers, dark then light. If the resolver drifts from these, the gate measures something else.
  // The browser-measured 6.11 for the dark fill is 6.12 here: the resolver keeps the mix unrounded.
  const CASES: ReadonlyArray<readonly [string, string, string, number, number]> = [
    ['on-action on --ci-action', '--ci-on-action', '--ci-action', 4.26, 3.43],
    ['--ci-raised vs panel', '--ci-raised', '--ci-panel', 1.03, 1.04],
    ['on-action on --ci-action-fill', '--ci-on-action', '--ci-action-fill', 6.12, 5.04],
  ];
  for (const [name, fg, bg, dark, light] of CASES) {
    it(name, () => {
      expect(Math.abs(contrast('dark', v(fg), v(bg)) - dark)).toBeLessThanOrEqual(0.01);
      expect(Math.abs(contrast('light', v(fg), v(bg)) - light)).toBeLessThanOrEqual(0.01);
    });
  }
});

const SURFACES = ['--ci-surface', '--ci-panel', '--ci-raised', '--ci-hover'] as const;
const TEXT = ['--ci-text', '--ci-text-muted', '--ci-text-faint', '--ci-text-accent'] as const;
const FILLS = ['--ci-action-fill', '--ci-action-fill-hover', '--ci-danger-fill', '--ci-danger-fill-hover'] as const;
const TONE_TEXT = ['--ci-text-danger', '--ci-text-warning', '--ci-text-success', '--ci-text-sample'] as const;
// The city Relations list's direction glyphs key the arcs by hue, inside a hoverable row.
const RELATION_TEXT = ['--ci-text-relation-out', '--ci-text-relation-in'] as const;
// The 16 % danger tint (.ci-severity--critical, .ci-priority) sits on the panel, and on --ci-hover when its row is
// hovered or focused (EvidenceTable rows, button.ci-file-finding__review:hover).
const CRITICAL_TINT = 'color-mix(in srgb, var(--ci-tone-danger) 16%, var(--ci-panel))';
const CRITICAL_TINT_HOVER = 'color-mix(in srgb, var(--ci-tone-danger) 16%, var(--ci-hover))';

interface Pair { fg: string; bg: string; min: number }
const PAIRS: readonly Pair[] = [
  ...TEXT.flatMap((fg) => SURFACES.map((bg) => ({ fg: v(fg), bg: v(bg), min: 4.5 }))),
  ...FILLS.map((bg) => ({ fg: v('--ci-on-action'), bg: v(bg), min: 4.5 })),
  ...TONE_TEXT.flatMap((fg) => SURFACES.map((bg) => ({ fg: v(fg), bg: v(bg), min: 4.5 }))),
  { fg: v('--ci-text-danger'), bg: CRITICAL_TINT, min: 4.5 },
  { fg: v('--ci-text-danger'), bg: CRITICAL_TINT_HOVER, min: 4.5 },
  ...RELATION_TEXT.flatMap((fg) => SURFACES.map((bg) => ({ fg: v(fg), bg: v(bg), min: 4.5 }))),
  ...['--ci-focus', '--ci-hover-edge'].flatMap((fg) => SURFACES.map((bg) => ({ fg: v(fg), bg: v(bg), min: 3 }))),
  // The current nav item's inline-start indicator, on the nav panel and on its own raised fill.
  ...['--ci-panel', '--ci-raised'].map((bg) => ({ fg: v('--ci-text-accent'), bg: v(bg), min: 3 })),
];
/** The ratio, or the resolver's reason when a token is missing. */
function measure(theme: Theme, { fg, bg }: Pair): number | string {
  try { return contrast(theme, fg, bg); } catch (error) { return (error as Error).message; }
}

describe('every gated pair reaches its threshold in both themes (GRC3)', () => {
  for (const theme of THEMES) {
    for (const pair of PAIRS) {
      it(`${theme}: ${pair.fg} on ${pair.bg} >= ${pair.min}`, () => {
        const ratio = measure(theme, pair);
        expect(typeof ratio, String(ratio)).toBe('number');
        expect(ratio as number, `${theme}: ${pair.fg} on ${pair.bg}`).toBeGreaterThanOrEqual(pair.min);
      });
    }
  }
});

const UI = resolve(process.cwd(), 'src', 'ui');
const strip = (css: string): string => css.replace(/\/\*[\s\S]*?\*\//g, '');
const SHEETS: ReadonlyArray<readonly [string, string]> = [
  ['styles.css', strip(readFileSync(join(UI, 'styles.css'), 'utf8'))],
  ...readdirSync(join(UI, 'styles')).filter((n) => n.endsWith('.css'))
    .map((n) => [`styles/${n}`, strip(readFileSync(join(UI, 'styles', n), 'utf8'))] as const),
];
const token = (value: string): string | null => /^var\((--[\w-]+)\)$/.exec(value)?.[1] ?? null;
const innermost = (css: string): Array<{ selectors: string[]; body: string }> =>
  [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => ({ selectors: m[1]!.split(',').map((s) => s.trim().replace(/\s+/g, ' ')), body: m[2]! }));

describe('no colour declaration in src/ui escapes the gate (GRC3 sweep)', () => {
  const direct = new Set<string>([...TEXT, '--ci-on-action', ...TONE_TEXT, ...RELATION_TEXT]);
  // A local custom property (a card's text tone, say) is gated when every value it is ever given is a gated token.
  const given = new Map<string, string[]>();
  for (const [, css] of SHEETS) {
    for (const m of css.matchAll(/(--[\w-]+)\s*:\s*([^;}]+)/g)) given.set(m[1]!, [...(given.get(m[1]!) ?? []), m[2]!.trim()]);
  }
  const gated = (name: string): boolean => direct.has(name) || (given.has(name) && given.get(name)!
    .every((value) => { const t = token(value); return t !== null && direct.has(t); }));

  it('uses only gated text tokens, inherit or currentColor in every color: declaration', () => {
    const offenders: string[] = [];
    let seen = 0;
    for (const [file, css] of SHEETS) {
      for (const m of css.matchAll(/(?<![-\w])color\s*:\s*([^;}]+)/g)) {
        seen += 1;
        const value = m[1]!.trim();
        if (/^(?:inherit|currentColor)$/i.test(value)) continue;
        const name = token(value);
        if (name === null || !gated(name)) offenders.push(`${file}: color: ${value}`);
      }
    }
    expect(seen, 'the sweep reads the colour declarations').toBeGreaterThan(150);
    expect(offenders).toEqual([]);
  });
});

describe('the hover indicator is a 1px inset edge (GRC3)', () => {
  // Every hover that paints --ci-hover, plus the WP-01 file-list row, whose --ci-panel hover is just as faint.
  const hovers = new Set<string>([':where(.codebase-inspector-root) button.ci-file-list__row:hover']);
  for (const [, css] of SHEETS) {
    for (const r of innermost(css)) {
      if (/var\(--ci-hover\)/.test(r.body)) for (const s of r.selectors) if (s.includes(':hover')) hovers.add(s);
    }
  }
  it('gives every such hover selector box-shadow: inset 0 0 0 1px var(--ci-hover-edge) from one kit rule', () => {
    const kit = SHEETS.find(([file]) => file === 'styles/kit.css')![1];
    const edge = innermost(kit).filter((r) => /box-shadow\s*:\s*inset 0 0 0 1px var\(--ci-hover-edge\)/.test(r.body));
    expect(hovers.size, 'the sweep finds the hover selectors').toBeGreaterThanOrEqual(19);
    expect(edge.length, 'one grouped rule').toBe(1);
    expect(Array.from(hovers).filter((s) => !edge[0]!.selectors.includes(s))).toEqual([]);
  });
});

describe('the current nav item carries a non-colour cue (GRC3)', () => {
  // Its accent text is only 1.10/1.15 from the muted neighbours and --ci-raised only 1.03/1.04 from the panel,
  // so the weight and an inline-start bar in --ci-text-accent (a border, not a box-shadow, which the hover edge
  // would replace) mark it.
  it('declares a semibold weight and a --ci-text-accent inline-start border, compensated in the padding', () => {
    const shell = SHEETS.find(([file]) => file === 'styles/shell.css')![1];
    const rule = innermost(shell).filter((r) => r.selectors.includes(':where(.codebase-inspector-root) button.ci-nav__item[aria-current="page"]'));
    const body = rule.map((r) => r.body).join(';');
    expect(body).toMatch(/(?:^|;)\s*font-weight\s*:\s*var\(--font-semibold\)/);
    expect(body).toMatch(/(?:^|;)\s*border-inline-start\s*:\s*(\d+)px solid var\(--ci-text-accent\)/);
    const width = /border-inline-start\s*:\s*(\d+)px/.exec(body)?.[1];
    expect(body).toMatch(new RegExp(String.raw`padding-inline-start\s*:\s*calc\(var\(--ci-space-2\) - ${width ?? 'x'}px\)`));
  });
});

describe('the safety claims render in the normal text token (GRC4, GCO16)', () => {
  it('declares .ci-snapshot-status__claims { color: var(--ci-text) } in styles.css', () => {
    const rule = innermost(SHEETS[0]![1])
      .filter((r) => r.selectors.includes(':where(.codebase-inspector-root) .ci-snapshot-status__claims'));
    expect(rule.map((r) => /(?:^|;)\s*color\s*:\s*([^;]+)/.exec(r.body)?.[1]?.trim())).toEqual(['var(--ci-text)']);
  });
});
