// WP-03 N28/N30/N31: drives CityRendererPort.setRelations from the city Relations view, the
// use-lens-renderer.ts pattern. CityViewport.vue is at 400/400 and is not edited: this
// composable, used by CityStage.vue, reads the SAME shared handle CityViewport writes. A
// context-loss rebuild, a 320 px floor round trip, a pop-out migration and leaving list mode
// each construct a NEW renderer, which starts with no arcs, so the arcs are re-sent whenever
// the handle changes. In list mode there is no renderer (M75), so nothing is sent.
import { watch } from 'vue';
import type { CityRendererPort, RelationArc } from '../../../visualization/renderer-port';
import { useCityRendererHandle } from '../../renderer-handle';
import { useCityRelations } from '../../read-models/use-city-relations';

type Arcs = readonly RelationArc[] | null;
type Sources = readonly [CityRendererPort | null, Arcs];
type PreviousSources = readonly [(CityRendererPort | null)?, Arcs?];

/** A fresh renderer already has no arcs, so null is sent only to clear arcs on the SAME
 *  renderer — never as a command to every new one. */
function applyArcs([renderer, arcs]: Sources, [previousRenderer, previousArcs]: PreviousSources): void {
  if (!renderer) return;
  if (arcs === null && (renderer !== previousRenderer || !previousArcs)) return;
  renderer.setRelations(arcs);
}

export function useRelationRenderer(): void {
  const handle = useCityRendererHandle();
  const view = useCityRelations();
  watch([() => handle.value, () => view.value.arcs], applyArcs, { immediate: true });
}
