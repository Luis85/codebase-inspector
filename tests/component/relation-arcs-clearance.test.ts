// Gap closure GRA7 (Task 10): a relation arc rises clear of the tallest building in its xz
// corridor, instead of the old 0.35-per-unit lift that a 128-high tower between two low
// files swallowed. The real `three`; no WebGL is needed to build the geometry.
import { describe, expect, it } from 'vitest';
import { LineSegments, Vector3 } from 'three';
import type { BufferAttribute } from 'three';
import { ARC_CLEARANCE, createRelationArcs } from '../../src/visualization/relation-arcs';
import type { CityLot } from '../../src/domain/layout/types';
import { ID, layoutOf, paletteFixture } from '../fixtures/renderer-doubles';

const SEGMENTS = 24;
const A = ID('src/a.ts');
const M = ID('src/m.ts');
const B = ID('src/b.ts');
const SIDE = ID('src/side.ts');

const BASE = layoutOf('clearance', 1).lots[0]!;

function lot(entityId: string, x: number, h: number, z = 0): CityLot {
  return { ...BASE, entityId, center: [x, h / 2, z], dimensions: [2, h, 2] };
}

/** The sampled polyline of the first (only) arc: its 25 distinct points, start to end. */
function sampled(lots: readonly CityLot[]): Vector3[] {
  const rig = createRelationArcs();
  rig.setLots(lots);
  rig.setColors(paletteFixture());
  rig.setArcs([{ from: A, to: B, role: 'outgoing' }]);
  const position = (rig.root.children[0] as LineSegments).geometry.getAttribute('position') as BufferAttribute;
  const points = [new Vector3().fromBufferAttribute(position, 0)];
  for (let s = 0; s < SEGMENTS; s++) points.push(new Vector3().fromBufferAttribute(position, s * 2 + 1));
  rig.dispose();
  return points;
}

const apexOf = (points: readonly Vector3[]): number => Math.max(...points.map((p) => p.y));

describe('relation arcs clear the corridor (GRA7)', () => {
  it('lifts the apex over a 128-high tower standing between two 8-high lots', () => {
    const points = sampled([lot(A, 0, 8), lot(M, 14, 128), lot(B, 28, 8)]);
    expect(apexOf(points)).toBeGreaterThanOrEqual(128 + ARC_CLEARANCE);
  });

  it('keeps today\'s lift when the middle lot is low (apex 13.9)', () => {
    const points = sampled([lot(A, 0, 8), lot(M, 14, 4), lot(B, 28, 8)]);
    expect(apexOf(points)).toBeCloseTo(13.9, 5);
  });

  it('is not raised by a tall lot beside the corridor', () => {
    const points = sampled([lot(A, 0, 8), lot(B, 28, 8), lot(SIDE, 14, 128, 10)]);
    expect(apexOf(points)).toBeCloseTo(13.9, 5);
  });

  it('leaves both endpoints on the two roofs', () => {
    const points = sampled([lot(A, 0, 8), lot(M, 14, 128), lot(B, 28, 8)]);
    expect(points[0]!.toArray()).toEqual([0, 8, 0]);
    expect(points[SEGMENTS]!.toArray()).toEqual([28, 8, 0]);
  });
});
