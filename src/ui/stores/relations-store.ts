// WP-03 N30/N31: the city Relations state, one per leaf (each CityView has its own Pinia),
// a setup store like lens-store.ts. J15/JF23: Task 9 creates this STUB, holding only what
// Architecture's Show in city needs — `highlightedCycleId` and `showCycleInCity`; Task 12
// completes it (direction, hops, showArcs, the setters, the reset watchers). Session state
// only: nothing here reaches CityViewState, getState() or data.json.
import { defineStore } from 'pinia';
import { ref } from 'vue';
import type { EntityId } from '../../domain/entity-id';
import { useCityStore } from './city-store';

export const useRelationsStore = defineStore('relations', () => {
  const city = useCityStore();
  /** A CycleView's findingId, or null. */
  const highlightedCycleId = ref<string | null>(null);

  /** N30: select the anchor first (Task 12's selection watcher clears the highlight, so the
   *  highlight must come after it), then highlight, then open the city. Selection never
   *  moves the camera, and neither does this. PF14: an arrow-function member. */
  const showCycleInCity = (cycleId: string, anchorId: EntityId): void => {
    city.select(anchorId);
    highlightedCycleId.value = cycleId;
    city.navigate('city');
  };

  return { highlightedCycleId, showCycleInCity };
});
