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
  /** null until the first read for the bound codebase lands, or after a failed one (`readFailed`). */
  const binding = shallowRef<AnalyzerBindingView | null>(null);
  /** Polish C1: the last read of the binding failed (data.json unreadable). `binding` null with
   *  `readFailed` false means "not read yet". */
  const readFailed = ref(false);
  /** Polish C1 (K41 amended, L2): from the service itself, so the path hint never waits for
   *  (or depends on) a binding read. */
  const executableName = shallowRef<'fallow.exe' | 'fallow' | null>(null);
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
  /** A read that lands after a rebind is dropped (the ticket moved on). Polish C1: a failed read
   *  is kept as `readFailed`, never folded into "no executable chosen". It never rejects. */
  const refreshBinding = async (): Promise<void> => {
    const id = repositoryId.value;
    const current = service;
    readTicket += 1;
    const ticket = readTicket;
    if (current === null || id === '') { binding.value = null; readFailed.value = false; return; }
    const still = (): boolean => ticket === readTicket && id === repositoryId.value;
    try {
      const view = await current.readBinding(id);
      if (still()) { binding.value = view; readFailed.value = false; }
    } catch {
      if (still()) { binding.value = null; readFailed.value = true; }
    }
  };
  const refreshQuietly = (): void => { void refreshBinding(); };
  const listen = (): void => {
    unsubscribe?.();
    unsubscribe = null;
    const id = repositoryId.value;
    if (service === null || id === '') return;
    const offRun = service.subscribe((changed) => {
      if (changed !== id) return;
      refreshRun();
      refreshQuietly();
    });
    // Final review: a Forget or a time limit set in Settings (or in another leaf) writes
    // data.json without a run event; the binding is read again for this codebase only.
    const offBinding = service.onBindingChanged((changed) => { if (changed === id) refreshQuietly(); });
    unsubscribe = () => { offRun(); offBinding(); };
  };
  const setService = (next: FallowAnalysisService): void => {
    service = next;
    executableName.value = next.executableName;
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
    readFailed.value = false;
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
  /** The service's answer (final review: `busy` and `removed` are said, not dropped); null while
   *  unbound. A data.json failure (the service's AnalyzerStoreError) REJECTS: the caller's
   *  useBusyAction surfaces it, so a failed Forget is never mistaken for "busy". Polish C11:
   *  the re-read after it never rejects (a failed one is `readFailed`), so a Forget that
   *  happened is never reported as failed. */
  const forget = async (): Promise<'forgotten' | 'busy' | 'removed' | null> => {
    const id = repositoryId.value;
    if (service === null || id === '') return null;
    const result = await service.forget(id);
    await refreshBinding();
    return result;
  };
  onScopeDispose(() => {
    unsubscribe?.();
    unsubscribe = null;
  });
  return {
    repositoryId, run, binding, readFailed, executableName, runRequested, active, cancellable,
    setService, bindRepository, requestRun, consumeRunRequest, review, startOrReview, trustAndRun, cancel, forget,
  };
});
