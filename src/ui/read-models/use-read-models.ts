import { computed } from 'vue';
import { useCityStore } from '../stores/city-store';
import { fileSummariesFor } from './file-summaries';
import { buildOverviewModel } from './overview';
import { buildCitySummary } from './city-summary';

/** Screens read models through here only (spec §3.2 rule 1). */
export function useReadModels() {
  const store = useCityStore();
  const files = computed(() => (store.snapshot ? fileSummariesFor(store.snapshot) : []));
  const overview = computed(() => (store.snapshot ? buildOverviewModel(store.snapshot, files.value) : null));
  const citySummary = computed(() => buildCitySummary(files.value));
  return { files, overview, citySummary };
}
