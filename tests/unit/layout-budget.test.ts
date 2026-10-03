// Phase 2c, B1 (Critical-class, ruling M105) -- THE SAFE-WIDTH INVARIANT.
//
// Two numbers were each chosen correctly against the handoff and never reconciled with
// each other: `DRAWER_MAX_INLINE_SIZE` (820) is the width at or above which the
// three-column layout appears, and `MIN_INLINE_SIZE` (320) is the width below which the
// stage creates no WebGL context at all and disposes any it has. The first is applied to
// the LEAF, the second to the STAGE, and nothing checked that the second was satisfiable
// at the first once the fixed chrome between them is subtracted. It was not:
// 320 + 260 + 280 + 24 + 32 + 2 = 918 > 820, leaving a 98 CSS px band in which the app
// has already classified the leaf as wide but opening the inspector -- which EVERY
// canvas click does, via CityViewport's `selectFromCanvas` -> `store.openInspector()` --
// drops the stage to 222-319 px and the city vanishes behind a "too narrow" notice.
//
// This is arithmetic, so it is pinned as arithmetic. A test that asserted a rendered
// pixel would need a real layout engine to mean anything; this one needs nothing, runs
// in microseconds, and fails the moment someone widens a panel past the budget.
//
// The panel minima are read from the STYLESHEET, not restated here, because the
// stylesheet is where they are actually decided -- CSS cannot import `responsive.ts`
// (that module's own comment says so), so the only way the two can be kept honest is for
// the test to read both.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { DRAWER_MAX_INLINE_SIZE, MIN_INLINE_SIZE } from '../../src/ui/responsive';

const stylesheet = fileURLToPath(new URL('../../src/ui/styles.css', import.meta.url));
// Comments are stripped before anything is parsed: the stylesheet's prose quotes both
// CSS rules and arithmetic, so a naive brace/`px` scan reads numbers that are not in the
// cascade at all. The height-chain test in this same round found that the hard way.
const css = readFileSync(stylesheet, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

/** The three-column block -- the only place the side panels are laid out in a row, and
 *  therefore the only place this budget applies. */
function wideLayoutBlock(): string {
  const start = css.indexOf('@container (min-width: 820px)');
  expect(start).toBeGreaterThan(-1);
  return css.slice(start, css.indexOf('@container (max-width: 819px)'));
}

function ruleFor(selector: string): string {
  const block = wideLayoutBlock();
  const start = block.indexOf(`${selector} {`);
  expect(start).toBeGreaterThan(-1);
  return block.slice(start, block.indexOf('}', start));
}

/** The narrowest this panel can ever be made in the three-column layout. A declared
 *  `min-width` is that number. Without one, a `flex-shrink` of 0 makes the BASIS the
 *  minimum -- which is exactly how 260 and 280 became hard floors nobody had budgeted
 *  for. `clamp(min, ..., max)`'s first argument is its floor. */
function narrowestOf(selector: string): number {
  const rule = ruleFor(selector);
  const minWidth = /min-width:\s*(\d+)px/.exec(rule);
  if (minWidth) return Number(minWidth[1]);
  const basis = /flex:\s*\d+\s+(\d+)\s+(?:clamp\(\s*(\d+)px|(\d+)px)/.exec(rule);
  expect(basis, `neither a min-width nor a readable flex basis in ${selector}`).not.toBeNull();
  const shrink = Number(basis![1]);
  const floor = Number(basis![2] ?? basis![3]);
  // A shrinkable panel with no min-width can collapse to its content width, which is
  // not a number this file can know -- so it is reported as its basis, the honest
  // upper bound on what the layout intends to reserve.
  return shrink === 0 ? floor : floor;
}

/** The TOP-LEVEL rule for a selector -- outside both container-query blocks. */
function topLevelRuleFor(selector: string): string {
  const needle = `:where(.codebase-inspector-root) ${selector} {`;
  const start = css.indexOf(needle);
  expect(start, `${selector} is not declared at the top level of styles.css`).toBeGreaterThan(-1);
  return css.slice(start + needle.length, css.indexOf('}', start));
}

/** A `--ci-*` token's own declaration. */
function token(name: string): number {
  const match = new RegExp(`${name}:\\s*(\\d+)px`).exec(css);
  expect(match, `${name} is not declared in styles.css`).not.toBeNull();
  return Number(match![1]);
}

/** One length out of one declaration, resolved THROUGH `var(--ci-…)` when that is how the
 *  layout itself writes it. Ruling M109: these three numbers used to be transcribed here
 *  as literals, so the budget was checked against what someone believed the stylesheet
 *  said. Changing `--ci-space-4` from 16px to 60px reopened the 820-917px dead band for
 *  real -- clicking a building in an 850px pane makes the city vanish -- while all three
 *  tests stayed green. Derived from the same source the layout reads, that mutation is
 *  caught. */
function lengthOf(rule: string, property: string): number {
  const declaration = new RegExp(`(?<![-\\w])${property}:\\s*([^;]+)`).exec(rule);
  expect(declaration, `the rule declares no ${property}`).not.toBeNull();
  const value = declaration![1]!.trim();
  const variable = /^var\((--[\w-]+)\)$/.exec(value);
  if (variable) return token(variable[1]!);
  const literal = /^(\d+)px/.exec(value);
  expect(literal, `${property}: ${value} is neither a px length nor a --ci token`).not.toBeNull();
  return Number(literal![1]);
}

/** The container query's own threshold, which is the OTHER half of the rule
 *  `DRAWER_MAX_INLINE_SIZE` states. CSS cannot import `responsive.ts` (responsive.ts's own
 *  comment says so), so this file is the only place the duplicate can be kept honest. */
function containerQueryThreshold(pattern: RegExp): number {
  const match = pattern.exec(css);
  expect(match, `no @container block matching ${String(pattern)}`).not.toBeNull();
  return Number(match![1]);
}

// `.ci-app`'s padding on both sides, `.ci-app__body`'s gap between three columns (two
// gaps), and the stage's border on both sides (`.ci-viewport__stage`, box-sizing:
// border-box, so it eats content width). Every one READ, not restated.
const APP_PADDING = lengthOf(topLevelRuleFor('.ci-app'), 'padding');
const BODY_GAP = lengthOf(topLevelRuleFor('.ci-app__body'), 'gap');
const STAGE_BORDER = lengthOf(topLevelRuleFor('.ci-viewport__stage'), 'border');

// Checkpoint #3 item 3 -- B1's arithmetic RE-DERIVED against the real host chrome, and it
// still holds. Obsidian's `.workspace-leaf-content .view-content` adds 24 px of horizontal
// padding (verified in the shipped obsidian.asar), but that padding is OUTSIDE the box
// this budget is measured in: `container-type: inline-size` sits on `.view-content`
// itself (spec 4.4), so `@container (min-width: 820px)` compares its CONTENT box, and
// everything summed below -- `.ci-app`'s own padding included -- lives inside that 820.
// The 24 px therefore does not enter the sum and the 820-917 px dead band does not
// reopen. What WAS wrong is that App.vue compared the BORDER box against the same
// constant, so the two halves of the rule disagreed across a 24 px band; that is fixed in
// src/ui/container-box.ts and pinned by tests/component/container-box.test.ts, which is
// what makes the premise of this sum -- one number, one box -- true rather than assumed.
describe('B1: the collapse threshold must be reconcilable with the hard floor', () => {
  it('a leaf exactly at the threshold can still hold a stage above the floor', () => {
    const listMin = narrowestOf('.ci-app__list-wrapper');
    const inspectorMin = narrowestOf('.ci-inspector');
    const chrome = 2 * APP_PADDING + 2 * BODY_GAP + 2 * STAGE_BORDER;
    const needed = MIN_INLINE_SIZE + listMin + inspectorMin + chrome;
    // If this ever exceeds the threshold again, there is a band of leaf widths in which
    // clicking a building disposes the renderer. Widen the threshold or narrow a panel.
    expect(needed).toBeLessThanOrEqual(DRAWER_MAX_INLINE_SIZE);
  });

  it('the stage still clears the floor with the inspector OPEN, which every pick does', () => {
    const listMin = narrowestOf('.ci-app__list-wrapper');
    const inspectorMin = narrowestOf('.ci-inspector');
    const chrome = 2 * APP_PADDING + 2 * BODY_GAP + 2 * STAGE_BORDER;
    const stageAtThreshold = DRAWER_MAX_INLINE_SIZE - chrome - listMin - inspectorMin;
    expect(stageAtThreshold).toBeGreaterThanOrEqual(MIN_INLINE_SIZE);
  });

  it('the CSS threshold and the TypeScript constant are the same number (M109)', () => {
    // `narrowDrawer` in App.vue and `@container (min-width: …)` in styles.css are two
    // halves of ONE rule (spec 5.2). Nothing but this checked that they still agree, and
    // the whole budget above is measured against the CSS half.
    expect(containerQueryThreshold(/@container \(min-width: (\d+)px\)/)).toBe(DRAWER_MAX_INLINE_SIZE);
    // ... and the narrow branch must be its exact complement, with no gap and no overlap.
    expect(containerQueryThreshold(/@container \(max-width: (\d+)px\)/)).toBe(DRAWER_MAX_INLINE_SIZE - 1);
  });

  it('neither side panel may be pinned: both must be able to yield (B2)', () => {
    // `flex-shrink: 0` is what made 260 and 280 immovable at every width, so the city
    // got 35% of the leaf at 918 px and 76% at 2510 px. A panel that cannot yield is
    // the whole of the proportions complaint; the shrink factor is where that is
    // decided, so it is what this asserts.
    for (const selector of ['.ci-app__list-wrapper', '.ci-inspector']) {
      const flex = /flex:\s*(\d+)\s+(\d+)\s/.exec(ruleFor(selector));
      expect(flex, `${selector} declares no readable flex shorthand`).not.toBeNull();
      expect(Number(flex![2]), `${selector} must be allowed to shrink`).toBeGreaterThan(0);
    }
  });
});
