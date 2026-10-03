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
const UNAVAILABLE_FOOTPRINT = 4;

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
/** Candidates tried per refinement stage. Two stages: a coarse sweep of the whole
 *  feasible range, then the same sweep again inside one step either side of the winner.
 *  66 measure-only passes over the items, no allocation until the winner is packed for
 *  real -- comfortably inside the ledger's own "~280 ms at 40 000 files" budget, and
 *  measured at 9 ms -> 19 ms for the user's whole 1087-file tree. */
const TARGET_WIDTH_SEARCH_STEPS = 32;

/** How far from square, as a symmetric log ratio, so 2:1 and 1:2 score identically and
 *  the comparison cannot be biased toward one axis. Lower is better. */
function aspectPenalty(width: number, footprintZ: number): number {
  if (width <= 0 || footprintZ <= 0) return Number.POSITIVE_INFINITY;
  return Math.abs(Math.log(width / footprintZ));
}

/** The packing rule itself, measuring only — no array, so the search below can try it
 *  many times for nothing. `place` runs the identical loop once, for the winner. */
function measureAt(items: readonly Footprint[], targetRowWidth: number): { width: number; footprintZ: number } {
  let rowX = 0, rowZ = 0, rowHeight = 0, maxWidth = 0;
  for (const item of items) {
    if (rowX > 0 && rowX + item.width > targetRowWidth) {
      rowZ += rowHeight + GUTTER;
      rowX = 0;
      rowHeight = 0;
    }
    rowX += item.width + GUTTER;
    rowHeight = Math.max(rowHeight, item.footprintZ);
    maxWidth = Math.max(maxWidth, rowX - GUTTER);
  }
  return { width: maxWidth, footprintZ: rowZ + rowHeight };
}

function placeAt(items: readonly Footprint[], targetRowWidth: number): { width: number; footprintZ: number; placed: Array<{ x: number; z: number }> } {
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

/**
 * Phase 2c, I2 / defect 4(a). The target row width used to be `sqrt(totalArea)` over the
 * ITEM areas alone -- "make this square", which is the right intent -- while the rows it
 * then packed consumed `width + GUTTER` horizontally and `footprintZ + GUTTER`
 * vertically. Counting neither gutter made the target under-shoot the true square width
 * by exactly LOT_FOOTPRINT/(LOT_FOOTPRINT + GUTTER) = 10/14, and because the depth is
 * whatever is left over, the result converged on (10/14)^2 ~= 0.51 REGARDLESS OF INPUT:
 * every district at every depth came out about twice as deep as it is wide. Measured
 * 762 x 1518 on the user's real 1087-file tree, and 1 : 5.4 for a four-file folder. That
 * shape then inflates the AABB diagonal that `camera-rig.fit()` frames, so the two
 * defects compound.
 *
 * A gutter-aware `sqrt` is the minimal repair and reaches exactly 1.000 for equal leaf
 * items -- but only ~0.57 for the whole city, because at the upper levels the packed
 * items are heterogeneous nested boxes and a shelf row is as tall as its tallest member.
 * So the target is SEARCHED instead of computed: the packing rule is unchanged and the
 * item order is untouched (the caller has already sorted by path, and determinism is this
 * module's whole point), and only the width at which rows break is chosen, by trying
 * candidates across the feasible range and keeping the one closest to square.
 *
 * Deterministic by construction: the candidate set is a fixed arithmetic sweep of a range
 * derived only from the items, it is evaluated in a fixed order, and a tie keeps the
 * earlier (narrower) candidate. No randomness, no time, no dependence on anything but the
 * items in the order given.
 */
function shelfPack(items: readonly Footprint[]): { width: number; footprintZ: number; placed: Array<{ x: number; z: number }> } {
  if (items.length === 0) return { width: 0, footprintZ: 0, placed: [] };
  let totalAdvance = 0;
  let widestItem = 0;
  for (const it of items) { totalAdvance += it.width + GUTTER; widestItem = Math.max(widestItem, it.width); }
  // The feasible range, both ends achievable: at `widestItem` every item is on its own
  // row (the deepest, narrowest result); at the full advance they are all on one row.
  let low = widestItem;
  let high = Math.max(widestItem, totalAdvance - GUTTER);
  let bestTarget = low;
  let bestPenalty = Number.POSITIVE_INFINITY;
  for (let stage = 0; stage < 2; stage += 1) {
    const step = (high - low) / TARGET_WIDTH_SEARCH_STEPS;
    if (!(step > 0)) break;
    for (let i = 0; i <= TARGET_WIDTH_SEARCH_STEPS; i += 1) {
      const target = low + step * i;
      const { width, footprintZ } = measureAt(items, target);
      const penalty = aspectPenalty(width, footprintZ);
      // Strictly better, so a tie keeps the narrower candidate -- the tie-break is what
      // makes the sweep's result independent of evaluation order.
      if (penalty < bestPenalty) { bestPenalty = penalty; bestTarget = target; }
    }
    low = Math.max(widestItem, bestTarget - step);
    high = bestTarget + step;
  }
  return placeAt(items, bestTarget);
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
