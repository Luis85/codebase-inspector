// Part 5 V17, contrast decision #4 (option B): plugin-owned DERIVED fills and a hover
// surface in kit.css. kit.css loads after styles.css and both scope with the zero-
// specificity :where(root), so a same-selector rule here wins on order without editing
// styles.css. Static checks only; the real colours are measured in the harness.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const UI = resolve(process.cwd(), 'src', 'ui');
const ROOT = ':where(.codebase-inspector-root)';
const read = (path: string): string => readFileSync(path, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
const KIT = read(join(UI, 'styles', 'kit.css'));
const BRIDGE = read(join(UI, 'styles.css'));
const SHEETS = readdirSync(join(UI, 'styles')).filter((n) => n.endsWith('.css'));

interface Rule { selectors: string[]; body: string }
/** Innermost `selectors { body }` pairs. An at-rule's prelude never matches, because its
 *  block contains braces; the rules inside it do. */
function rules(css: string): Rule[] {
  return [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => ({
    selectors: m[1]!.split(',').map((s) => s.trim().replace(/\s+/g, ' ')),
    body: m[2]!,
  }));
}
/** The last value `css` declares for `property` under exactly `selector`, or null. */
function declared(css: string, selector: string, property: string): string | null {
  const pattern = new RegExp(`(?:^|;)\\s*${property}\\s*:\\s*([^;]+)`);
  let value: string | null = null;
  for (const r of rules(css)) {
    if (!r.selectors.includes(selector)) continue;
    const m = pattern.exec(r.body);
    if (m) value = m[1]!.trim();
  }
  return value;
}
function vueFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? vueFiles(p) : p.endsWith('.vue') ? [p] : [];
  });
}
const FILL: Readonly<Record<string, readonly [string, string]>> = {
  'mod-cta': ['var(--ci-action-fill)', 'var(--ci-action-fill-hover)'],
  'mod-warning': ['var(--ci-danger-fill)', 'var(--ci-danger-fill-hover)'],
};
// oxlint(consistent-function-scoping): captures nothing from any call site, so it is
// hoisted to module scope rather than declared inside the `it` below (brief text unchanged
// otherwise; implementer-rules.md HARD CONSTRAINTS, oxlint --deny-warnings).
const mix = (host: string, pct: number) => `color-mix(in srgb, var(${host}) ${pct}%, var(--text-on-accent-inverted, black))`;

describe('contrast decision #4, option B (Part 5 V17)', () => {
  it('derives the fills and the hover surface on the root from host variables, redefining none', () => {
    expect(declared(KIT, ROOT, '--ci-action-fill')).toBe(mix('--interactive-accent', 80));
    expect(declared(KIT, ROOT, '--ci-action-fill-hover')).toBe(mix('--interactive-accent', 72));
    expect(declared(KIT, ROOT, '--ci-danger-fill')).toBe(mix('--background-modifier-error', 80));
    expect(declared(KIT, ROOT, '--ci-danger-fill-hover')).toBe(mix('--background-modifier-error', 72));
    expect(declared(KIT, ROOT, '--ci-hover')).toBe('color-mix(in srgb, var(--ci-text) 10%, var(--ci-panel))');
    expect(KIT).not.toMatch(/(?:^|[\s;{])--(?:background|text|interactive)-[\w-]+\s*:/);
  });

  it('puts every mod-cta and mod-warning in the view on a <button>, which the kit fill reaches', () => {
    const uses: string[] = [];
    for (const file of vueFiles(UI)) {
      const text = readFileSync(file, 'utf8');
      for (const m of text.matchAll(/\bclass="([^"]*)"/g)) {
        const classes = m[1]!.split(/\s+/);
        for (const mod of Object.keys(FILL)) {
          if (!classes.includes(mod)) continue;
          const tag = /^<([\w-]+)/.exec(text.slice(text.lastIndexOf('<', m.index)))?.[1];
          uses.push(`${relative(UI, file)} ${mod}`);
          expect(tag, `${relative(UI, file)} puts ${mod} on <${tag ?? '?'}>`).toBe('button');
        }
      }
    }
    expect(uses.length, 'the sweep found the known mod-cta/mod-warning buttons').toBeGreaterThanOrEqual(16);
  });

  it('fills mod-cta and mod-warning from the kit, at rest and on hover', () => {
    for (const [mod, [rest, hover]] of Object.entries(FILL)) {
      expect(declared(KIT, `${ROOT} button.${mod}`, 'background-color'), mod).toBe(rest);
      expect(declared(KIT, `${ROOT} button.${mod}:hover`, 'background-color'), `${mod}:hover`).toBe(hover);
    }
  });

  it('repaints every WP-01 control that paints --ci-action behind --ci-on-action, from the kit', () => {
    const accent = rules(BRIDGE).filter((r) => /background:\s*var\(--ci-action(?:-hover)?\)/.test(r.body));
    expect(accent.length).toBeGreaterThan(0);
    for (const r of accent) {
      const want = /var\(--ci-action-hover\)/.test(r.body) ? 'var(--ci-action-fill-hover)' : 'var(--ci-action-fill)';
      for (const s of r.selectors) expect(declared(KIT, s, 'background'), s).toBe(want);
    }
  });

  it('gives every WP-01 hover that painted --ci-raised the perceptible --ci-hover instead', () => {
    const raised = rules(BRIDGE).filter((r) => /background:\s*var\(--ci-raised\)/.test(r.body));
    expect(raised.length).toBeGreaterThan(0);
    for (const r of raised) for (const s of r.selectors) expect(declared(KIT, s, 'background'), s).toBe('var(--ci-hover)');
  });

  it('paints no hover in the WP-02 sheets with --ci-raised', () => {
    const offenders = SHEETS.flatMap((name) => rules(read(join(UI, 'styles', name)))
      .filter((r) => r.selectors.some((s) => s.includes(':hover')) && /var\(--ci-raised\)/.test(r.body))
      .map((r) => `${name}: ${r.selectors.join(', ')}`));
    expect(offenders).toEqual([]);
  });
});
