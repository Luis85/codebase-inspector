import { describe, expect, it } from 'vitest';
import { computeLayout } from '../../src/domain/layout/layout';
import { buildSnapshotFixture, tinyFixture } from '../fixtures/snapshot-builder';

describe('computeLayout determinism', () => {
  it('produces identical geometry for identical input', () => {
    const s = tinyFixture();
    expect(computeLayout(s)).toEqual(computeLayout(s));
  });

  it('is insensitive to input ordering', () => {
    const s = tinyFixture();
    const reversed = { ...s, entities: [...s.entities].reverse(),
                             observations: [...s.observations].reverse() };
    expect(computeLayout(reversed).lots).toEqual(computeLayout(s).lots);
  });

  it('gives every file its own lot', () => {
    const { lots } = computeLayout(tinyFixture());
    expect(new Set(lots.map((l) => `${l.center[0]}/${l.center[2]}`)).size).toBe(lots.length);
  });

  it('overlaps no two lots', () => {
    const { lots } = computeLayout(buildSnapshotFixture({ files: 400, directories: 25 }));
    for (let i = 0; i < lots.length; i++) {
      for (let j = i + 1; j < lots.length; j++) {
        const a = lots[i]!, b = lots[j]!;
        const sepX = Math.abs(a.center[0] - b.center[0]) >= (a.dimensions[0] + b.dimensions[0]) / 2;
        const sepZ = Math.abs(a.center[2] - b.center[2]) >= (a.dimensions[2] + b.dimensions[2]) / 2;
        expect(sepX || sepZ, `lots ${i} and ${j} overlap`).toBe(true);
      }
    }
  });

  it('never mutates the snapshot it was given', () => {
    const s = tinyFixture();
    const before = JSON.stringify(s);
    computeLayout(s);
    expect(JSON.stringify(s)).toBe(before);
  });

  it('carries a palette KEY, never a resolved colour', () => {
    // colorKey is a palette key so recolouring on css-change never re-runs layout.
    for (const lot of computeLayout(tinyFixture()).lots) {
      expect(lot.colorKey).not.toMatch(/^#|rgb|oklch/);
    }
  });
});

// Hoisted to module scope (oxlint unicorn/consistent-function-scoping): this closure
// captures nothing from the describe callback below, so nesting it there would just
// recreate an identical function on every call for no reason.
function threeStatesLayout() {
  return computeLayout(buildSnapshotFixture({ files: 6, measuredZero: 2, unavailable: 2 }));
}

describe('three presentation states, not two', () => {
  it('distinguishes measured, measured-zero and unavailable', () => {
    const states = new Set(threeStatesLayout().lots.map((l) => l.metricState));
    expect(states).toEqual(new Set(['measured', 'measured-zero', 'unavailable']));
  });

  it('keeps the CATEGORY COLOUR on a measured-zero lot and keeps it selectable', () => {
    const zero = threeStatesLayout().lots.find((l) => l.metricState === 'measured-zero')!;
    expect(zero.colorKey).not.toBe('other');       // it kept its own category
    expect(zero.dimensions[1]).toBeGreaterThan(0); // minimum height, still pickable
  });

  it('gives an unavailable lot a DISTINCT SILHOUETTE, not just a neutral colour', () => {
    // Colour alone is not enough: the Three.js prototype gives measured-zero and
    // unavailable identical geometry and distinguishes unavailable only by a grey that
    // destroys the category signal. Task 4's check is that the two are distinguishable
    // WITHOUT READING THE INSPECTOR (spec 4.3).
    const l = threeStatesLayout();
    const zero = l.lots.find((x) => x.metricState === 'measured-zero')!;
    const un = l.lots.find((x) => x.metricState === 'unavailable')!;
    expect(un.dimensions).not.toEqual(zero.dimensions);
  });
});
