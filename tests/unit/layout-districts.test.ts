import { describe, expect, it } from 'vitest';
import { computeLayout } from '../../src/domain/layout/layout';
import { buildSnapshotFixture, nestedFixture } from '../fixtures/snapshot-builder';
import type { CityDistrict } from '../../src/domain/layout/types';

describe('districts', () => {
  it('nests: every district but the root has a parentId in the set, and a greater depth', () => {
    // Ruling M11: buildSnapshotFixture's tree is flat (every district at depth 1), so
    // this must run against a genuinely nested fixture or the assertion is vacuous.
    const { districts } = computeLayout(nestedFixture());
    const byId = new Map(districts.map((d) => [d.directoryId, d]));
    const root = districts.find((d) => d.parentId === null);
    expect(root).toBeDefined();
    expect(root!.depth).toBe(0);

    let checked = 0;
    for (const d of districts) {
      if (d.directoryId === root!.directoryId) continue;
      expect(d.parentId).not.toBeNull();
      const parent: CityDistrict | undefined = byId.get(d.parentId!);
      expect(parent).toBeDefined();
      expect(d.depth).toBe(parent!.depth + 1);

      // Walk the parentId chain all the way up; it must reach the root, not dangle.
      let cur: CityDistrict | undefined = d;
      let hops = 0;
      while (cur && cur.parentId !== null) {
        cur = byId.get(cur.parentId);
        hops += 1;
        expect(hops).toBeLessThanOrEqual(districts.length); // guards against a cycle
      }
      expect(cur?.directoryId).toBe(root!.directoryId);
      checked += 1;
    }
    expect(checked).toBeGreaterThan(0);
    // Real nesting, not vacuous: depths 2 AND 3 both actually occur.
    expect(districts.some((d) => d.depth === 2)).toBe(true);
    expect(districts.some((d) => d.depth === 3)).toBe(true);
  });

  it('gives each district a DISPLAY NAME, not a path', () => {
    const d = computeLayout(buildSnapshotFixture({ files: 9, directories: 3 })).districts;
    for (const x of d) expect(x.name).not.toContain('/');
  });

  it('places labelAnchor inside the district extent', () => {
    const { districts } = computeLayout(nestedFixture());
    for (const d of districts) {
      const [cx, , cz] = d.center;
      const [ex, ez] = d.extent;
      const [ax, , az] = d.labelAnchor;
      expect(ax).toBeGreaterThanOrEqual(cx - ex / 2);
      expect(ax).toBeLessThanOrEqual(cx + ex / 2);
      expect(az).toBeGreaterThanOrEqual(cz - ez / 2);
      expect(az).toBeLessThanOrEqual(cz + ez / 2);
    }
  });

  it('aggregates rather than drops when there are many directories', () => {
    const l = computeLayout(buildSnapshotFixture({ files: 400, directories: 60 }));
    expect(l.lots.length).toBe(400);                            // nothing dropped
    expect(l.districts.some((d) => d.aggregated)).toBe(true);   // and it says so

    // Every lot's directoryId — even one re-parented by aggregation — must resolve to
    // a real district; this is the sharpest check that aggregation never orphans a lot.
    const ids = new Set(l.districts.map((d) => d.directoryId));
    for (const lot of l.lots) expect(ids.has(lot.directoryId)).toBe(true);
  });

  it('assigns every lot a directoryId that exists in districts', () => {
    const { lots, districts } = computeLayout(buildSnapshotFixture({ files: 30, directories: 5 }));
    const ids = new Set(districts.map((d) => d.directoryId));
    for (const lot of lots) expect(ids.has(lot.directoryId)).toBe(true);
  });
});
