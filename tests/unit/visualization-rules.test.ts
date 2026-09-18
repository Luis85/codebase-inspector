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
    for (const file of files) {
      const hits = codeOf(file).match(/#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})\b/g) ?? [];
      expect({ file, hits }).toEqual({ file, hits: [] });
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
