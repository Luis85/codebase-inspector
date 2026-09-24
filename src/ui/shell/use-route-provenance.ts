// Spec §9 A11 / Part 2 §4: the shell-level "Includes sample data" badge. True whenever the
// screen on show displays any sample-backed value. Workbench, Data & scans and Settings
// show none (Part 4 W16).
import { computed, type ComputedRef } from 'vue';
import { isSampleBacked } from '../evidence';
import { useReadModels } from '../read-models/use-read-models';
import { useCityStore } from '../stores/city-store';

export function useRouteProvenance(): ComputedRef<boolean> {
  const store = useCityStore();
  const {
    overview, citySummary, fileDetail, testConfidence, dependencies, security, filesUseSample,
    ownership,
  } = useReadModels();
  return computed(() => {
    if (!store.snapshot) return false;
    switch (store.route) {
      case 'overview': return overview.value?.usesSample ?? false;
      case 'city': return citySummary.value.some((c) => isSampleBacked(c.value));
      // WP-03 JF5: Architecture is built from fallow's evidenced imports, never sample.
      case 'architecture': return false;
      case 'hotspots': return filesUseSample.value;
      case 'file': return fileDetail.value?.usesSample ?? false;
      // Part 6 Y33: findings are imported fallow evidence or Not analysed, never sample.
      case 'quality': return false;
      case 'tests': return testConfidence.value?.usesSample ?? false;
      case 'dependencies': return dependencies.value?.usesSample ?? false;
      case 'security': return security.value.usesSample;
      // Part 3 Q10: activity and coupling are always sample (EvolutionModel.usesSample is `true`).
      case 'evolution': return true;
      // The `!store.snapshot` guard above already covers the null case.
      case 'ownership': return ownership.value.usesSample;
      // Part 4 W16: work items are the reviewer's own records, not sample values.
      case 'workbench': return false;
      // Part 4 W16: the report quotes the Overview, Hotspots and Security sample values.
      case 'report': return true;
      // Part 4 W16: scope facts and provider states, not sample values.
      case 'sources': return false;
      // Part 4 W16: display preferences and stated policies, not sample values.
      case 'settings': return false;
      default: return false;
    }
  });
}
