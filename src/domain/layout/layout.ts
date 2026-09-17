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

  // Fix round 1, CRITICAL 1: spec 4.3 defines clampedCount as "the number of LOTS whose
  // raw value exceeded the cap" — only file entities become lots (districts.ts never
  // builds one for a directory or the repository), so an observation on a non-file
  // entity must not enter the cap's p95 population or clampedCount. Nothing in the
  // validator restricts Observation.entityId to a file, so a validator-legal snapshot
  // could otherwise carry a directory-level observation that skews the cap for every
  // real lot and inflates clampedCount with a value no lot corresponds to.
  const fileIds = new Set<EntityId>();
  for (const e of snapshot.entities) if (e.kind === 'file') fileIds.add(e.id);

  const observationByEntity = new Map<EntityId, Observation>();
  const measuredValues: number[] = [];
  for (const obs of snapshot.observations) {
    if (obs.measurement.metricId !== metricId) continue;
    if (!fileIds.has(obs.entityId)) continue;
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
