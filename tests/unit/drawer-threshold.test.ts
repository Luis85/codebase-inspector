// Gap closure GRA6 / GCO17 / GCP4 (ruling E18): the drawer threshold is MEASURED, and it is
// pinned in all four places it lives, so none of them can drift on its own.
//
// tests/fixtures/drawer-threshold-measure.json is the output of `npm run harness-measure --
// --sweep`: for each candidate T it records (a) the city at content = T (leaf = T + 220,
// the nav column inline) and (b) the nav band at leaf = T, where the nav turns inline. The
// choice is recomputed here from those rows with the rule the fixture itself carries, so a
// hand-edited `chosen` is caught. jsdom has no layout engine; like tests/unit/layout-budget.test.ts
// this reads the CSS source, where the other three copies of the number are decided.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { DRAWER_MAX_INLINE_SIZE, MIN_INLINE_SIZE } from '../../src/ui/responsive';

interface Reading {
  clipped: string[];
  navBandClipped: string[];
  stage: number | null;
  floorNotice: boolean;
  navInline: boolean;
  threeColumn: boolean;
}
interface Candidate { threshold: number; screen: string; city: Reading; nav: Reading }
interface Measure { rule: string; chosen: number | null; candidates: Candidate[] }

const read = (relative: string): string => readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8');
const measure = JSON.parse(read('../fixtures/drawer-threshold-measure.json')) as Measure;
const stripComments = (css: string): string => css.replace(/\/\*[\s\S]*?\*\//g, '');
const mainCss = stripComments(read('../../src/ui/styles.css'));
const actCss = stripComments(read('../../src/ui/styles/screens-act.css'));

/** E18's rule, as the fixture states it: (a) the city at content = T is three-column with no
 *  clipped box and a stage at or above the floor; (b) the nav band does not clip at leaf = T. */
function passes({ city, nav }: Candidate): boolean {
  return city.clipped.length === 0 && city.threeColumn && city.stage !== null && city.stage >= MIN_INLINE_SIZE
    && nav.navInline && nav.navBandClipped.length === 0;
}

function smallestPassing(): number | null {
  const thresholds = Array.from(new Set(measure.candidates.map((c) => c.threshold))).sort((a, b) => a - b);
  return thresholds.find((t) => measure.candidates.filter((c) => c.threshold === t).every(passes)) ?? null;
}

const count = (text: string, needle: string): number => text.split(needle).length - 1;

describe('the measured drawer threshold', () => {
  it('measured both screens at every candidate from 700 to 900 px', () => {
    for (let threshold = 700; threshold <= 900; threshold += 20) {
      const screens = measure.candidates.filter((c) => c.threshold === threshold).map((c) => c.screen).sort();
      expect(screens, `T=${threshold}`).toEqual(['s05', 's07']);
    }
  });

  it('chose the smallest candidate that passes on both screens, recomputed from the rows', () => {
    expect(measure.rule).toMatch(/smallest T/);
    expect(measure.chosen).not.toBeNull();
    expect(smallestPassing()).toBe(measure.chosen);
  });

  it('DRAWER_MAX_INLINE_SIZE is the measured value', () => {
    expect(DRAWER_MAX_INLINE_SIZE).toBe(measure.chosen);
  });

  it('carries the value and its complement in all three stylesheet places', () => {
    const t = DRAWER_MAX_INLINE_SIZE;
    expect(count(mainCss, `@container (min-width: ${t}px)`)).toBe(1);
    expect(count(mainCss, `@container (max-width: ${t - 1}px)`)).toBe(1);
    // screens-act.css:5 (the Investigate layout) was a fourth, unpinned copy until GRA6.
    expect(count(actCss, `@container (max-width: ${t - 1}px)`)).toBe(1);
  });
});
