// Part 6 Y29 (ruling R7): this leaf's view of the imported fallow evidence for the bound
// codebase. The report itself lives in the plugin's ONE session-only EvidenceRepository
// (Y28), shared by every leaf. This store mirrors the bound codebase's entry and follows
// every change to it, so an import in one leaf shows at once in every leaf on the same
// codebase. It never keeps a copy of its own that could diverge from the port: attach and
// remove go through it.
//
// A setup store, unlike its siblings: `onScopeDispose` is how `$dispose()` (called by
// unwireDataPorts when the leaf closes) drops the listener on the shared repository, which
// outlives every leaf.
import { defineStore } from 'pinia';
import { onScopeDispose, ref, shallowRef } from 'vue';
import type { EvidenceReport } from '../../application/evidence/model';
import type { EvidenceRepository } from '../../application/ports/evidence-repository';

export const useEvidenceStore = defineStore('evidence', () => {
  /** `''` until App binds the leaf to a snapshot's codebase. */
  const repositoryId = ref('');
  /** Shallow: the report is immutable and shared by every leaf. It stays the port's own
   *  object, never a reactive copy, so the read-model memos can key on it (E53). */
  const report = shallowRef<EvidenceReport | null>(null);
  /** Y39: raised by the `import-analysis-report` command; SourcesScreen consumes it (Task 10). */
  const importRequested = ref(false);
  /** WP-03 N15: a fingerprint Architecture asked Quality to open (the `requestImport`
   *  pattern); QualityScreen consumes it on mount. */
  const findingReviewRequest = ref<string | null>(null);
  let repository: EvidenceRepository | null = null;
  let unsubscribe: (() => void) | null = null;

  function refresh(): void {
    report.value = repository !== null && repositoryId.value !== '' ? repository.get(repositoryId.value) : null;
  }
  /** Listens to the bound codebase only. The previous listener is dropped first (a rebind). */
  function listen(): void {
    unsubscribe?.();
    unsubscribe = null;
    const id = repositoryId.value;
    if (repository === null || id === '') return;
    unsubscribe = repository.subscribe((changed) => { if (changed === id) refresh(); });
  }
  /** The plugin's shared repository, set by wireDataPorts before mount. */
  function setRepository(next: EvidenceRepository): void {
    repository = next;
    listen();
    refresh();
  }
  /** Bound by App's repository watcher, next to report and review. An import request made
   *  for the previous codebase is dropped with it. Binding the bound id again is a no-op. */
  function bindRepository(id: string): void {
    if (id === repositoryId.value) return;
    repositoryId.value = id;
    importRequested.value = false;
    findingReviewRequest.value = null;
    listen();
    refresh();
  }
  /** Attaches the report to the bound codebase, replacing any earlier one. False while unbound. */
  function attach(next: EvidenceReport): boolean {
    if (repository === null || repositoryId.value === '') return false;
    repository.put(repositoryId.value, next);
    refresh();
    return true;
  }
  /** Removes the bound codebase's report. False when there is none (E17: nothing to announce). */
  function remove(): boolean {
    if (repository === null || repositoryId.value === '' || report.value === null) return false;
    repository.remove(repositoryId.value);
    refresh();
    return true;
  }
  function requestImport(): void {
    importRequested.value = true;
  }
  /** True exactly once per request. */
  function consumeImportRequest(): boolean {
    if (!importRequested.value) return false;
    importRequested.value = false;
    return true;
  }
  /** WP-03 N15: Architecture's cycle and violation rows call this, then navigate to
   *  Quality, which opens the review dialog on that fingerprint (or nothing, if the
   *  finding is no longer listed). PF14: arrow-function members. */
  const requestFindingReview = (fingerprint: string): void => {
    findingReviewRequest.value = fingerprint;
  };
  /** The pending fingerprint, or null. Cleared whether or not it is still listed: it is
   *  consumed exactly once either way, like consumeImportRequest. */
  const consumeFindingReviewRequest = (): string | null => {
    const fingerprint = findingReviewRequest.value;
    findingReviewRequest.value = null;
    return fingerprint;
  };
  onScopeDispose(() => {
    unsubscribe?.();
    unsubscribe = null;
  });
  return {
    repositoryId, report, importRequested, setRepository, bindRepository, attach, remove, requestImport, consumeImportRequest,
    requestFindingReview, consumeFindingReviewRequest,
  };
});
