// Part 6 Y40: the city's colour lens, one per leaf (each CityView has its own Pinia).
// 'category' is the WP-01 colouring; 'findings' is the S15 findings lens, which needs
// imported evidence. A SETUP store, unlike its siblings, for one reason: it watches the
// evidence store, so the lens resets to 'category' the moment the bound codebase changes
// or its evidence goes away — whichever screen is open, not only while the toolbar that
// sets it is mounted. `flush: 'sync'` makes the reset part of the same call that removed
// the evidence, so no render and no renderer command ever sees the lens on without it.
// city-store's select, setQuery and setCamera are untouched (spec §6).
import { defineStore } from 'pinia';
import { ref, watch } from 'vue';
import { useEvidenceStore } from './evidence-store';

export type LensId = 'category' | 'findings';
export const LENS_IDS: readonly LensId[] = ['category', 'findings'];

export const useLensStore = defineStore('lens', () => {
  const evidence = useEvidenceStore();
  const lens = ref<LensId>('category');

  /** Ignores an unknown id, and refuses 'findings' while there is no evidence: the control
   *  that offers it is not rendered then, so nothing legitimate asks. */
  function setLens(next: LensId): void {
    if (!LENS_IDS.includes(next)) return;
    if (next === 'findings' && evidence.report === null) return;
    lens.value = next;
  }

  function reset(): void {
    lens.value = 'category';
  }

  watch(
    [() => evidence.repositoryId, () => evidence.report !== null],
    ([repositoryId, hasEvidence], [previousRepositoryId]) => {
      if (repositoryId !== previousRepositoryId || !hasEvidence) reset();
    },
    { flush: 'sync' },
  );

  return { lens, setLens, reset };
});
