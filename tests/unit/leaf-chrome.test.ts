// The inspector owns its whole leaf: Obsidian's own view header (title bar, back/forward,
// pane menu) is hidden and `.view-content`'s default padding removed -- for THIS view
// type only. jsdom has no cascade worth asserting against, so -- like
// tests/unit/city-stage-floor.test.ts -- this reads the rules out of the stylesheet, and
// pins the view-type string they key on to the one the view actually registers, so a
// rename cannot silently turn both rules into dead selectors.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { CITY_VIEW_TYPE } from '../../src/host/city-view';

const stylesheet = fileURLToPath(new URL('../../src/ui/styles/shell.css', import.meta.url));
const css = readFileSync(stylesheet, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
const leaf = `.workspace-leaf-content[data-type="${CITY_VIEW_TYPE}"]`;

function rule(selector: string): string {
  const needle = `${selector} {`;
  const start = css.indexOf(needle);
  expect(start, `${selector} is not declared in shell.css`).toBeGreaterThan(-1);
  return css.slice(start + needle.length, css.indexOf('}', start));
}

describe('the inspector leaf chrome', () => {
  it('hides Obsidian\'s view header for this view type only', () => {
    expect(rule(`${leaf} > .view-header`)).toMatch(/(?<![-\w])display:\s*none\s*;/);
  });

  it('removes the view-content padding for this view type only', () => {
    expect(rule(`${leaf} > .view-content`)).toMatch(/(?<![-\w])padding:\s*0\s*;/);
  });

  it('never hides or unpads another view type\'s header or content', () => {
    const unscoped = /(^|[},])\s*\.workspace-leaf-content\s+(>\s*)?\.view-(header|content)\s*\{/m;
    expect(css).not.toMatch(unscoped);
  });
});

describe('compact density (Part 4 W5, fix round 1)', () => {
  it('the compact gap rule excludes the city screen, so screens.css\'s own gap: 0 stays authoritative', () => {
    expect(rule('.ci-shell--compact .ci-screen:not(.ci-screen--city)')).toMatch(/(?<![-\w])gap:\s*var\(--ci-space-3\)\s*;/);
    // Guards against regressing to the unscoped selector this fixes.
    expect(css).not.toMatch(/\.ci-shell--compact\s+\.ci-screen\s*\{/);
  });
});
