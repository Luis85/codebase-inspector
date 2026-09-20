// Checkpoint #3 item 4 -- our stylesheet loses specificity fights with Obsidian's own
// element defaults, and two things were already broken because of it.
//
// Every rule in src/ui/styles.css is wrapped in `:where(.codebase-inspector-root)`, and
// `:where()` contributes ZERO specificity. That is DELIBERATE and spec 4.4 says so in as
// many words: "Note `:where(.codebase-inspector-root)` has zero specificity, so literal
// color/background/font-family declarations there lose to most theme rules". It is what
// lets a user's own snippet override us without `!important`. It also means
// `.ci-file-list__row` computes at (0,1,0) while, in the shipped obsidian.asar `/app.css`:
//
//   button                     { height: var(--input-height);   -- (0,0,1)
//                                white-space: nowrap;
//                                display: inline-flex;
//                                justify-content: center; }
//   button:not(.clickable-icon) { background-color: var(--interactive-normal);  -- (0,1,1)
//                                 box-shadow: var(--input-shadow); }
//
// with `--input-height: 30px`. CodebaseFileList's rows ARE native <button>s, so:
//
//   * the wave's `overflow-wrap: anywhere` (B3) was INERT -- `white-space: nowrap` was
//     never overridden, and it suppresses wrapping outright. The rows were single-line
//     and CLIPPED, not wrapped. `text-align: left` was dead too: the button is a flex
//     container, so its text is placed by `justify-content: center`, which centres an
//     unshrinkable line and overflows BOTH ends, the leading end into negative inline
//     coordinates an LTR scroll container cannot reach.
//   * every row was exactly 30px tall whatever our padding said -- which is what fed
//     defects 5/6 their 1,087 x 30 = 32,610px;
//   * and the SELECTED row's highlight did not render at all, because (0,1,1) beats the
//     (0,1,0) of `.ci-file-list__row--selected`.
//
// THE RULE APPLIED HERE, so the next person can follow it:
//
//   Keep the `:where(.codebase-inspector-root)` scope. Raise a rule that must beat an
//   Obsidian default ONLY by adding the same element TYPE selector Obsidian's own rule
//   uses -- `button.ci-file-list__row` -- never a second class and never an id.
//
// That lands at exactly (0,1,1): equal to `button:not(.clickable-icon)`, resolved our way
// because a plugin's styles.css is appended to the document after `app.css`; and strictly
// below any snippet that scopes itself to the plugin root, since
// `.codebase-inspector-root .ci-file-list__row` is (0,2,0). There is NO specificity value
// strictly between (0,1,1) and (0,2,0), so this is not one option among several -- it is
// the only one that both beats Obsidian's defaults and still loses to a scoped user
// snippet. Where the fight is only against a bare type selector (0,0,1) -- `height`,
// `white-space`, `display` -- no bump is needed at all: a class already wins, and all
// that was missing was declaring the property.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const stylesheet = fileURLToPath(new URL('../../src/ui/styles.css', import.meta.url));
// Comments stripped before parsing: this stylesheet's prose quotes CSS rules, and a
// comment's braces otherwise end a rule early. (The height-chain test found that the hard
// way -- it passed with the defect reinstated.)
const css = readFileSync(stylesheet, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

type Specificity = [number, number, number];

/** Selectors.4's counting, over the subset this stylesheet actually uses: `:where()`
 *  contributes nothing, and a functional pseudo-class with a selector argument is counted
 *  once at class level -- which is exactly right for the `:not(.one-class)` forms in
 *  Obsidian's own rules, and this file asserts nothing that depends on a harder case. */
function specificityOf(selector: string): Specificity {
  const stripped = selector.replace(/:where\([^)]*\)/g, ' ');
  const count = (pattern: RegExp): number => (stripped.match(pattern) ?? []).length;
  return [
    count(/#[\w-]+/g),
    count(/\.[\w-]+|\[[^\]]*\]|:(?!:)[\w-]+(?:\([^)]*\))?/g),
    count(/(?:^|[\s>+~])[a-zA-Z][\w-]*/g),
  ];
}

function atLeast(a: Specificity, b: Specificity): boolean {
  for (let i = 0; i < 3; i += 1) {
    if (a[i]! !== b[i]!) return a[i]! > b[i]!;
  }
  return true;
}

/** Every rule in the stylesheet, as {selectors, body}. */
function rules(): { selector: string; body: string }[] {
  const out: { selector: string; body: string }[] = [];
  const pattern = /([^{}@]+)\{([^{}]*)\}/g;
  let match = pattern.exec(css);
  while (match !== null) {
    for (const selector of match[1]!.split(',')) {
      const trimmed = selector.trim();
      if (trimmed.length > 0) out.push({ selector: trimmed, body: match[2]! });
    }
    match = pattern.exec(css);
  }
  return out;
}

function declares(body: string, property: string): boolean {
  return new RegExp(`(?<![-\\w])${property}:`).test(body);
}

function rulesFor(selectorPart: string, property: string): { selector: string; body: string }[] {
  const found = rules().filter((r) => r.selector.includes(selectorPart) && declares(r.body, property));
  expect(found.length, `no rule declares ${property} for ${selectorPart}`).toBeGreaterThan(0);
  return found;
}

/** `button:not(.clickable-icon)` -- the rule that paints Obsidian's interactive fill and
 *  `--input-shadow` on every bare <button>. Read out of the shipped asar. */
const OBSIDIAN_BUTTON_SKIN: Specificity = [0, 1, 1];
/** A user snippet scoped to our root the ordinary way. We must stay BELOW this. */
const SCOPED_USER_SNIPPET: Specificity = [0, 2, 0];

describe('item 4: the row must beat Obsidian`s bare-button defaults', () => {
  it('declares white-space, height and display, which a class already outranks', () => {
    // These three fight only the bare `button` type selector at (0,0,1), which our class
    // already beats -- so all that was ever missing was declaring them. `white-space` is
    // what makes B3`s `overflow-wrap: anywhere` reach the rows at all; `display` is what
    // stops `inline-flex` + `justify-content: center` clipping the path at both ends and
    // what makes `text-align: left` live again; `height` is what unpins the 30px row.
    const [row] = rulesFor('.ci-file-list__row', 'width');
    expect(declares(row!.body, 'white-space'), 'white-space').toBe(true);
    expect(declares(row!.body, 'height'), 'height').toBe(true);
    expect(declares(row!.body, 'display'), 'display').toBe(true);
  });

  it('carries enough specificity for its background to actually paint', () => {
    // Both the base row`s `transparent` and the selected row`s accent lose at (0,1,0).
    for (const rule of rulesFor('.ci-file-list__row', 'background')) {
      expect(
        atLeast(specificityOf(rule.selector), OBSIDIAN_BUTTON_SKIN),
        `${rule.selector} computes ${specificityOf(rule.selector).join(',')}, which loses to button:not(.clickable-icon)`,
      ).toBe(true);
    }
  });

  it('and still loses to a user snippet scoped to our own root', () => {
    // The whole reason `:where()` is there. A hover rule is exempt: overriding a hover
    // state means writing a hover selector, which carries the same pseudo-class we do.
    for (const rule of rulesFor('.ci-file-list__row', 'background')) {
      if (rule.selector.includes(':hover')) continue;
      expect(
        atLeast(specificityOf(rule.selector), SCOPED_USER_SNIPPET),
        `${rule.selector} would beat a user's own .codebase-inspector-root snippet`,
      ).toBe(false);
    }
  });

  it('keeps the zero-specificity scope, which is what the user snippet wins against', () => {
    // A fix that deleted `:where()` would pass the test above and break spec 4.4's
    // stated contract with the user, so the scope itself is pinned.
    for (const rule of rulesFor('.ci-file-list__row', 'background')) {
      expect(rule.selector.startsWith(':where(.codebase-inspector-root)')).toBe(true);
    }
  });
});
