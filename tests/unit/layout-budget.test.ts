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
const css = readFileSync(stylesheet, 'utf8');

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

// Every one of these is read off the stylesheet's own declarations rather than guessed:
// `.ci-app` padding var(--ci-space-4) = 16 on both sides, `.ci-app__body` gap
// var(--ci-space-3) = 12 between three columns (two gaps), and the stage's 1px border on
// both sides (`.ci-viewport__stage`, box-sizing: border-box, so it eats content width).
const APP_PADDING = 16;
const BODY_GAP = 12;
const STAGE_BORDER = 1;

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
