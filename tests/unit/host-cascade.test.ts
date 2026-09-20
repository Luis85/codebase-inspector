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

// ---------------------------------------------------------------------------------------
// THE SWEEP, LANDED. The row above was the first instance; these are the rest of them.
//
// Four more of our rules declare a `border`, a `background` and a `color` on a native
// element -- they intend to replace Obsidian's button skin outright -- and three of them
// were losing the same (0,1,0)-vs-(0,1,1) fight the row was. The fourth,
// `.ci-camera-controls button`, was already written as `<class> <type>` and was already
// winning, which is where the recipe came from in the first place.
//
// `.ci-welcome__action` is the worst of them: it declares `background: var(--ci-action)`,
// the ACCENT, for the COPY-02 primary call to action, and `button:not(.clickable-icon)`
// repainted it `--interactive-normal`. The one primary button in the view rendered as an
// ordinary grey one.
//
// Three consequences per button, all from the same asar rules quoted at the top:
//   * `background-color: var(--interactive-normal)`  (0,1,1)  beat our `background`;
//   * `box-shadow: var(--input-shadow)`              (0,1,1)  painted under our own border,
//     and we declared no `box-shadow` at all to stop it;
//   * `color: var(--text-color)`                     (0,1,1)  beat our `color` -- benignly,
//     since `--text-color` and `--ci-text` both resolve to `--text-normal`, but a loss.
//
// And one consequence of FIXING them, which is why the hover assertion below exists: at
// (0,1,1) our `background` also ties `button:hover` (0,1,1) and wins on document order, so
// without a hover rule of our own these controls would lose their hover affordance
// entirely. `.ci-camera-controls button` had already lost it that way, unnoticed.
//
// Focus stays visible throughout: `button { outline: none }` is only (0,0,1), so
// `:where(.codebase-inspector-root) :focus-visible { outline: 2px solid var(--ci-focus) }`
// at (0,1,0) still wins. Our `box-shadow: none` does suppress Obsidian's
// `button:focus-visible` ring, so the focus indicator is our outline rather than two
// overlapping rings -- deliberate, and the same choice already made for the row.
const PLUGIN_SKINNED_BUTTONS = [
  '.ci-app__mode-toggle',        // also carries .ci-app__drawer-opener -- the Files opener
  '.ci-app__drawer-close',
  '.ci-welcome__action',
  '.ci-camera-controls button',  // already compliant; asserted so it cannot regress
];

/** `@media (hover: hover) { button:hover { ... } }` -- a media query changes no specificity. */
const OBSIDIAN_BUTTON_HOVER: Specificity = [0, 1, 1];

function ruleForState(selectorPart: string, property: string, hover: boolean): { selector: string; body: string } {
  const matches = rules().filter((r) => r.selector.includes(selectorPart)
    && declares(r.body, property)
    && r.selector.includes(':hover') === hover);
  const label = hover ? 'hover' : 'base';
  expect(matches.length, `no ${label} rule declares ${property} for ${selectorPart}`).toBeGreaterThan(0);
  return matches[0]!;
}

describe('item 4 sweep: every plugin-skinned button must render the skin it declares', () => {
  it.each(PLUGIN_SKINNED_BUTTONS)('%s wins its background back', (selectorPart) => {
    const rule = ruleForState(selectorPart, 'background', false);
    expect(
      atLeast(specificityOf(rule.selector), OBSIDIAN_BUTTON_SKIN),
      `${rule.selector} computes ${specificityOf(rule.selector).join(',')}, which loses to button:not(.clickable-icon)`,
    ).toBe(true);
  });

  it.each(PLUGIN_SKINNED_BUTTONS)('%s suppresses the host box-shadow', (selectorPart) => {
    // Declaring a border and a background but no box-shadow leaves `--input-shadow`
    // painting under our own border: the host's button skin, half-showing.
    expect(declares(ruleForState(selectorPart, 'background', false).body, 'box-shadow')).toBe(true);
  });

  it.each(PLUGIN_SKINNED_BUTTONS)('%s keeps a hover affordance of its own', (selectorPart) => {
    const rule = ruleForState(selectorPart, 'background', true);
    expect(atLeast(specificityOf(rule.selector), OBSIDIAN_BUTTON_HOVER)).toBe(true);
  });

  it.each(PLUGIN_SKINNED_BUTTONS)('%s still loses to a scoped user snippet', (selectorPart) => {
    const rule = ruleForState(selectorPart, 'background', false);
    expect(atLeast(specificityOf(rule.selector), SCOPED_USER_SNIPPET)).toBe(false);
    expect(rule.selector.startsWith(':where(.codebase-inspector-root)')).toBe(true);
  });
});

// ---------------------------------------------------------------------------------------
// `.ci-search__input` is the DOCUMENTED REFUSAL, and this is the tripwire that keeps it
// honest rather than a comment nobody reads.
//
// It IS a real loss -- `input[type='text']` (0,1,1) beats our (0,1,0) and takes the
// background, the border, the border-radius and the horizontal padding (its `padding`
// SHORTHAND beats our `padding-inline` for the same physical sides). But it is not the
// same SHAPE of fight as the buttons, and the type-selector recipe alone is the wrong fix,
// because Obsidian skins a form field across FIVE states rather than one (asar /app.css
// 7589-7699):
//
//   input[type='text']                (0,1,1)  background, border, radius, padding, outline:none
//   input[type='text']:hover          (0,2,1)  background-color, border-color
//   input[type='text']:active/:focus  (0,2,1)  border-color
//   input[type='text']:focus-visible  (0,2,1)  box-shadow -- THE FOCUS RING
//   input[type='text']::placeholder            placeholder colour
//
// Raising only the base rule to (0,1,1) wins the resting state and loses every other one,
// so the field would change palette under the pointer -- `--background-secondary` at rest,
// `--background-modifier-form-field-hover` on hover. That is worse than today, where it is
// consistently Obsidian's own search-field skin: the purpose-built, theme-aware token set
// for this exact control, and the one every other search box in the app uses. Note also
// that `outline: none` at (0,1,1) beats our own (0,1,0) focus outline here, so the focus
// indicator for this control is Obsidian's `:focus-visible` box-shadow ring -- it is
// present, but it is the host's, and half-re-skinning would put our palette around it.
//
// So the invariant is not "we must win" but "ONE OWNER, EVERY STATE". It holds today with
// the host owning all five, it would hold again after a full re-skin, and it fails the
// moment someone applies the button recipe here and stops.
const OBSIDIAN_FORM_FIELD: Specificity = [0, 1, 1];        // input[type='text']
const OBSIDIAN_FORM_FIELD_STATE: Specificity = [0, 2, 1];  // its :hover / :focus / :focus-visible

describe('item 4 sweep: the search input has ONE owner across all of its states', () => {
  it('either the host skins it in every state, or we do -- never a mix', () => {
    const base = rules().find((r) => r.selector.includes('.ci-search__input')
      && !r.selector.includes(':hover') && declares(r.body, 'background'));
    expect(base, 'no base rule declares a background for .ci-search__input').toBeDefined();
    const weOwnTheRestingState = atLeast(specificityOf(base!.selector), OBSIDIAN_FORM_FIELD);
    const weOwnHover = rules().some((r) => r.selector.includes('.ci-search__input')
      && r.selector.includes(':hover')
      && atLeast(specificityOf(r.selector), OBSIDIAN_FORM_FIELD_STATE));

    expect(
      weOwnHover,
      weOwnTheRestingState
        ? 'the base rule now beats input[type=text], so it MUST also beat input[type=text]:hover (0,2,1) or the field changes palette under the pointer'
        : 'the field is deliberately left to the host in every state; a :hover rule here means that refusal was half-undone',
    ).toBe(weOwnTheRestingState);
  });
});
