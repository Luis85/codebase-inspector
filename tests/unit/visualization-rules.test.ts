// Task 10 acceptance criteria 9 and 10, plus task 9's criterion 11 reassigned here by
// ruling M74. All three are SILENT failures with no other guard:
//
// * A bare `window`/`document`/`requestAnimationFrame` works perfectly until the view
//   is popped out, and then belongs to the wrong window (spec 4.4). No lint rule
//   catches it; a real pop-out bug from exactly this has already happened on this
//   branch.
// * A light intensity not written as `<value> * Math.PI` is wrong by that factor since
//   r155/r165 and renders with no error and no warning.
// * A hex colour literal in src/visualization/ is a second source of truth beside the
//   CityPalette the host actually resolves from the theme.
//
// The convertSRGBToLinear ban IS lint-enforced (eslint.config.mjs); it is restated here
// because that is the one whose failure mode — everything 2-3x darker — is the least
// visible of all, and a second, independent guard is cheap.
import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = fileURLToPath(new URL('../../src/visualization/', import.meta.url));
const stylesheet = fileURLToPath(new URL('../../src/ui/styles.css', import.meta.url));

/** Comments legitimately NAME every banned identifier — that is how the reasons get
 *  written down — so the scan runs over code only. */
function codeOf(file: string): string {
  return readFileSync(join(dir, file), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
}

const files = readdirSync(dir).filter((f) => f.endsWith('.ts'));

describe('src/visualization source rules', () => {
  it('has files to check', () => {
    expect(files.length).toBeGreaterThan(5);
  });

  it.each(['window', 'document', 'requestAnimationFrame', 'cancelAnimationFrame',
    'setInterval', 'setTimeout', 'clearTimeout', 'ResizeObserver', 'IntersectionObserver',
  ])('never reaches for a bare %s', (identifier) => {
    // A member access (`win.document`) or a property name is fine; a bare reference is
    // the wrong window's.
    const bare = new RegExp(String.raw`(?<![.\w'"])${identifier}\b(?!\s*[:?]|['"])`);
    for (const file of files) {
      expect({ file, hit: bare.test(codeOf(file)) }).toEqual({ file, hit: false });
    }
  });

  it('never uses instanceof, which on a DOM type is cross-window wrong', () => {
    for (const file of files) {
      expect({ file, hit: /\binstanceof\b/.test(codeOf(file)) }).toEqual({ file, hit: false });
    }
  });

  it('never calls convertSRGBToLinear or convertLinearToSRGB', () => {
    for (const file of files) {
      expect({ file, hit: /convert(SRGBToLinear|LinearToSRGB)/.test(codeOf(file)) })
        .toEqual({ file, hit: false });
    }
  });

  it('contains no hex colour literal — every colour comes from the CityPalette', () => {
    // Both spellings: a CSS string (#rgb / #rrggbb) and a numeric literal (0xrrggbb).
    // The scan used to match only the first, so a future `new Color(0xff0000)` would
    // have walked straight through it.
    for (const file of files) {
      const code = codeOf(file);
      const css = code.match(/#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})\b/g) ?? [];
      const numeric = (code.match(/\b0x[0-9a-fA-F]{6}\b/g) ?? []).filter((h) => h !== '0xffffff');
      expect({ file, hits: [...css, ...numeric] }).toEqual({ file, hits: [] });
    }
  });

  it('allows 0xffffff ONLY as a light colour, never as a surface colour', () => {
    // The one allowance above, held to its reason: CityPalette has no ambient member —
    // it is the seven fields of spec 4.2 and nothing more — so a light's neutral white
    // cannot come from the palette. A surface's colour always can, and must.
    for (const file of files) {
      for (const line of codeOf(file).match(/^.*\b0xffffff\b.*$/gm) ?? []) {
        expect(`${file}: ${line.trim()}`).toMatch(/new\s+\w*Light\(/);
      }
    }
  });

  it('writes EVERY light intensity as `<value> * Math.PI`', () => {
    for (const file of files) {
      const code = codeOf(file);
      for (const [, args] of code.matchAll(/new\s+\w*Light\(([^)]*)\)/g)) {
        const intensity = (args ?? '').split(',')[1]?.trim() ?? '';
        expect(`${file}: ${intensity}`).toMatch(/INTENSITY$/);
      }
      for (const [, expression] of code.matchAll(/const\s+\w*_INTENSITY\s*=\s*([^;]+);/g)) {
        expect(`${file}: ${expression}`).toContain('Math.PI');
      }
    }
  });
});

// label-overlay.ts is DOM over the canvas, so two of its invariants live in CSS rather
// than in its own file — and both are silent when broken: the labels simply appear in
// the wrong place, or illegibly, with nothing failing.
describe("the label overlay's CSS contract", () => {
  const css = (): string => readFileSync(stylesheet, 'utf8');

  function block(selector: string): string {
    // Plain text extraction rather than a constructed RegExp: the selectors here are
    // wrapped in :where(...), so only the class part is searched for.
    const source = css();
    const start = source.indexOf(selector + ' {');
    if (start < 0) return '';
    return source.slice(start, source.indexOf('}', start));
  }

  it('positions the stage, which is what the overlay anchors to', () => {
    // The overlay is `position: absolute; inset: 0` inside the MOUNT element — the
    // stage. Without a positioned stage it resolves against whatever ancestor happens
    // to be positioned instead, and every label is off by that box's difference.
    expect(block('.ci-viewport__stage')).toMatch(/position:\s*relative/);
  });

  it('gives the labels a size and a shadow, so they are legible over any district', () => {
    // Their COLOUR comes from the palette at runtime (labelText, set on the overlay
    // root), so it must not be set here — but bare inherited text over a mid-tone slab
    // is unreadable whatever colour it is.
    const label = block('.ci-city-labels__label');
    expect(label).toMatch(/font-size:/);
    expect(label).toMatch(/text-shadow:/);
    expect(label).not.toMatch(/(^|[^-])color:/);
  });
});

// The lighting BUDGET, moved here from the contract suite: it is arithmetic over two
// exported constants, not a port behaviour, and it belongs beside the scan that pins
// every intensity being written as `<value> * Math.PI`.
describe('the lighting budget', () => {
  it('keeps every light intensity inside the unclipped budget', async () => {
    // Nothing but a reader catches a wrong intensity, so this is the reader. With the
    // sun at SUN_DIRECTION, the largest dot product an axis-aligned box face can have
    // is that direction's largest normalised component; a fully lit face of the
    // brightest albedo a theme can supply (1.0) must land below 1.0, or the render
    // clips to white and the shading disappears — the blown-out white the task-S spike
    // photographed. Both intensities are also written as `<value> * Math.PI` (r155/r165).
    const { AMBIENT_BASE, DIRECTIONAL_BASE, SUN_DIRECTION } = await import('../../src/visualization/city-renderer');
    const length = Math.hypot(...SUN_DIRECTION);
    const maxDotNL = Math.max(...SUN_DIRECTION.map((c) => Math.abs(c) / length));
    expect(AMBIENT_BASE + DIRECTIONAL_BASE * maxDotNL).toBeLessThan(1);
    // …and the shaded sides must still be clearly darker, or every box reads as flat.
    expect(AMBIENT_BASE).toBeLessThan(AMBIENT_BASE + DIRECTIONAL_BASE * maxDotNL - 0.2);
  });
});
