// Part 6 Y40: drives CityRendererPort.setReported from the lens. CityViewport.vue is at
// 400/400 and is not edited: this composable, used by CityStage.vue, reads the SAME shared
// handle CityViewport writes (renderer-handle.ts). A context-loss rebuild, a 320 px floor
// round trip, a pop-out migration and leaving list mode each construct a NEW renderer,
// which starts in category colours, so the set is re-sent whenever the handle changes.
// The renderer itself keeps the set across setColors and setLayout, so neither the theme
// refresh (city-view.ts's handle watcher, css-change) nor CityViewport's layout re-send can
// undo it, in whichever order those watchers run.
import { watch } from 'vue';
import type { EntityId } from '../../../domain/entity-id';
import type { CityRendererPort } from '../../../visualization/renderer-port';
import { useCityRendererHandle } from '../../renderer-handle';
import { useLensView } from '../../read-models/use-lens-view';

type Sources = readonly [CityRendererPort | null, ReadonlySet<EntityId> | null];
type PreviousSources = readonly [(CityRendererPort | null)?, (ReadonlySet<EntityId> | null)?];

/** A fresh renderer is already in category colours, so null is sent only to undo a set on
 *  the SAME renderer — never as a command to every new one (which also keeps renderer
 *  doubles that never see the lens free of it). */
function applyReported([renderer, ids]: Sources, [previousRenderer, previousIds]: PreviousSources): void {
  if (!renderer) return;
  if (ids === null && (renderer !== previousRenderer || !previousIds)) return;
  renderer.setReported(ids);
}

export function useLensRenderer(): void {
  const handle = useCityRendererHandle();
  const { reported } = useLensView();
  watch([() => handle.value, reported], applyReported, { immediate: true });
}
