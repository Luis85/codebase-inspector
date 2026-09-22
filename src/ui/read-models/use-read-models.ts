import { computed, toRaw } from 'vue';
import type { EntityId } from '../../domain/entity-id';
import type { CodebaseSnapshot } from '../../domain/model';
import { useCityStore } from '../stores/city-store';
import { useReviewStore } from '../stores/review-store';
import { isSampleBacked, type MetricValue } from '../evidence';
import { fileSummariesFor, type FileSummary } from './file-summaries';
import { buildOverviewModel, type OverviewModel } from './overview';
import { buildCitySummary } from './city-summary';
import type { BoundaryRule, FindingDisposition } from '../stores/ports/review-repository';
import {
  architectureGraphFor, buildArchitectureModel, cyclesValue, type ArchitectureGraph, type ArchitectureModel,
} from './architecture';
import { buildFileDetail, type FileDetailModel } from './file-detail';
import { buildDependenciesModel, type DependenciesModel } from './dependencies';
import { buildEvolutionModel, type EvolutionModel } from './evolution';
import type { ChangeWindow } from '../fixtures/sample-evolution';
import { SAMPLE_PACKAGES, type SamplePackage } from '../fixtures/sample-packages';
import { buildQualityModel, type QualityModel } from './findings';
import { buildOwnershipModel, type OwnershipModel } from './ownership';
import { buildSecurityModel, type SecurityModel } from './security';
import type { JournalEntry } from './snapshot-comparison';
import { buildTestConfidenceModel, type TestConfidenceModel } from './test-confidence';

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

/** Part 3 §4: one Architecture model per (graph, leaf rule set), shared by every caller in
 *  that leaf. The graph is shared across leaves (one snapshot store) but each leaf has its
 *  own review store, whose rule ids restart at AR-001, so the inner key is the leaf's raw
 *  rules array (final review I1). `addRule` pushes in place, so a signature of every
 *  rendered rule field guards the hit. */
type ArchitectureEntry = { signature: string; model: ArchitectureModel };
const architectureCache = new WeakMap<ArchitectureGraph, WeakMap<object, ArchitectureEntry>>();
const rulesSignature = (rules: readonly BoundaryRule[]): string =>
  JSON.stringify(rules.map((r) => [r.id, r.from, r.to, r.rationale, r.createdAt]));
export function architectureModelFor(graph: ArchitectureGraph, rules: readonly BoundaryRule[]): ArchitectureModel {
  const signature = rulesSignature(rules);
  let byRules = architectureCache.get(graph);
  if (!byRules) { byRules = new WeakMap(); architectureCache.set(graph, byRules); }
  const key: object = toRaw(rules);
  const hit = byRules.get(key);
  if (hit && hit.signature === signature) return hit.model;
  const model = buildArchitectureModel(graph, rules);
  byRules.set(key, { signature, model });
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

const qualityCache = new WeakMap<readonly FileSummary[], { dispositions: readonly FindingDisposition[]; model: QualityModel }>();
/** `review.dispositions` is reassigned on every decision, so its identity is the key. */
export function qualityModelFor(files: readonly FileSummary[], dispositions: readonly FindingDisposition[]): QualityModel {
  const hit = qualityCache.get(files);
  if (hit && hit.dispositions === dispositions) return hit.model;
  const model = buildQualityModel(files, dispositions);
  qualityCache.set(files, { dispositions, model });
  return model;
}

const testsCache = new WeakMap<readonly FileSummary[], { snapshot: CodebaseSnapshot; model: TestConfidenceModel }>();
export function testConfidenceModelFor(snapshot: CodebaseSnapshot, files: readonly FileSummary[]): TestConfidenceModel {
  const hit = testsCache.get(files);
  if (hit && hit.snapshot === snapshot) return hit.model;
  const model = buildTestConfidenceModel(snapshot, files);
  testsCache.set(files, { snapshot, model });
  return model;
}

const dependenciesCache = new WeakMap<CodebaseSnapshot, DependenciesModel>();
export function dependenciesModelFor(snapshot: CodebaseSnapshot): DependenciesModel {
  let hit = dependenciesCache.get(snapshot);
  if (!hit) { hit = buildDependenciesModel(snapshot); dependenciesCache.set(snapshot, hit); }
  return hit;
}

/** Security has no snapshot-derived input (Part 3 Q7). Part 5 V18: built on the first read,
 *  never at module load, and then shared by every leaf (keyed by the package array). */
const securityCache = new WeakMap<readonly SamplePackage[], SecurityModel>();
export function securityModelFor(packages: readonly SamplePackage[]): SecurityModel {
  let hit = securityCache.get(packages);
  if (!hit) { hit = buildSecurityModel(packages); securityCache.set(packages, hit); }
  return hit;
}

/** Part 3 Q8-Q10: one Evolution model per (snapshot, journal identity, changeWindow). The
 *  journal's `entries` array is reassigned on every `record`, so its identity is a valid
 *  key alongside the files array. */
const evolutionCache = new WeakMap<readonly FileSummary[], { snapshot: CodebaseSnapshot; journal: readonly JournalEntry[]; changeWindow: ChangeWindow; model: EvolutionModel }>();
export function evolutionModelFor(
  snapshot: CodebaseSnapshot, files: readonly FileSummary[], journal: readonly JournalEntry[], changeWindow: ChangeWindow,
): EvolutionModel {
  const hit = evolutionCache.get(files);
  if (hit && hit.snapshot === snapshot && hit.journal === journal && hit.changeWindow === changeWindow) return hit.model;
  const model = buildEvolutionModel(snapshot, files, journal, changeWindow);
  evolutionCache.set(files, { snapshot, journal, changeWindow, model });
  return model;
}

const ownershipCache = new WeakMap<readonly FileSummary[], OwnershipModel>();
export function ownershipModelFor(files: readonly FileSummary[]): OwnershipModel {
  let hit = ownershipCache.get(files);
  if (!hit) { hit = buildOwnershipModel(files); ownershipCache.set(files, hit); }
  return hit;
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
  const architecture = computed(() => architectureModelFor(graph.value, review.rules));
  const fileDetail = computed(() => (store.snapshot ? fileDetailFor(store.snapshot, files.value, store.selectedEntityId) : null));
  const quality = computed(() => qualityModelFor(files.value, review.dispositions));
  const testConfidence = computed(() => (store.snapshot ? testConfidenceModelFor(store.snapshot, files.value) : null));
  const dependencies = computed(() => (store.snapshot ? dependenciesModelFor(store.snapshot) : null));
  const security = computed(() => securityModelFor(SAMPLE_PACKAGES));
  const ownership = computed(() => ownershipModelFor(files.value));
  /** A11: the Hotspots screen shows sample values whenever any file's plotted signal does. */
  const filesUseSample = computed(() => files.value.some((f) => isSampleBacked(f.priority) || isSampleBacked(f.complexity)));
  return {
    files, overview, citySummary, architecture, fileDetail, quality, testConfidence, dependencies, security,
    ownership, filesUseSample,
  };
}
