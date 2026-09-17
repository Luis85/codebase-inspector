// Deterministic nested districts, built from the snapshot's real containment tree
// (parentId chains) — never by splitting a path string, and with no special-casing of
// 'src'/'packages'/'apps' (the prototype's flat, hardcoded grouping is not ported).
import type { CodeEntity, Observation } from '../model';
import type { EntityId } from '../entity-id';
import type { CityDistrict, CityLot } from './types';
import { heightFor } from './scale';

/** Equal footprint for every measured / measured-zero lot — footprint never encodes
 *  the height metric (spec 4.3). */
export const LOT_FOOTPRINT = 10;

/** Ruling M10/M13: an unavailable lot gets a distinct, SMALLER marker footprint, not
 *  just a neutral colour — a height-only difference is invisible in the top-down
 *  orthographic camera mode (spec 4.2), so the silhouette itself must differ. */
export const UNAVAILABLE_FOOTPRINT = 4;

const GUTTER = 4;               // gap between sibling boxes in a shelf-packed row/column
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
export const MAX_DIRECT_SUBDISTRICTS = 20;

export type MetricLookup = (entityId: EntityId) => Observation | undefined;

interface FileMetric {
  state: CityLot['metricState'];
  value: number;
}

interface Footprint {
  width: number;
  footprintZ: number;
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

const COLLATOR = new Intl.Collator('en', { numeric: true, sensitivity: 'base' });

/**
 * Fix round 1, IMPORTANT 2: `sensitivity: 'base'` makes the collator return 0 for paths
 * differing only by case or accent (e.g. 'README.md' vs 'readme.md') — verified directly:
 * `COLLATOR.compare('README.md', 'readme.md') === 0`. Two distinct files on a
 * case-sensitive filesystem are legal, and `Array#sort` is stable, so a tie there would
 * let the ORIGINAL (insertion) order leak through — silently breaking "identical input
 * yields identical geometry" and "insensitive to input ordering", the two determinism
 * bullets this whole task exists to satisfy. A collator tie now falls back to an ordinal
 * comparison of the exact path, and then (belt and braces, for two entities that could
 * somehow share a path) the entity id, so byPath is a genuine total order: it never
 * returns 0 for two entities that are not the same entity.
 */
function byPath(a: CodeEntity, b: CodeEntity): number {
  const collated = COLLATOR.compare(a.path, b.path);
  if (collated !== 0) return collated;
  if (a.path !== b.path) return a.path < b.path ? -1 : 1;
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

function footprintFor(state: CityLot['metricState']): Footprint {
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

/**
 * Shelf packing: items are placed left-to-right until adding one would exceed the
 * target row width, then wrap to a new row below the tallest item seen so far in the
 * current row. Every item's rectangle is [x, x+width) x [z, z+footprintZ). Within a
 * row, x strictly accumulates prior widths plus a positive gutter, so two items in the
 * same row never share an x value. Across rows, z strictly accumulates prior rows'
 * heights plus a positive gutter, and every item's z-span is bounded by its own row's
 * height — so no item can reach into another row. That is the whole non-overlap proof:
 * it holds for any input, not just the fixtures this task tests against.
 */
function shelfPack(items: readonly Footprint[]): { width: number; footprintZ: number; placed: Array<{ x: number; z: number }> } {
  if (items.length === 0) return { width: 0, footprintZ: 0, placed: [] };
  let totalArea = 0;
  let widestItem = 0;
  for (const it of items) { totalArea += it.width * it.footprintZ; widestItem = Math.max(widestItem, it.width); }
  const targetRowWidth = Math.max(widestItem, Math.sqrt(totalArea));

  const placed: Array<{ x: number; z: number }> = [];
  let rowX = 0, rowZ = 0, rowHeight = 0, maxWidth = 0;
  for (const item of items) {
    if (rowX > 0 && rowX + item.width > targetRowWidth) {
      rowZ += rowHeight + GUTTER;
      rowX = 0;
      rowHeight = 0;
    }
    placed.push({ x: rowX, z: rowZ });
    rowX += item.width + GUTTER;
    rowHeight = Math.max(rowHeight, item.footprintZ);
    maxWidth = Math.max(maxWidth, rowX - GUTTER);
  }
  return { width: maxWidth, footprintZ: rowZ + rowHeight, placed };
}

function placeFiles(files: readonly CodeEntity[], lookup: MetricLookup): { node: Pick<LayoutNode, 'width' | 'footprintZ' | 'files'> } {
  const metrics = files.map((f) => metricFor(f, lookup));
  const items = metrics.map((m) => footprintFor(m.state));
  const packed = shelfPack(items);
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
    ...fileMetrics.map((m) => footprintFor(m.state)),
    ...childNodes.map((n) => ({ width: n.width, footprintZ: n.footprintZ })),
  ];
  const packed = shelfPack(items);

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
