// Final whole-branch review, item 3: the city stage keeps a full-height floor.
//
// `.ci-screen--city` stacks a PageHeader, the unchanged `.ci-app` and the summary cards
// in one flex column. With `.ci-app` at `flex: 1 1 0; min-height: 0` the header and cards
// took their share first and the stage was left with whatever remained -- in the
// harness shot, a strip too short to show the district labels. jsdom has no layout
// engine, so -- like tests/unit/layout-budget.test.ts and
// tests/component/stage-height.test.ts -- this reads the rule out of the stylesheet,
// where it is actually decided.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const stylesheet = fileURLToPath(new URL('../../src/ui/styles/screens.css', import.meta.url));
// Comments stripped first: the stylesheet's prose quotes declarations (see the two
// precedents above for why that matters).
const css = readFileSync(stylesheet, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

function rule(selector: string): string {
  const needle = `:where(.codebase-inspector-root) ${selector} {`;
  const start = css.indexOf(needle);
  expect(start, `${selector} is not declared in screens.css`).toBeGreaterThan(-1);
  return css.slice(start + needle.length, css.indexOf('}', start));
}

function declaration(body: string, property: string): string | null {
  const match = new RegExp(`(?<![-\\w])${property}:\\s*([^;]+?)\\s*(?:;|$)`).exec(body);
  return match?.[1] ?? null;
}

/** The px floor a length expression guarantees: a plain `Npx`, or the px argument of
 *  `max(Npx, ...)` (a max is never below any of its arguments). */
function pxFloor(value: string | null): number {
  if (!value) return 0;
  const plain = /^(\d+)px$/.exec(value);
  if (plain) return Number(plain[1]);
  const max = /^max\(\s*(\d+)px\s*,/.exec(value);
  return max ? Number(max[1]) : 0;
}

describe('the city stage inside the City screen', () => {
  const app = rule('.ci-screen--city > .ci-app');

  it('has a non-zero min-height floor', () => {
    expect(pxFloor(declaration(app, 'min-height'))).toBeGreaterThanOrEqual(420);
  });

  it('never shrinks to make room for the header and summary cards', () => {
    const flex = declaration(app, 'flex');
    const shrinks = flex !== 'none' && !/^\d+\s+0(\s|$)/.test(flex ?? '');
    expect(shrinks, `flex: ${flex ?? '(unset)'} lets the stage shrink`).toBe(false);
  });

  it('keeps a DEFINITE height (full leaf, floored), never an auto height the file list could size', () => {
    const height = declaration(app, 'height');
    expect(height).not.toBeNull();
    expect(height).not.toBe('auto');
    expect(pxFloor(height)).toBeGreaterThanOrEqual(420);
    expect(height).toContain('100%');
  });

  it('sits in a screen whose own height the percentage resolves against', () => {
    expect(declaration(rule('.ci-screen--city'), 'height')).toBe('100%');
  });
});
