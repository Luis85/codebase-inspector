/** GRA1: root district occupancy, as the F2 note words it (docs/superpowers/notes/2026-09-21-wp01b-open-decisions.md
 *  §1): "own area" is the root district's extent INCLUDING its 2 × DISTRICT_PADDING border; "used area" is the sum
 *  of the root's direct items, i.e. its own file lots (by their ground dimensions) plus its child districts' extents.
 *  Returned as a percentage, 0–100. */
import type { LayoutResult } from '../../src/domain/layout/types';

export function rootOccupancy(layout: LayoutResult): number {
  const root = layout.districts.find((d) => d.parentId === null);
  if (!root) return 0;
  const own = root.extent[0] * root.extent[1];
  if (!(own > 0)) return 0;
  let used = 0;
  for (const lot of layout.lots) {
    if (lot.directoryId === root.directoryId) used += lot.dimensions[0] * lot.dimensions[2];
  }
  for (const d of layout.districts) {
    if (d.parentId === root.directoryId) used += d.extent[0] * d.extent[1];
  }
  return (used / own) * 100;
}
