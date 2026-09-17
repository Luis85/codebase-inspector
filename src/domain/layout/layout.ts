// The pure entry point: computeLayout consumes a validated CodebaseSnapshot and never
// the filesystem, never mutates its input, and produces identical geometry for
// identical input regardless of array ordering.
import type { CodebaseSnapshot, Observation } from '../model';
import type { EntityId } from '../entity-id';
import type { CityDistrict, CityLot, LayoutResult } from './types';
import { deriveCap, scaleNameFor, unitForMetric } from './scale';
import { buildDistrictLayout } from './districts';

const LAYOUT_VERSION = '1';

export type MetricId = 'physical-lines' | 'byte-size';

export function computeLayout(
  snapshot: CodebaseSnapshot,
  opts?: { metricId?: MetricId },
): LayoutResult {
  const metricId = opts?.metricId ?? 'physical-lines';

  const observationByEntity = new Map<EntityId, Observation>();
  const measuredValues: number[] = [];
  for (const obs of snapshot.observations) {
    if (obs.measurement.metricId !== metricId) continue;
    observationByEntity.set(obs.entityId, obs);
    if (obs.status === 'measured' && obs.value !== null) measuredValues.push(obs.value);
  }

  const cap = deriveCap(measuredValues);
  const clampedCount = measuredValues.filter((v) => v > cap).length;

  const { lots, districts } = buildDistrictLayout(
    snapshot.entities,
    (id) => observationByEntity.get(id),
    cap,
  );

  return {
    snapshotId: snapshot.snapshotId,
    layoutVersion: LAYOUT_VERSION,
    lots,
    districts,
    bounds: computeBounds(lots, districts),
    scale: { metricId, name: scaleNameFor(metricId), cap, unit: unitForMetric(metricId), clampedCount },
  };
}

function minMax(values: readonly number[]): [number, number] {
  let min = Infinity, max = -Infinity;
  for (const v of values) {
    if (v < min) min = v;
    if (v > max) max = v;
  }
  return [min, max];
}

function computeBounds(
  lots: readonly CityLot[],
  districts: readonly CityDistrict[],
): LayoutResult['bounds'] {
  // A ground-level 0 is always present, and every snapshot (even an empty one) has at
  // least a root district, so xs/zs are never empty either — bounds stay finite always.
  const xs: number[] = [0];
  const ys: number[] = [0];
  const zs: number[] = [0];
  for (const d of districts) {
    xs.push(d.center[0] - d.extent[0] / 2, d.center[0] + d.extent[0] / 2);
    zs.push(d.center[2] - d.extent[1] / 2, d.center[2] + d.extent[1] / 2);
  }
  for (const l of lots) ys.push(l.center[1] + l.dimensions[1] / 2);

  const [minX, maxX] = minMax(xs);
  const [minY, maxY] = minMax(ys);
  const [minZ, maxZ] = minMax(zs);
  return { min: [minX, minY, minZ], max: [maxX, maxY, maxZ] };
}
