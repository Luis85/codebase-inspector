import { computed } from 'vue';
import type { EntityId } from '../../domain/entity-id';
import type { CodebaseSnapshot } from '../../domain/model';
import { useCityStore } from '../stores/city-store';
import { useReviewStore } from '../stores/review-store';
import { isSampleBacked, type MetricValue } from '../evidence';
import { fileSummariesFor, type FileSummary } from './file-summaries';
import { buildOverviewModel, type OverviewModel } from './overview';
import { buildCitySummary } from './city-summary';
import { architectureGraphFor, buildArchitectureModel, cyclesValue, type ArchitectureGraph } from './architecture';
import { buildFileDetail, type FileDetailModel } from './file-detail';

/** One stable empty array, so the per-array memo (architectureGraphFor) still hits. */
const NO_FILES: readonly FileSummary[] = [];

/** Final review F1: every leaf calls useReadModels() more than once (the screen and the
 *  shell's provenance badge), so the per-snapshot models are memoized here rather than
 *  rebuilt by each caller's own computed. Keys are the immutable per-snapshot objects. */
const cyclesCache = new WeakMap<ArchitectureGraph, MetricValue>();
function cyclesFor(graph: ArchitectureGraph): MetricValue {
  let hit = cyclesCache.get(graph);
  if (!hit) { hit = cyclesValue(graph); cyclesCache.set(graph, hit); }
  return hit;
}

const overviewCache = new WeakMap<readonly FileSummary[], { snapshot: CodebaseSnapshot; cycles: MetricValue; model: OverviewModel }>();
export function overviewModelFor(snapshot: CodebaseSnapshot, files: readonly FileSummary[], cycles: MetricValue): OverviewModel {
  const hit = overviewCache.get(files);
  if (hit && hit.snapshot === snapshot && hit.cycles === cycles) return hit.model;
  const model = buildOverviewModel(snapshot, files, cycles);
  overviewCache.set(files, { snapshot, cycles, model });
  return model;
}

const detailCache = new WeakMap<readonly FileSummary[], { snapshot: CodebaseSnapshot; byId: Map<EntityId, FileDetailModel | null> }>();
export function fileDetailFor(snapshot: CodebaseSnapshot, files: readonly FileSummary[], entityId: EntityId | null): FileDetailModel | null {
  if (!entityId) return null;
  let entry = detailCache.get(files);
  if (!entry || entry.snapshot !== snapshot) { entry = { snapshot, byId: new Map() }; detailCache.set(files, entry); }
  if (!entry.byId.has(entityId)) entry.byId.set(entityId, buildFileDetail(snapshot, files, entityId));
  return entry.byId.get(entityId) ?? null;
}

/** Screens read models through here only (spec §3.2 rule 1). */
export function useReadModels() {
  const store = useCityStore();
  const review = useReviewStore();
  const files = computed(() => (store.snapshot ? fileSummariesFor(store.snapshot) : NO_FILES));
  const graph = computed(() => architectureGraphFor(files.value));
  const cycles = computed(() => cyclesFor(graph.value));
  const overview = computed(() => (store.snapshot ? overviewModelFor(store.snapshot, files.value, cycles.value) : null));
  const citySummary = computed(() => buildCitySummary(files.value, cycles.value));
  const architecture = computed(() => buildArchitectureModel(graph.value, review.rules));
  const fileDetail = computed(() => (store.snapshot ? fileDetailFor(store.snapshot, files.value, store.selectedEntityId) : null));
  /** A11: the Hotspots screen shows sample values whenever any file's plotted signal does. */
  const filesUseSample = computed(() => files.value.some((f) => isSampleBacked(f.priority) || isSampleBacked(f.complexity)));
  return { files, overview, citySummary, architecture, fileDetail, filesUseSample };
}
