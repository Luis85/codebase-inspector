// WP-03 N30/N31: the city Relations state, one per leaf (each CityView has its own Pinia),
// a setup store like lens-store.ts. Session state only: nothing here reaches CityViewState,
// getState() or data.json. It resets to its defaults the moment the bound codebase changes
// or its evidence goes away, and a new selection clears the highlighted cycle — both
// `flush: 'sync'`, so no render and no renderer command ever sees the old value.
import { defineStore } from 'pinia';
import { ref, watch } from 'vue';
import type { EntityId } from '../../domain/entity-id';
import { useCityStore } from './city-store';
import { useEvidenceStore } from './evidence-store';

export type RelationControlDirection = 'both' | 'out' | 'in';
const DIRECTIONS: readonly RelationControlDirection[] = ['both', 'out', 'in'];

export const useRelationsStore = defineStore('relations', () => {
  const city = useCityStore();
  const evidence = useEvidenceStore();
  const direction = ref<RelationControlDirection>('both');
  const hops = ref<1 | 2>(1);
  const showArcs = ref(true);
  /** A CycleView's findingId, or null. */
  const highlightedCycleId = ref<string | null>(null);

  // PF14: arrow-function members. Each setter ignores a value outside its type.
  const setDirection = (d: RelationControlDirection): void => {
    if (DIRECTIONS.includes(d)) direction.value = d;
  };
  const setHops = (h: 1 | 2): void => {
    if (h === 1 || h === 2) hops.value = h;
  };
  const setShowArcs = (v: boolean): void => {
    if (typeof v === 'boolean') showArcs.value = v;
  };
  const highlightCycle = (id: string | null): void => {
    highlightedCycleId.value = id;
  };
  const reset = (): void => {
    direction.value = 'both';
    hops.value = 1;
    showArcs.value = true;
    highlightedCycleId.value = null;
  };

  /** N30, J15: select the anchor first (the selection watcher below clears the highlight,
   *  so the highlight must come after it), then highlight, then open the city. Selection
   *  never moves the camera, and neither does this. */
  const showCycleInCity = (cycleId: string, anchorId: EntityId): void => {
    city.select(anchorId);
    highlightedCycleId.value = cycleId;
    city.navigate('city');
  };

  watch(
    [() => evidence.repositoryId, () => evidence.report !== null],
    ([repositoryId, hasEvidence], [previousRepositoryId]) => {
      if (repositoryId !== previousRepositoryId || !hasEvidence) reset();
    },
    { flush: 'sync' },
  );
  watch(() => city.selectedEntityId, () => { highlightedCycleId.value = null; }, { flush: 'sync' });

  // WP-03 E19: `reset` stays private — only the watcher above calls it, and a returned
  // member nothing reads is a new `npm run analyze` finding (N40's baseline wins).
  return {
    direction, hops, showArcs, highlightedCycleId,
    setDirection, setHops, setShowArcs, highlightCycle, showCycleInCity,
  };
});
