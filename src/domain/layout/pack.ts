// NFDH (next-fit decreasing height) packing for one district's items, with a searched target
// row width. Ruling E15 / GRA1: on the frozen 1,236-path real tree the root district's
// occupancy rose from 54.66 % (path-ordered shelf packing) to 71.87 %.

/** Gap between sibling boxes in a packed row / column. */
const GUTTER = 4;

/** A box to place. `key` is the item's path: it is the stable tie-break of the packing order,
 *  so the order never depends on the order the caller happened to list the items in. */
export interface Footprint {
  key: string;
  width: number;
  footprintZ: number;
}

export interface Packed {
  width: number;
  footprintZ: number;
  placed: Array<{ x: number; z: number }>;
}

const COLLATOR = new Intl.Collator('en', { numeric: true, sensitivity: 'base' });

/**
 * Fix round 1, IMPORTANT 2: `sensitivity: 'base'` makes the collator return 0 for paths
 * differing only by case or accent (e.g. 'README.md' vs 'readme.md') — verified directly:
 * `COLLATOR.compare('README.md', 'readme.md') === 0`. Two distinct files on a
 * case-sensitive filesystem are legal, and `Array#sort` is stable, so a tie there would
 * let the ORIGINAL (insertion) order leak through — silently breaking "identical input
 * yields identical geometry" and "insensitive to input ordering". A collator tie therefore
 * falls back to an ordinal (code-unit) comparison of the exact path, so this is a total
 * order on distinct strings. Shared by `pack`'s ordering and districts.ts's `byPath`.
 */
export function comparePathKeys(a: string, b: string): number {
  const collated = COLLATOR.compare(a, b);
  if (collated !== 0) return collated;
  if (a !== b) return a < b ? -1 : 1;
  return 0;
}

/** Candidates tried per refinement stage. Two stages: a coarse sweep of the whole
 *  feasible range, then the same sweep again inside one step either side of the winner.
 *  66 measure-only passes over the items, no allocation until the winner is packed for
 *  real -- comfortably inside the ledger's own "~280 ms at 40 000 files" budget. */
const TARGET_WIDTH_SEARCH_STEPS = 32;

/** How far from square, as a symmetric log ratio, so 2:1 and 1:2 score identically and
 *  the comparison cannot be biased toward one axis. Lower is better. */
function aspectPenalty(width: number, footprintZ: number): number {
  if (width <= 0 || footprintZ <= 0) return Number.POSITIVE_INFINITY;
  return Math.abs(Math.log(width / footprintZ));
}

/** The packing order: footprintZ descending, then key. Indices into `items`. Distinct paths
 *  compare unequal (`comparePathKeys` is a total order on distinct strings), so the order does
 *  not depend on how the items arrive; two EQUAL keys would fall back to the caller's own
 *  stable order. Computed ONCE per pack, outside the target-width search. */
function decreasingHeight(items: readonly Footprint[]): number[] {
  return items.map((_, i) => i).sort((a, b) =>
    items[b]!.footprintZ - items[a]!.footprintZ || comparePathKeys(items[a]!.key, items[b]!.key));
}

/** The packing rule, measuring only — no array, so the search can try it many times for
 *  nothing. NFDH: items are placed left-to-right in `order` until adding one would exceed
 *  the target row width, then a new row opens below the current one; only the current row
 *  is ever open. Because `order` is height-descending, a row's first item is its tallest. */
function measureAt(items: readonly Footprint[], order: readonly number[], targetRowWidth: number): { width: number; footprintZ: number } {
  let rowX = 0, rowZ = 0, rowHeight = 0, maxWidth = 0;
  for (const i of order) {
    const item = items[i]!;
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

/** The identical loop, run once for the winner. `placed[i]` belongs to `items[i]`. */
function placeAt(items: readonly Footprint[], order: readonly number[], targetRowWidth: number): Packed {
  const placed = Array.from({ length: items.length }, () => ({ x: 0, z: 0 }));
  let rowX = 0, rowZ = 0, rowHeight = 0, maxWidth = 0;
  for (const i of order) {
    const item = items[i]!;
    if (rowX > 0 && rowX + item.width > targetRowWidth) {
      rowZ += rowHeight + GUTTER;
      rowX = 0;
      rowHeight = 0;
    }
    placed[i] = { x: rowX, z: rowZ };
    rowX += item.width + GUTTER;
    rowHeight = Math.max(rowHeight, item.footprintZ);
    maxWidth = Math.max(maxWidth, rowX - GUTTER);
  }
  return { width: maxWidth, footprintZ: rowZ + rowHeight, placed };
}

/**
 * Packs `items` and returns each one's top-left corner in its box. Every item's rectangle
 * is [x, x+width) x [z, z+footprintZ). Within a row, x strictly accumulates prior widths
 * plus a positive gutter; across rows, z strictly accumulates prior rows' heights plus a
 * positive gutter, and every item's z-span is bounded by its own row's height — so no item
 * can reach into another row. That is the whole non-overlap proof: it holds for any input.
 *
 * `placed` is returned in INPUT order, not packing order: `placed[i]` is the position of
 * `items[i]`. The packing order (see `decreasingHeight`) is internal, and callers map
 * results back by index (districts.ts reads `placed[fileKids.length + i]` for child i).
 *
 * The target row width is SEARCHED rather than computed (Phase 2c, I2 / defect 4(a)): a
 * gutter-aware sqrt reaches 1.000 only for equal leaf items, and at the upper levels the
 * packed items are heterogeneous nested boxes. The packing rule is fixed and only the width
 * at which rows break is chosen, by trying candidates across the feasible range and keeping
 * the one closest to square. Deterministic by construction: the candidate set is a fixed
 * arithmetic sweep of a range derived only from the items, evaluated in a fixed order, and
 * a tie keeps the earlier (narrower) candidate. No randomness, no time.
 */
export function pack(items: readonly Footprint[]): Packed {
  if (items.length === 0) return { width: 0, footprintZ: 0, placed: [] };
  const order = decreasingHeight(items);
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
      const { width, footprintZ } = measureAt(items, order, target);
      const penalty = aspectPenalty(width, footprintZ);
      // Strictly better, so a tie keeps the narrower candidate -- the tie-break is what
      // makes the sweep's result independent of evaluation order.
      if (penalty < bestPenalty) { bestPenalty = penalty; bestTarget = target; }
    }
    low = Math.max(widestItem, bestTarget - step);
    high = bestTarget + step;
  }
  return placeAt(items, order, bestTarget);
}
