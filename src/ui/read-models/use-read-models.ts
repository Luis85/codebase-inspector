import { computed, toRaw } from 'vue';
import type { EntityId } from '../../domain/entity-id';
import type { CodebaseSnapshot } from '../../domain/model';
import { useCityStore } from '../stores/city-store';
import { useEvidenceStore } from '../stores/evidence-store';
import { useReviewStore } from '../stores/review-store';
import { isSampleBacked, type MetricValue } from '../evidence';
import { fileSummariesFor, type FileSummary } from './file-summaries';
import { buildOverviewModel, type OverviewModel } from './overview';
import { buildCitySummary } from './city-summary';
import { evidenceIndexFor, type EvidenceIndex } from './evidence-index';
import type { BoundaryRule, FindingDisposition } from '../stores/ports/review-repository';
import {
  architectureGraphFor, buildArchitectureModel, cyclesValue, type ArchitectureGraph, type ArchitectureModel,
} from './architecture';
import { buildFileDetail, type FileDetailModel } from './file-detail';
import { relationModelFor, type RelationModel } from './relations';
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

/** Part 6: keyed by the evidence index, which is one object per (files, report), then (E48
 *  I1, E53) by the leaf's raw `dispositions` array, as `qualityModelFor` is: the findings
 *  card and its caption (Polish E2) count open findings, read from that leaf's Quality model. */
type OverviewEntry = { snapshot: CodebaseSnapshot; files: readonly FileSummary[]; cycles: MetricValue; model: OverviewModel };
const overviewCache = new WeakMap<EvidenceIndex, WeakMap<object, OverviewEntry>>();
function overviewModelFor(
  snapshot: CodebaseSnapshot, files: readonly FileSummary[], cycles: MetricValue, evidence: EvidenceIndex,
  dispositions: readonly FindingDisposition[],
): OverviewModel {
  let byDispositions = overviewCache.get(evidence);
  if (!byDispositions) { byDispositions = new WeakMap(); overviewCache.set(evidence, byDispositions); }
  const key: object = toRaw(dispositions);
  const hit = byDispositions.get(key);
  if (hit && hit.snapshot === snapshot && hit.files === files && hit.cycles === cycles) return hit.model;
  const model = buildOverviewModel(snapshot, files, cycles, evidence, qualityModelFor(files, evidence, dispositions));
  byDispositions.set(key, { snapshot, files, cycles, model });
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

type DetailEntry = { snapshot: CodebaseSnapshot; files: readonly FileSummary[]; byId: Map<EntityId, FileDetailModel | null> };
const detailCache = new WeakMap<EvidenceIndex, DetailEntry>();
function fileDetailFor(
  snapshot: CodebaseSnapshot, files: readonly FileSummary[], entityId: EntityId | null, evidence: EvidenceIndex, relations: RelationModel,
): FileDetailModel | null {
  if (!entityId) return null;
  let entry = detailCache.get(evidence);
  if (!entry || entry.snapshot !== snapshot || entry.files !== files) { entry = { snapshot, files, byId: new Map() }; detailCache.set(evidence, entry); }
  if (!entry.byId.has(entityId)) entry.byId.set(entityId, buildFileDetail(snapshot, files, entityId, evidence, relations));
  return entry.byId.get(entityId) ?? null;
}

/** Part 6: one Quality model per (evidence index, leaf dispositions). The index is shared
 *  by every leaf on the codebase. Each leaf has its own review store, whose `dispositions`
 *  array is reassigned on every decision, so its raw identity is the inner key (E53). */
const qualityCache = new WeakMap<EvidenceIndex, WeakMap<object, QualityModel>>();
function qualityModelFor(
  files: readonly FileSummary[], evidence: EvidenceIndex, dispositions: readonly FindingDisposition[],
): QualityModel {
  let byDispositions = qualityCache.get(evidence);
  if (!byDispositions) { byDispositions = new WeakMap(); qualityCache.set(evidence, byDispositions); }
  const key: object = toRaw(dispositions);
  let hit = byDispositions.get(key);
  if (!hit) { hit = buildQualityModel(files, evidence, dispositions); byDispositions.set(key, hit); }
  return hit;
}

const testsCache = new WeakMap<readonly FileSummary[], { snapshot: CodebaseSnapshot; model: TestConfidenceModel }>();
function testConfidenceModelFor(snapshot: CodebaseSnapshot, files: readonly FileSummary[]): TestConfidenceModel {
  const hit = testsCache.get(files);
  if (hit && hit.snapshot === snapshot) return hit.model;
  const model = buildTestConfidenceModel(snapshot, files);
  testsCache.set(files, { snapshot, model });
  return model;
}

const dependenciesCache = new WeakMap<CodebaseSnapshot, DependenciesModel>();
function dependenciesModelFor(snapshot: CodebaseSnapshot): DependenciesModel {
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
function ownershipModelFor(files: readonly FileSummary[]): OwnershipModel {
  let hit = ownershipCache.get(files);
  if (!hit) { hit = buildOwnershipModel(files); ownershipCache.set(files, hit); }
  return hit;
}

/** Screens read models through here only (spec §3.2 rule 1). */
export function useReadModels() {
  const store = useCityStore();
  const review = useReviewStore();
  const evidenceStore = useEvidenceStore();
  const files = computed(() => (store.snapshot ? fileSummariesFor(store.snapshot) : NO_FILES));
  /** Part 6 Y34 (R7): the bound codebase's imported evidence, resolved against these files.
   *  A report bound to another codebase (a switch App has not rebound yet) is never shown. */
  const evidence = computed(() => {
    const snapshot = store.snapshot;
    const report = snapshot && evidenceStore.repositoryId === snapshot.repositoryId ? evidenceStore.report : null;
    return evidenceIndexFor(files.value, report ? toRaw(report) : null, snapshot?.snapshotId ?? '');
  });
  const graph = computed(() => architectureGraphFor(files.value));
  const cycles = computed(() => cyclesFor(graph.value));
  const overview = computed(() => (store.snapshot
    ? overviewModelFor(store.snapshot, files.value, cycles.value, evidence.value, review.dispositions) : null));
  const citySummary = computed(() => buildCitySummary(files.value, cycles.value, evidence.value));
  const architecture = computed(() => architectureModelFor(graph.value, review.rules));
  /** WP-03 N7/N8: fallow's dependency evidence, resolved against these files. */
  const relations = computed(() => relationModelFor(files.value, evidence.value));
  const fileDetail = computed(() => (store.snapshot
    ? fileDetailFor(store.snapshot, files.value, store.selectedEntityId, evidence.value, relations.value) : null));
  const quality = computed(() => qualityModelFor(files.value, evidence.value, review.dispositions));
  const testConfidence = computed(() => (store.snapshot ? testConfidenceModelFor(store.snapshot, files.value) : null));
  const dependencies = computed(() => (store.snapshot ? dependenciesModelFor(store.snapshot) : null));
  const security = computed(() => securityModelFor(SAMPLE_PACKAGES));
  const ownership = computed(() => ownershipModelFor(files.value));
  /** A11: the Hotspots screen shows sample values whenever any file's plotted signal does. */
  const filesUseSample = computed(() => files.value.some((f) => isSampleBacked(f.priority) || isSampleBacked(f.complexity)));
  return {
    files, evidence, overview, citySummary, architecture, fileDetail, quality, testConfidence, dependencies, security,
    ownership, filesUseSample, relations,
  };
}
