/** GRC3: resolves the plugin's colour tokens to sRGB from the vendored host stylesheet (Obsidian app.css 1.12.4,
 *  tests/harness/obsidian.css) plus the plugin's two token blocks, so a test can compute WCAG contrast from the
 *  tokens themselves. It measures the default theme only, never a user's community theme.
 *
 *  Cascade: the host `body { }` block, then `.theme-light, .theme-dark { }`, then the theme's own block (one
 *  element, higher specificity), then every top-level `:where(.codebase-inspector-root) { }` rule in styles.css
 *  and then kit.css (load order). Rules inside an at-rule are skipped.
 *  Values: `var(--x, fallback)`, `#rgb`/`#rrggbb`, `white`/`black`, `rgb()`, `hsl()` with `calc()` arguments, and
 *  `color-mix(in srgb, A p%, B)` (a component-wise lerp of the gamma-encoded channels). */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export type Theme = 'light' | 'dark';
interface Rgb { r: number; g: number; b: number }

const ROOT = ':where(.codebase-inspector-root)';
const read = (...parts: string[]): string =>
  readFileSync(resolve(process.cwd(), ...parts), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

/** The custom properties declared in one block body. */
function properties(body: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of body.matchAll(/(--[\w-]+)\s*:\s*([^;]+);?/g)) out[m[1]!] = m[2]!.trim();
  return out;
}
/** The bodies of the top-level rules whose prelude is exactly `selector` (at-rule blocks skipped). */
function topLevel(css: string, selector: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let start = 0;
  let prelude = '';
  for (let i = 0; i < css.length; i += 1) {
    const c = css[i];
    if (c === '{') {
      if (depth === 0) { prelude = css.slice(start, i).trim().replace(/\s+/g, ' '); start = i + 1; }
      depth += 1;
    } else if (c === '}') {
      depth -= 1;
      if (depth === 0) {
        if (prelude === selector) out.push(css.slice(start, i));
        start = i + 1;
      }
    } else if (c === ';' && depth === 0) start = i + 1;
  }
  return out;
}

const cache = new Map<Theme, Record<string, string>>();
/** Every custom property in scope at the plugin root, for `theme`. */
function tokens(theme: Theme): Record<string, string> {
  const hit = cache.get(theme);
  if (hit) return hit;
  const host = read('tests', 'harness', 'obsidian.css');
  const sheets = [read('src', 'ui', 'styles.css'), read('src', 'ui', 'styles', 'kit.css')];
  const first = (selector: string): string => {
    const body = topLevel(host, selector)[0];
    if (body === undefined) throw new Error(`host block "${selector}" not found`);
    return body;
  };
  const blocks = [
    first('body'), first('.theme-light, .theme-dark'), first(`.theme-${theme}`),
    ...sheets.flatMap((css) => topLevel(css, ROOT)),
  ];
  const merged = Object.assign({}, ...blocks.map(properties)) as Record<string, string>;
  cache.set(theme, merged);
  return merged;
}

/** Index of the parenthesis closing the one opened just before `from`. */
function closing(text: string, from: number): number {
  let depth = 1;
  for (let i = from; i < text.length; i += 1) {
    if (text[i] === '(') depth += 1;
    else if (text[i] === ')' && (depth -= 1) === 0) return i;
  }
  throw new Error(`unbalanced parentheses in "${text}"`);
}
/** `text` split on its top-level commas. */
function args(text: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < text.length; i += 1) {
    if (text[i] === '(') depth += 1;
    else if (text[i] === ')') depth -= 1;
    else if (text[i] === ',' && depth === 0) { out.push(text.slice(start, i).trim()); start = i + 1; }
  }
  out.push(text.slice(start).trim());
  return out;
}
/** `text` with every `var()` substituted, recursively, from `vars`. */
function substitute(text: string, vars: Record<string, string>, depth = 0): string {
  if (depth > 32) throw new Error(`var() cycle in "${text}"`);
  const at = text.indexOf('var(');
  if (at < 0) return text;
  const end = closing(text, at + 4);
  const [name, ...fallback] = args(text.slice(at + 4, end));
  const value = vars[name!] ?? (fallback.length > 0 ? fallback.join(', ') : undefined);
  if (value === undefined) throw new Error(`${name} is undefined and has no fallback`);
  return substitute(text.slice(0, at) + substitute(value, vars, depth + 1) + text.slice(end + 1), vars, depth + 1);
}

/** A `calc()`-free number: `calc(a op b)` with + - * /, or a bare number; `%` is dropped. */
function numeric(text: string): number {
  const t = text.trim();
  const calc = /^calc\((.*)\)$/.exec(t);
  if (!calc) return parseFloat(t);
  const inner = calc[1]!.trim();
  // One binary operation only: precedence, grouping and nested calc() are not implemented, so refuse them.
  if (/[()]/.test(inner)) throw new Error(`calc() with brackets is not supported: "${t}"`);
  const operators = (inner.match(/\s[-+]\s|[*/]/g) ?? []).length;
  if (operators > 1) throw new Error(`calc() with more than one operator is not supported: "${t}"`);
  const m = /^(.+?)\s+([-+*/])\s+(.+)$/.exec(inner);
  if (!m && operators > 0) throw new Error(`calc() operator needs spaces around it: "${t}"`);
  if (!m) return numeric(inner);
  const [a, b] = [numeric(m[1]!), numeric(m[3]!)];
  return m[2] === '+' ? a + b : m[2] === '-' ? a - b : m[2] === '*' ? a * b : a / b;
}
const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));
function hsl(h: number, s: number, l: number): Rgb {
  const [hue, sat, lig] = [((h % 360) + 360) % 360, clamp(s, 0, 100) / 100, clamp(l, 0, 100) / 100];
  const f = (n: number): number => {
    const k = (n + hue / 30) % 12;
    return 255 * (lig - sat * Math.min(lig, 1 - lig) * Math.max(-1, Math.min(k - 3, 9 - k, 1)));
  };
  return { r: f(0), g: f(8), b: f(4) };
}
/** One colour stop of a color-mix: the colour and its percentage, if given. */
function stop(text: string): { color: Rgb; pct: number | null } {
  const m = /^(.*?)\s+(\d+(?:\.\d+)?)%$/.exec(text.trim());
  return m ? { color: parse(m[1]!), pct: parseFloat(m[2]!) } : { color: parse(text), pct: null };
}
function parse(text: string): Rgb {
  const t = text.trim();
  if (t === 'white') return { r: 255, g: 255, b: 255 };
  if (t === 'black') return { r: 0, g: 0, b: 0 };
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(t);
  if (hex) {
    const h = hex[1]!.length === 3 ? hex[1]!.replace(/./g, '$&$&') : hex[1]!;
    return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16) };
  }
  const fn = /^([\w-]+)\((.*)\)$/.exec(t);
  if (!fn) throw new Error(`unsupported colour "${t}"`);
  const parts = args(fn[2]!);
  if (fn[1] === 'rgb' && parts.length === 3) {
    const [r, g, b] = parts.map(numeric) as [number, number, number];
    return { r, g, b };
  }
  if (fn[1] === 'hsl' && parts.length === 3) {
    const [h, s, l] = parts.map(numeric) as [number, number, number];
    return hsl(h, s, l);
  }
  if (fn[1] === 'color-mix' && parts.length === 3 && parts[0] === 'in srgb') {
    const [a, b] = [stop(parts[1]!), stop(parts[2]!)];
    // Two percentages that do not total 100 scale the alpha (under) or are normalised (over); the lerp below does neither.
    if (a.pct !== null && b.pct !== null && a.pct + b.pct !== 100) throw new Error(`color-mix percentages must sum to 100: "${t}"`);
    const p = (a.pct ?? (b.pct === null ? 50 : 100 - b.pct)) / 100;
    const q = (b.pct ?? 100 - p * 100) / 100;
    const lerp = (x: number, y: number): number => (x * p + y * q) / (p + q);
    return { r: lerp(a.color.r, b.color.r), g: lerp(a.color.g, b.color.g), b: lerp(a.color.b, b.color.b) };
  }
  throw new Error(`unsupported colour "${t}"`);
}

/** The sRGB colour `expression` (any CSS colour text, `var()` included) resolves to at the root, in `theme`. */
export function colorOf(theme: Theme, expression: string): Rgb {
  return parse(substitute(expression, tokens(theme)));
}
const lin = (v: number): number => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
/** WCAG 2.x relative luminance (the 0.03928 threshold). */
function luminance({ r, g, b }: Rgb): number {
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}
/** WCAG contrast ratio between two colour expressions, in `theme`. */
export function contrast(theme: Theme, a: string, b: string): number {
  const [la, lb] = [luminance(colorOf(theme, a)), luminance(colorOf(theme, b))];
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}
