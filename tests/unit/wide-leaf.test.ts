import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

// Gap closure GRA5 / GCO14 / GCN6: in a wide leaf the city stage grows to at least 1140 px
// at a 1876 leaf with the inspector open. The two panel percentages are CHOSEN BY
// MEASUREMENT (scripts/harness-measure.mjs --wide), never by estimate; the fixture holds
// the numbers and this test keeps them honest against styles.css.

interface Row {
  screen: string;
  leaf: number;
  stage: number | null;
  clipped: string[];
}
interface Fixture {
  minStageAt1876: number;
  caps: { list: number; inspector: number };
  minimums: { list: number; inspector: number };
  listPercent: number;
  inspectorPercent: number;
  rows: Row[];
  baseline: { listPercent: number; inspectorPercent: number; rows: Row[] };
}

const fixture = JSON.parse(readFileSync('tests/fixtures/wide-leaf-measure.json', 'utf8')) as Fixture;
const css = readFileSync('src/ui/styles.css', 'utf8');

/** `clamp(MINpx, P%, MAXpx)` of the flex basis declared on `selector`, and its `min-width`. */
function panel(selector: string) {
  const pattern = new RegExp(`${selector.replace('.', '\\.')} \\{([^}]*)\\}`, 'g');
  const block = Array.from(css.matchAll(pattern), (m) => m[1] ?? '').find((b) => b.includes('clamp(')) ?? '';
  const clamp = /flex: 0 1 clamp\((\d+)px, (\d+)%, (\d+)px\)/.exec(block);
  const minWidth = /min-width: (\d+)px/.exec(block);
  return {
    min: Number(clamp?.[1]), percent: Number(clamp?.[2]), cap: Number(clamp?.[3]), minWidth: Number(minWidth?.[1]),
  };
}
const list = panel('.ci-app__list-wrapper');
const inspector = panel('.ci-inspector');

const row = (rows: Row[], screen: string, leaf: number) => rows.find((r) => r.screen === screen && r.leaf === leaf);

describe('the wide-leaf measurement (GRA5, GCN6)', () => {
  it('gives the stage at least 1140 px at a 1876 leaf with the inspector open', () => {
    expect(row(fixture.rows, 's07', 1876)?.stage ?? 0).toBeGreaterThanOrEqual(1140);
    expect(fixture.minStageAt1876).toBe(1140);
  });

  it('clips no city box at 1280, 1876 or 2560, on s05 or s07', () => {
    for (const leaf of [1280, 1876, 2560]) {
      for (const screen of ['s05', 's07']) {
        const measured = row(fixture.rows, screen, leaf);
        expect(measured, `${screen} @ ${leaf}`).toBeDefined();
        expect(measured?.clipped, `${screen} @ ${leaf}`).toEqual([]);
      }
    }
  });

  it('records the percentages styles.css holds, so the fixture cannot go stale silently', () => {
    expect(fixture.listPercent).toBe(list.percent);
    expect(fixture.inspectorPercent).toBe(inspector.percent);
  });

  it('keeps the caps 320/360 and the minimums 180/200 unchanged (the threshold budget rests on them)', () => {
    expect(fixture.caps).toEqual({ list: 320, inspector: 360 });
    expect(fixture.minimums).toEqual({ list: 180, inspector: 200 });
    expect([list.cap, list.min, list.minWidth]).toEqual([320, 180, 180]);
    expect([inspector.cap, inspector.min, inspector.minWidth]).toEqual([360, 200, 200]);
  });

  it('keeps the baseline for the record: the pair it replaced fell short of 1140', () => {
    expect(fixture.baseline.listPercent).toBe(18);
    expect(fixture.baseline.inspectorPercent).toBe(20);
    expect(row(fixture.baseline.rows, 's07', 1876)?.stage ?? 0).toBeLessThan(1140);
  });

  it('has lowered at least one percentage from the baseline', () => {
    expect(fixture.listPercent <= fixture.baseline.listPercent).toBe(true);
    expect(fixture.inspectorPercent <= fixture.baseline.inspectorPercent).toBe(true);
    expect(fixture.listPercent + fixture.inspectorPercent).toBeLessThan(fixture.baseline.listPercent + fixture.baseline.inspectorPercent);
  });
});
