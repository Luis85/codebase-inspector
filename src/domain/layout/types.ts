// Ruling P1 (task-2-context.md): created ahead of task 4 so that renderer-port.ts's
// frozen setLayout(layout: LayoutResult, ...) signature can typecheck. ONLY these three
// spec 4.3 type declarations belong here — no functions, no constants, no logic. Task 4
// owns scale.ts, districts.ts and layout.ts and may extend this file additively only.
import type { CategoryId } from '../classify';
import type { EntityId } from '../entity-id';

export interface CityLot {
  entityId: EntityId;
  directoryId: EntityId;
  center: [number, number, number];
  dimensions: [number, number, number];
  colorKey: CategoryId;
  metricState: 'measured' | 'measured-zero' | 'unavailable';
}

export interface CityDistrict {
  directoryId: EntityId;
  parentId: EntityId | null;
  name: string;                         // display name, not a path
  depth: number;
  center: [number, number, number];
  extent: [number, number];             // ground footprint
  labelAnchor: [number, number, number];
  aggregated: boolean;                  // true when children were rolled up
}

export interface LayoutResult {
  snapshotId: string;
  layoutVersion: string;
  lots: readonly CityLot[];
  districts: readonly CityDistrict[];
  bounds: { min: [number, number, number]; max: [number, number, number] };
  scale: { metricId: string; name: string; cap: number; unit: string; clampedCount: number };
}
