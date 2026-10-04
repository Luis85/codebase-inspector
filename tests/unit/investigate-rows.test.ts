// Gap closure GRA9 / B13: an Investigate note row keeps its Open button beside the path.
//
// The rows were `display: flex; flex-wrap: wrap` with `flex: 1 1 12em` on the path, so a long
// vault path took the whole line and Open/Refresh wrapped away from it (and from each other).
// Each row is now a two-column grid -- path and status in the flexible first column, the two
// buttons in an `__actions` cell in the second -- and a failed Open's alert spans both columns.
// jsdom has no layout engine, so, like tests/unit/city-stage-floor.test.ts, the rules are read
// out of the stylesheet where they are decided. The markup half is
// tests/component/investigate-rows.test.ts.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const stylesheet = fileURLToPath(new URL('../../src/ui/styles/screens-act.css', import.meta.url));
// Comments stripped first: the stylesheet's prose quotes declarations.
const css = readFileSync(stylesheet, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

/** The declaration block of the rule whose selector list names `selector` (a comma list is
 *  split, so a shared rule counts for each of its selectors). */
function rule(selector: string): string {
  const wanted = `:where(.codebase-inspector-root) ${selector}`;
  for (const match of css.matchAll(/([^{}]+)\{([^}]*)\}/g)) {
    if (match[1]!.split(',').some((part) => part.trim() === wanted)) return match[2]!;
  }
  throw new Error(`${selector} is not declared in screens-act.css`);
}

function declaration(body: string, property: string): string | null {
  const match = new RegExp(`(?<![-\\w])${property}:\\s*([^;]+?)\\s*(?:;|$)`).exec(body);
  return match?.[1] ?? null;
}

for (const block of ['ci-notes-panel', 'ci-orphan-notes'] as const) {
  describe(`.${block}__item is a two-column grid`, () => {
    const item = rule(`.${block}__item`);

    it('is a grid whose first column shrinks and whose second fits its buttons', () => {
      expect(declaration(item, 'display')).toBe('grid');
      expect(declaration(item, 'grid-template-columns')).toBe('minmax(0, 1fr) auto');
    });

    it('never wraps its buttons away from the path', () => {
      expect(item).not.toContain('flex-wrap');
    });

    it('puts the path and status in column 1, and no longer sizes the path as a flex item', () => {
      expect(declaration(rule(`.${block}__path`), 'grid-column')).toBe('1');
      expect(declaration(rule(`.${block}__status`), 'grid-column')).toBe('1');
      expect(rule(`.${block}__path`)).not.toContain('flex:');
      expect(declaration(rule(`.${block}__path`), 'overflow-wrap')).toBe('anywhere');
    });

    it('keeps the buttons together in column 2, never shrinking', () => {
      const actions = rule(`.${block}__actions`);
      expect(declaration(actions, 'display')).toBe('flex');
      expect(declaration(actions, 'flex')).toBe('none');
      expect(declaration(actions, 'grid-column')).toBe('2');
    });

    it('lets a failed Open spread across both columns', () => {
      expect(declaration(rule(`.${block}__open-error`), 'grid-column')).toBe('1 / -1');
    });
  });
}
