// WP-03 N17, N30: the city Relations section's pure read model. The rows are the selected
// file's evidenced neighbourhood (N17, limit RELATION_ARC_LIMIT), and the arcs sent to the
// renderer are EXACTLY those rows — or, while a cycle through the file is highlighted, that
// cycle's hops (role `cycle`), capped at the same limit with the rest counted. So every arc
// has a text row (the canvas is aria-hidden). Stale evidence still gives rows and arcs
// (Review Focus 5); a highlighted id that no longer names a drawable cycle through the file
// gives no highlight and the neighbourhood arcs (Review Focus 4).
import type { EntityId } from '../../domain/entity-id';
import { neighbourhood, type NeighbourEdge } from '../../domain/relations/queries';
import type { RelationArc } from '../../visualization/renderer-port';
import type { RelationControlDirection } from '../stores/relations-store';
import type { EvidenceIndexState } from './evidence-index';
import { RELATION_ARC_LIMIT, type CycleView, type RelationModel, type RelationSource } from './relations';

export interface CityRelationRow {
  readonly otherId: EntityId; readonly otherPath: string; readonly direction: 'in' | 'out';
  readonly hop: 1 | 2; readonly line: number | null; readonly sources: readonly RelationSource[];
}
export interface CityRelationsView {
  readonly state: EvidenceIndexState; readonly rows: readonly CityRelationRow[]; readonly hidden: number;
  readonly cycles: readonly CycleView[]; readonly highlighted: CycleView | null; readonly highlightHidden: number;
  /** null: no arcs (nothing selected, no evidence, or Show arcs off). */
  readonly arcs: readonly RelationArc[] | null;
}
interface CityRelationControls {
  readonly direction: RelationControlDirection; readonly hops: 1 | 2; readonly showArcs: boolean; readonly highlightedCycleId: string | null;
}

function rowFor(model: RelationModel, e: NeighbourEdge): CityRelationRow {
  const view = model.edge(e.from, e.to);
  const out = e.direction === 'out';
  const otherId = out ? e.to : e.from;
  return {
    otherId, otherPath: (out ? view?.toPath : view?.fromPath) ?? otherId, direction: e.direction, hop: e.hop,
    line: view?.line ?? null, sources: view?.sources ?? [],
  };
}

/** N7/N3: only a fully matched import cycle has hops that are drawn, so only it can be
 *  highlighted; a re-export cycle has no hop order and a partially matched one is never
 *  drawn as if complete. The panel offers Highlight cycle on exactly these. */
export function canHighlight(c: CycleView): boolean {
  return c.kind === 'import' && c.matched && c.hops.length > 0;
}

/** A cycle's hops as arcs, each path mapped to its id through the cycle's own members. */
function cycleArcs(c: CycleView): RelationArc[] {
  const idOf = new Map(c.members.map((m) => [m.path, m.id]));
  const arcs: RelationArc[] = [];
  for (const hop of c.hops) {
    const from = idOf.get(hop.from);
    const to = idOf.get(hop.to);
    if (from && to) arcs.push({ from, to, role: 'cycle' });
  }
  return arcs;
}

export function cityRelationsFor(model: RelationModel, selected: EntityId | null, controls: CityRelationControls): CityRelationsView {
  if (selected === null || model.state === 'none' || !model.analysed) {
    return { state: model.state, rows: [], hidden: 0, cycles: [], highlighted: null, highlightHidden: 0, arcs: null };
  }
  const near = neighbourhood(model.index, selected, { direction: controls.direction, hops: controls.hops, limit: RELATION_ARC_LIMIT });
  const cycles = model.cycles.filter((c) => c.members.some((m) => m.id === selected));
  const highlighted = cycles.find((c) => c.findingId === controls.highlightedCycleId && canHighlight(c)) ?? null;
  const allCycleArcs = highlighted ? cycleArcs(highlighted) : [];
  let arcs: readonly RelationArc[] | null = null;
  if (controls.showArcs && highlighted) arcs = allCycleArcs.slice(0, RELATION_ARC_LIMIT);
  else if (controls.showArcs) arcs = near.edges.map((e) => ({ from: e.from, to: e.to, role: e.direction === 'out' ? 'outgoing' : 'incoming' }));
  return {
    state: model.state, rows: near.edges.map((e) => rowFor(model, e)), hidden: near.hidden, cycles, highlighted,
    highlightHidden: Math.max(0, allCycleArcs.length - RELATION_ARC_LIMIT), arcs,
  };
}
