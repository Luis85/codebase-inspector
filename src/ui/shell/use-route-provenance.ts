// Spec §9 A11 / Part 2 §4: the shell-level "Includes sample data" badge. True whenever the
// screen on show displays any sample-backed value. Placeholder routes show none.
import { computed, type ComputedRef } from 'vue';
import { isSampleBacked } from '../evidence';
import { useReadModels } from '../read-models/use-read-models';
import { useCityStore } from '../stores/city-store';

export function useRouteProvenance(): ComputedRef<boolean> {
  const store = useCityStore();
  const { overview, citySummary, architecture, fileDetail, filesUseSample } = useReadModels();
  return computed(() => {
    if (!store.snapshot) return false;
    switch (store.route) {
      case 'overview': return overview.value?.usesSample ?? false;
      case 'city': return citySummary.value.some((c) => isSampleBacked(c.value));
      case 'architecture': return architecture.value.usesSample;
      case 'hotspots': return filesUseSample.value;
      case 'file': return fileDetail.value?.usesSample ?? false;
      default: return false;
    }
  });
}
