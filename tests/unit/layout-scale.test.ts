import { describe, expect, it } from 'vitest';
import { computeLayout } from '../../src/domain/layout/layout';
import { deriveCap, heightFor } from '../../src/domain/layout/scale';
import { capFixture, emptyFixture, tinyFixture } from '../fixtures/snapshot-builder';
import type { CodebaseSnapshot } from '../../src/domain/model';

// Fix round 1, IMPORTANT 4: `Array(95).fill(600)` types as `any[]` under lib.es5 (the
// `Array(arrayLength: number)` overload), which trips @typescript-eslint/no-unsafe-
// assignment when spread — a false positive against literal numeric test data, but the
// fix is a cleaner idiom, not a lint-config override. `Array.from({ length }, () =>
// value)` types as `number[]` and needs none.
function repeated(value: number, length: number): number[] {
  return Array.from({ length }, () => value);
}

describe('deriveCap', () => {
  it('is the 95th percentile of measured physical-lines', () => {
    const values = Array.from({ length: 100 }, (_, i) => i + 1);   // p95 = 95
    expect(deriveCap(values)).toBe(100);   // 95 -> floored at 100
  });

  it('is floored at 100 lines', () => {
    expect(deriveCap([1, 2, 3, 4, 5])).toBe(100);
  });

  it('rounds up to two significant figures', () => {
    expect(deriveCap([...repeated(600, 95), ...repeated(9000, 5)])).toBe(600);
    expect(deriveCap([...repeated(612, 95), ...repeated(9000, 5)])).toBe(620);
    expect(deriveCap([...repeated(1234, 95), ...repeated(9000, 5)])).toBe(1300);
  });

  it('is NEVER hardcoded at 600', () => {
    expect(deriveCap([...repeated(2500, 95), ...repeated(9000, 5)])).not.toBe(600);
  });

  it('ignores unavailable observations, which have no value', () => {
    expect(deriveCap([])).toBe(100);
  });
});

describe('heightFor', () => {
  it('uses the reference formula 8 + 120 * sqrt(min(lines, cap) / cap)', () => {
    expect(heightFor(0, 600)).toBeCloseTo(8, 6);
    expect(heightFor(600, 600)).toBeCloseTo(128, 6);
    expect(heightFor(150, 600)).toBeCloseTo(8 + 120 * Math.sqrt(0.25), 6);
  });

  it('keeps an empty measured file selectable via the 8-unit base', () => {
    expect(heightFor(0, 600)).toBeGreaterThan(0);
  });

  it('clamps above the cap rather than growing', () => {
    expect(heightFor(9000, 600)).toBeCloseTo(heightFor(600, 600), 6);
  });
});

describe('scale on a real layout', () => {
  it('counts clampedCount as the number of LOTS whose RAW value exceeded the cap', () => {
    const { scale } = computeLayout(capFixture());
    expect(scale.clampedCount).toBeGreaterThan(0);
    expect(scale.clampedCount).toBe(10);   // capFixture puts exactly 10 files above p95
  });

  it('names the cap in SOURCE units, never scene units', () => {
    const { scale } = computeLayout(capFixture());
    expect(scale.unit).toBe('lines');
    expect(scale.name).toBe('physical lines · square-root scale');
    expect(scale.metricId).toBe('physical-lines');
  });

  it('yields finite bounds for an empty snapshot', () => {
    const { bounds } = computeLayout(emptyFixture());
    for (const v of [...bounds.min, ...bounds.max]) expect(Number.isFinite(v)).toBe(true);
  });

  // Ruling M10: the brief's original assertion here contradicted step 6's requirement
  // that an unavailable lot get a distinct (necessarily smaller) footprint from a
  // measured-zero lot at the same base height — the two cannot both share one footprint
  // AND be told apart without reading the inspector. Scoped to non-unavailable lots;
  // unavailable's own footprint is checked separately below.
  it('gives every MEASURED lot an EQUAL footprint, so footprint never encodes the height metric', () => {
    const { lots } = computeLayout(tinyFixture());
    const foot = lots.filter((l) => l.metricState !== 'unavailable')
                     .map((l) => `${l.dimensions[0]}x${l.dimensions[2]}`);
    expect(new Set(foot).size).toBe(1);
  });

  it('gives unavailable lots ONE distinct, SMALLER marker footprint', () => {
    const { lots } = computeLayout(tinyFixture());
    const measured = lots.find((l) => l.metricState !== 'unavailable')!;
    const un = lots.filter((l) => l.metricState === 'unavailable');
    expect(un.length).toBeGreaterThan(0);
    expect(new Set(un.map((l) => `${l.dimensions[0]}x${l.dimensions[2]}`)).size).toBe(1);
    expect(un[0]!.dimensions[0]).toBeLessThan(measured.dimensions[0]);
    expect(un[0]!.dimensions[2]).toBeLessThan(measured.dimensions[2]);
  });

  // Fix round 1, CRITICAL 1: nothing in the validator restricts Observation.entityId to
  // a file, so a validator-legal snapshot can carry a physical-lines observation on a
  // DIRECTORY entity. Spec 4.3 defines the cap and clampedCount over LOTS, and only file
  // entities become lots — a directory's observation must not enter either population.
  it('excludes non-file entities from the cap and clampedCount population, since only LOTS count', () => {
    const base = tinyFixture();
    const directory = base.entities.find((e) => e.kind === 'directory')!;
    const withDirectoryObservation: CodebaseSnapshot = {
      ...base,
      observations: [
        ...base.observations,
        {
          entityId: directory.id,
          measurement: { metricId: 'physical-lines', unit: 'lines', definitionVersion: '1' },
          status: 'measured',
          value: 999_999,
          reason: null,
        },
      ],
    };

    const baseline = computeLayout(base).scale;
    const withDirectory = computeLayout(withDirectoryObservation).scale;
    expect(withDirectory.cap).toBe(baseline.cap);
    expect(withDirectory.clampedCount).toBe(baseline.clampedCount);
  });

  it('still reports capFixture()\'s clampedCount as exactly 10 after excluding non-file entities', () => {
    // Regression check for ruling M11's constraint: the fix above must not change
    // capFixture()'s own result, since every one of its observations already targets a
    // file.
    expect(computeLayout(capFixture()).scale.clampedCount).toBe(10);
  });
});

describe('byte-size metric (ruling M14)', () => {
  it('produces a distinct scale and distinct lot heights from physical-lines on the same snapshot', () => {
    // tinyFixture's one unavailable file has NO physical-lines value but a real,
    // measured byte-size value (a binary file: byte size is knowable even when line
    // count is not) — so the two metrics' populations are not a simple proportional
    // rescaling of each other, and this is a genuine behavioural difference, not a
    // tautology restating the same numbers under a different label.
    const snapshot = tinyFixture();
    const lines = computeLayout(snapshot);
    const bytes = computeLayout(snapshot, { metricId: 'byte-size' });

    expect(bytes.scale.metricId).toBe('byte-size');
    expect(bytes.scale.unit).toBe('bytes');
    expect(bytes.scale.name).toBe('byte size · square-root scale');

    expect(bytes.scale.cap).not.toBe(lines.scale.cap);
    const linesHeights = lines.lots.map((l) => l.dimensions[1]);
    const bytesHeights = bytes.lots.map((l) => l.dimensions[1]);
    expect(bytesHeights).not.toEqual(linesHeights);
  });
});
