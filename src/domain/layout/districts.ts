// Deterministic nested districts, built from the snapshot's real containment tree
// (parentId chains) — never by splitting a path string, and with no special-casing of
// 'src'/'packages'/'apps' (the prototype's flat, hardcoded grouping is not ported).
import type { CodeEntity, Observation } from '../model';
import type { EntityId } from '../entity-id';
import type { CityDistrict, CityLot } from './types';
import { heightFor } from './scale';
import { comparePathKeys, pack, type Footprint } from './pack';

/** Equal footprint for every measured / measured-zero lot — footprint never encodes
 *  the height metric (spec 4.3). */
const LOT_FOOTPRINT = 10;

/** Ruling M10/M13: an unavailable lot gets a distinct, SMALLER marker footprint, not
 *  just a neutral colour — a height-only difference is invisible in the top-down
 *  orthographic camera mode (spec 4.2), so the silhouette itself must differ. */
const UNAVAILABLE_FOOTPRINT = 4;

const DISTRICT_PADDING = 6;     // border margin inside a district, around its contents
const LABEL_INSET = DISTRICT_PADDING / 2;
const LABEL_HEIGHT = 4;
const DISTRICT_Y = 0;

/**
 * Ruling M15 — the aggregation threshold. Chosen as a named constant, not inferred:
 * more than 20 direct subdirectories under one container stop each getting their own
 * nested district box (a treemap-of-boxes becomes unreadable well before then) and are
 * rolled up into their parent's district instead. Rolling up NEVER drops a file: every
 * descendant file still becomes a lot, re-parented to the aggregating district's own
 * directoryId. 20 is comfortably above the small, real nesting fixtures this task ships
 * (at most 2 direct subdirectories per level) and comfortably below the stress fixtures
 * that must demonstrate aggregation (60, and incidentally 25).
 */
const MAX_DIRECT_SUBDISTRICTS = 20;

export type MetricLookup = (entityId: EntityId) => Observation | undefined;

interface FileMetric {
  state: CityLot['metricState'];
  value: number;
}

interface PlacedFile {
  entity: CodeEntity;
  metric: FileMetric;
  localX: number;
  localZ: number;
}

interface LayoutNode {
  entity: CodeEntity;
  treeDepth: number;
  aggregated: boolean;
  width: number;
  footprintZ: number;
  files: PlacedFile[];
  children: Array<{ node: LayoutNode; localX: number; localZ: number }>;
}

/**
 * `comparePathKeys` (pack.ts) is the path comparison: the collator, then an ordinal
 * comparison of the exact path when the collator ties (it returns 0 for paths differing
 * only by case or accent, and a tie would let the insertion order leak through `Array#sort`).
 * Then (belt and braces, for two entities that could somehow share a path) the entity id,
 * so byPath is a genuine total order: it never returns 0 for two entities that are not the
 * same entity.
 */
function byPath(a: CodeEntity, b: CodeEntity): number {
  const byKey = comparePathKeys(a.path, b.path);
  if (byKey !== 0) return byKey;
  if (a.id !== b.id) return a.id < b.id ? -1 : 1;
  return 0;
}

function groupByParent(entities: readonly CodeEntity[]): Map<EntityId, CodeEntity[]> {
  const map = new Map<EntityId, CodeEntity[]>();
  for (const e of entities) {
    if (e.parentId === null) continue;
    const list = map.get(e.parentId);
    if (list) list.push(e); else map.set(e.parentId, [e]);
  }
  return map;
}

function metricFor(entity: CodeEntity, lookup: MetricLookup): FileMetric {
  const obs = lookup(entity.id);
  if (obs === undefined || obs.status === 'unavailable') return { state: 'unavailable', value: 0 };
  const value = obs.value ?? 0;
  return { state: value === 0 ? 'measured-zero' : 'measured', value };
}

function footprintFor(state: CityLot['metricState']): Pick<Footprint, 'width' | 'footprintZ'> {
  return state === 'unavailable'
    ? { width: UNAVAILABLE_FOOTPRINT, footprintZ: UNAVAILABLE_FOOTPRINT }
    : { width: LOT_FOOTPRINT, footprintZ: LOT_FOOTPRINT };
}

function collectDescendantFiles(
  entity: CodeEntity,
  childrenOf: Map<EntityId, CodeEntity[]>,
): CodeEntity[] {
  const out: CodeEntity[] = [];
  const stack: CodeEntity[] = [...(childrenOf.get(entity.id) ?? [])];
  while (stack.length > 0) {
    const e = stack.pop()!;
    if (e.kind === 'file') out.push(e); else stack.push(...(childrenOf.get(e.id) ?? []));
  }
  return out.sort(byPath);
}

function placeFiles(files: readonly CodeEntity[], lookup: MetricLookup): { node: Pick<LayoutNode, 'width' | 'footprintZ' | 'files'> } {
  const metrics = files.map((f) => metricFor(f, lookup));
  const items: Footprint[] = metrics.map((m, i) => ({ key: files[i]!.path, ...footprintFor(m.state) }));
  const packed = pack(items);
  const placedFiles: PlacedFile[] = files.map((entity, i) => ({
    entity, metric: metrics[i]!,
    localX: DISTRICT_PADDING + packed.placed[i]!.x,
    localZ: DISTRICT_PADDING + packed.placed[i]!.z,
  }));
  return {
    node: {
      width: packed.width + 2 * DISTRICT_PADDING,
      footprintZ: packed.footprintZ + 2 * DISTRICT_PADDING,
      files: placedFiles,
    },
  };
}

function buildNode(
  entity: CodeEntity,
  treeDepth: number,
  childrenOf: Map<EntityId, CodeEntity[]>,
  lookup: MetricLookup,
): LayoutNode {
  const kids = (childrenOf.get(entity.id) ?? []).slice().sort(byPath);
  const fileKids = kids.filter((k) => k.kind === 'file');
  const dirKids = kids.filter((k) => k.kind !== 'file');

  if (dirKids.length > MAX_DIRECT_SUBDISTRICTS) {
    // Aggregated: no subdirectory below this point gets its own CityDistrict — every
    // one of their files is still a lot, flattened directly into THIS district.
    const allFiles = [...fileKids, ...dirKids.flatMap((d) => collectDescendantFiles(d, childrenOf))]
      .sort(byPath);
    const { node } = placeFiles(allFiles, lookup);
    return { entity, treeDepth, aggregated: true, children: [], ...node };
  }

  const childNodes = dirKids.map((d) => buildNode(d, treeDepth + 1, childrenOf, lookup));
  const fileMetrics = fileKids.map((f) => metricFor(f, lookup));
  const items: Footprint[] = [
    ...fileMetrics.map((m, i) => ({ key: fileKids[i]!.path, ...footprintFor(m.state) })),
    ...childNodes.map((n) => ({ key: n.entity.path, width: n.width, footprintZ: n.footprintZ })),
  ];
  const packed = pack(items);

  const files: PlacedFile[] = fileKids.map((fileEntity, i) => ({
    entity: fileEntity, metric: fileMetrics[i]!,
    localX: DISTRICT_PADDING + packed.placed[i]!.x,
    localZ: DISTRICT_PADDING + packed.placed[i]!.z,
  }));
  const children = childNodes.map((node, i) => {
    const p = packed.placed[fileKids.length + i]!;
    return { node, localX: DISTRICT_PADDING + p.x, localZ: DISTRICT_PADDING + p.z };
  });

  return {
    entity, treeDepth, aggregated: false,
    width: packed.width + 2 * DISTRICT_PADDING,
    footprintZ: packed.footprintZ + 2 * DISTRICT_PADDING,
    files, children,
  };
}

function makeLot(f: PlacedFile, originX: number, originZ: number, directoryId: EntityId, cap: number): CityLot {
  const footprint = footprintFor(f.metric.state);
  const height = f.metric.state === 'measured' ? heightFor(f.metric.value, cap) : heightFor(0, cap);
  return {
    entityId: f.entity.id,
    directoryId,
    center: [originX + f.localX + footprint.width / 2, height / 2, originZ + f.localZ + footprint.footprintZ / 2],
    dimensions: [footprint.width, height, footprint.footprintZ],
    colorKey: f.entity.category ?? 'other',
    metricState: f.metric.state,
  };
}

function collectResults(
  node: LayoutNode,
  originX: number,
  originZ: number,
  parentId: EntityId | null,
  cap: number,
  out: { lots: CityLot[]; districts: CityDistrict[] },
): void {
  const centerX = originX + node.width / 2;
  const centerZ = originZ + node.footprintZ / 2;
  out.districts.push({
    directoryId: node.entity.id,
    parentId,
    name: node.entity.name,
    depth: node.treeDepth,
    center: [centerX, DISTRICT_Y, centerZ],
    extent: [node.width, node.footprintZ],
    labelAnchor: [originX + LABEL_INSET, LABEL_HEIGHT, originZ + LABEL_INSET],
    aggregated: node.aggregated,
  });

  for (const f of node.files) out.lots.push(makeLot(f, originX, originZ, node.entity.id, cap));
  for (const c of node.children) {
    collectResults(c.node, originX + c.localX, originZ + c.localZ, node.entity.id, cap, out);
  }
}

/** Builds every CityLot and CityDistrict from the snapshot's containment tree. Pure:
 *  reads `entities` only, never mutates it. `districts` exists because task 4 must
 *  produce district geometry and labels while spec 4.2 forbids the renderer from
 *  computing grouping or district assignment — without it the renderer has no ground
 *  rectangle to draw, no name to show and no anchor to place a label at. */
export function buildDistrictLayout(
  entities: readonly CodeEntity[],
  lookup: MetricLookup,
  cap: number,
): { lots: CityLot[]; districts: CityDistrict[] } {
  const out: { lots: CityLot[]; districts: CityDistrict[] } = { lots: [], districts: [] };
  const root = entities.find((e) => e.kind === 'repository');
  if (!root) return out;
  const childrenOf = groupByParent(entities);
  const node = buildNode(root, 0, childrenOf, lookup);
  collectResults(node, 0, 0, null, cap, out);
  return out;
}

/** Task 7 fix round 2: WHICH districts are directory districts, as a fact about the
 *  layout — not about how a header or a footer words it. `collectResults` above
 *  always pushes ONE district for the repository root itself first (depth 0,
 *  `entity.kind === 'repository'`), ahead of the real subdirectories (depth >= 1).
 *  Reproduced live (task 7): `buildDistrictLayout` over a 6-directory fixture
 *  (`buildSnapshotFixture({ files: 144, directories: 6 })`) produces
 *  `districts.length === 7`, `districts[0]` named after the repository — the raw
 *  length over-counts "directory districts" by exactly one.
 *
 *  `depth > 0` is exact and needs no entity-kind lookup: `buildNode` assigns depth 0
 *  to the single root call and increments for every real child, so there is never a
 *  second depth-0 entry to accidentally keep or a real district to accidentally
 *  drop. The frozen `CityDistrict` contract (types.ts) has no `kind`/`isRoot` field;
 *  `parentId !== null` is an equivalent test but no more direct than this one.
 *
 *  This is the ONLY place that needs the exclusion. `instanced-city.ts` deliberately
 *  keeps reading the UNFILTERED `districts.length` / `districts` array, because the
 *  root's own ground slab is real geometry that must still be drawn.
 *  `CodebaseFileList.vue`'s own per-district grouping already excludes the empty
 *  root incidentally (it groups the FILES it has, and the root never holds one
 *  directly once every file has a real parent directory) without needing this
 *  filter — do not apply it there either. `CityHeader.vue` (task 7) and the footer
 *  (task 8) are the two callers that must both derive "how many directory districts"
 *  from THIS function, so they cannot independently get the off-by-one wrong in two
 *  different ways. */
export function countDirectoryDistricts(districts: readonly CityDistrict[]): number {
  return districts.filter((d) => d.depth > 0).length;
}
