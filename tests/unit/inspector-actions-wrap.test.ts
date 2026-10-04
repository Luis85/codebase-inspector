// Gap closure GRA6 (E18): the inspector's action row wraps instead of overflowing.
//
// The row holds four `white-space: nowrap` buttons (about 456 px together) and the
// inspector can be as narrow as its 200 px floor (styles.css). Without `flex-wrap` the
// buttons ran out of the panel at every width the panel is at its minimum: measured in
// the browser harness at s07, `.ci-inspector__actions` scrolled 456 px inside 174-197 px.
// jsdom has no layout engine, so -- like tests/unit/city-stage-floor.test.ts -- this reads
// the rule out of the stylesheet, where it is decided.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const stylesheet = fileURLToPath(new URL('../../src/ui/styles.css', import.meta.url));
const css = readFileSync(stylesheet, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

describe('the inspector action row (GRA6)', () => {
  it('wraps its buttons rather than overflowing a narrow inspector', () => {
    const needle = ':where(.codebase-inspector-root) .ci-inspector__actions {';
    const start = css.indexOf(needle);
    expect(start, '.ci-inspector__actions is not declared in styles.css').toBeGreaterThan(-1);
    const body = css.slice(start + needle.length, css.indexOf('}', start));
    expect(body).toMatch(/display:\s*flex/);
    expect(body).toMatch(/flex-wrap:\s*wrap/);
  });
});
