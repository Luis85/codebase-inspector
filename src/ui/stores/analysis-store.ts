// Part 7 Z28: this leaf's view of the plugin's ONE FallowAnalysisService, for the bound
// codebase. A setup store (like evidence-store.ts): `onScopeDispose` is how `$dispose()`
// (unwireDataPorts, when the leaf closes) drops the listener on the service, which outlives
// every leaf. The store never runs anything itself: every action is the service's.
// PF14: the actions screens destructure are arrow-function properties, never methods.
import { defineStore } from 'pinia';
import { computed, onScopeDispose, ref, shallowRef } from 'vue';
import type { CodebaseSnapshot } from '../../domain/model';
import { IDLE, isActive, isCancellable, type AnalysisRunState } from '../../application/analysis/analysis-state';
import type {
  AnalyzerBindingView, FallowAnalysisService, ReviewResult, RunReview, StartOutcome,
} from '../../application/analysis/fallow-analysis-service';

export const useAnalysisStore = defineStore('fallow-analysis', () => {
  const repositoryId = ref('');
  const run = shallowRef<AnalysisRunState>(IDLE);
  /** null until the first read for the bound codebase lands. */
  const binding = shallowRef<AnalyzerBindingView | null>(null);
  /** Z35: raised by the `run-fallow-analysis` command; SourcesScreen consumes it. */
  const runRequested = ref(false);
  const active = computed(() => isActive(run.value));
  const cancellable = computed(() => isCancellable(run.value));
  let service: FallowAnalysisService | null = null;
  let unsubscribe: (() => void) | null = null;
  let readTicket = 0;

  const refreshRun = (): void => {
    run.value = service !== null && repositoryId.value !== '' ? service.stateOf(repositoryId.value) : IDLE;
  };
  /** A read that lands after a rebind is dropped (the ticket moved on). */
  const refreshBinding = async (): Promise<void> => {
    const id = repositoryId.value;
    const current = service;
    readTicket += 1;
    const ticket = readTicket;
    if (current === null || id === '') { binding.value = null; return; }
    const view = await current.readBinding(id);
    if (ticket === readTicket && id === repositoryId.value) binding.value = view;
  };
  const refreshQuietly = (): void => { void refreshBinding().catch(() => { binding.value = null; }); };
  const listen = (): void => {
    unsubscribe?.();
    unsubscribe = null;
    const id = repositoryId.value;
    if (service === null || id === '') return;
    unsubscribe = service.subscribe((changed) => {
      if (changed !== id) return;
      refreshRun();
      refreshQuietly();
    });
  };
  const setService = (next: FallowAnalysisService): void => {
    service = next;
    listen();
    refreshRun();
    refreshQuietly();
  };
  /** Bound by App's repository watcher. A run request for the previous codebase is dropped. */
  const bindRepository = (id: string): void => {
    if (id === repositoryId.value) return;
    repositoryId.value = id;
    runRequested.value = false;
    binding.value = null;
    listen();
    refreshRun();
    refreshQuietly();
  };
  const requestRun = (): void => {
    runRequested.value = true;
  };
  const consumeRunRequest = (): boolean => {
    if (!runRequested.value) return false;
    runRequested.value = false;
    return true;
  };
  /** K39: the service and codebase to act on, or null while unbound or for another codebase. */
  const target = (snapshot: CodebaseSnapshot): { service: FallowAnalysisService; id: string } | null => {
    const id = repositoryId.value;
    return service === null || id === '' || snapshot.repositoryId !== id ? null : { service, id };
  };
  const review = async (snapshot: CodebaseSnapshot, path: string): Promise<ReviewResult | null> => {
    const t = target(snapshot);
    return t === null ? null : t.service.review(t.id, snapshot, path);
  };
  const startOrReview = async (snapshot: CodebaseSnapshot): Promise<StartOutcome | null> => {
    const t = target(snapshot);
    return t === null ? null : t.service.run(t.id, snapshot);
  };
  const trustAndRun = async (snapshot: CodebaseSnapshot, reviewed: RunReview): Promise<StartOutcome | null> => {
    const t = target(snapshot);
    return t === null ? null : t.service.trustAndRun(t.id, snapshot, reviewed);
  };
  /** Only a probing or running analysis; false otherwise (nothing to announce, E17). */
  const cancel = (): boolean => {
    if (service === null || repositoryId.value === '' || !cancellable.value) return false;
    service.cancel(repositoryId.value);
    return true;
  };
  /** True when the executable was forgotten; false while a run is in flight or unbound. A
   *  data.json failure (the service's AnalyzerStoreError) REJECTS: the caller's
   *  useBusyAction surfaces it, so a failed Forget is never mistaken for "busy". */
  const forget = async (): Promise<boolean> => {
    const id = repositoryId.value;
    if (service === null || id === '') return false;
    const result = await service.forget(id);
    await refreshBinding();
    return result === 'forgotten';
  };
  onScopeDispose(() => {
    unsubscribe?.();
    unsubscribe = null;
  });
  return {
    repositoryId, run, binding, runRequested, active, cancellable,
    setService, bindRepository, refreshBinding, requestRun, consumeRunRequest, review, startOrReview, trustAndRun, cancel, forget,
  };
});
