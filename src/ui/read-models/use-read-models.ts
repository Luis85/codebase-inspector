import { computed } from 'vue';
import { useCityStore } from '../stores/city-store';
import { useReviewStore } from '../stores/review-store';
import { fileSummariesFor, type FileSummary } from './file-summaries';
import { buildOverviewModel } from './overview';
import { buildCitySummary } from './city-summary';
import { architectureGraphFor, buildArchitectureModel, cyclesValue } from './architecture';

/** One stable empty array, so the per-array memo (architectureGraphFor) still hits. */
const NO_FILES: readonly FileSummary[] = [];

/** Screens read models through here only (spec §3.2 rule 1). */
export function useReadModels() {
  const store = useCityStore();
  const review = useReviewStore();
  const files = computed(() => (store.snapshot ? fileSummariesFor(store.snapshot) : NO_FILES));
  const graph = computed(() => architectureGraphFor(files.value));
  const cycles = computed(() => cyclesValue(graph.value));
  const overview = computed(() => (store.snapshot ? buildOverviewModel(store.snapshot, files.value, cycles.value) : null));
  const citySummary = computed(() => buildCitySummary(files.value, cycles.value));
  const architecture = computed(() => buildArchitectureModel(graph.value, review.rules));
  return { files, overview, citySummary, architecture };
}
