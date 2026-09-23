// Part 7 Z32/Z33/Z35: the run controls behind the fallow card AND the "Run fallow analysis"
// command, in one place, so both behave the same. A start goes through the analysis store;
// `review` and `choose-executable` open the installed route; a refusal is held for the banner
// and announced. A run's end is NOT announced here: the card's banner (role="status", C16)
// is its one announcement (Z33, E17; review ruling). Its element stays mounted from probing
// to the end, so the ending is a text change the screen reader reads once.
// - PF15: the refusal belongs to the attempt it answered; a new run id clears it.
// - The store rejects on a data.json read or write failure (Task 9). Run and Forget catch it
//   through a busy action, which also ignores a second press while one is pending; the
//   failure is shown in the banner (`failure`) and announced, never thrown.
// - PF14: the members SourcesScreen destructures are arrow-function properties.
import { ref, watch, type Ref } from 'vue';
import { useCityStore } from '../../stores/city-store';
import { useAnalysisStore } from '../../stores/analysis-store';
import { useBusyAction } from '../../kit/use-busy-action';
import type { AnalysisRunState, FallowRunErrorCode, InstalledRouteStart } from '../../read-models/fallow-run';
import { FALLOW_EXE_FORGET_FAILED, FALLOW_EXE_FORGOTTEN, FALLOW_RUN_ERROR, FALLOW_RUN_START_FAILED } from '../../inspector-copy';

export type FallowRunRefusal = { code: FallowRunErrorCode; detail: string };

export interface FallowRunControls {
  refusal: Ref<FallowRunRefusal | null>;
  /** A Run or a Forget that threw; '' when there is none. */
  failure: Ref<string>;
  run: () => Promise<void>;
  cancel: () => void;
  forget: () => Promise<void>;
}

function runIdOf(state: AnalysisRunState): string {
  if ('runId' in state) return state.runId;
  return 'identity' in state ? state.identity.runId : '';
}

export function useFallowRun(open: (start: InstalledRouteStart) => void, announce: (message: string) => void): FallowRunControls {
  const city = useCityStore();
  const analysis = useAnalysisStore();
  const refusal = ref<FallowRunRefusal | null>(null);
  const { busy, error: failure, run: guarded } = useBusyAction();
  let seen = runIdOf(analysis.run);
  const clear = (): void => {
    refusal.value = null;
    failure.value = '';
  };

  watch(() => analysis.repositoryId, () => {
    clear();
    seen = runIdOf(analysis.run);
  });
  watch(() => analysis.run, (state) => {
    const id = runIdOf(state);
    if (id !== '' && id !== seen) { seen = id; clear(); }
  });

  /** The failure, if any, is announced only while the codebase it concerns is still bound. */
  const settle = (repositoryId: string): boolean => {
    if (analysis.repositoryId !== repositoryId) { clear(); return false; }
    if (failure.value !== '') announce(failure.value);
    return failure.value === '';
  };

  const run = async (): Promise<void> => {
    const snapshot = city.snapshot;
    if (!snapshot || analysis.active || busy.value) return;
    const repositoryId = analysis.repositoryId;
    refusal.value = null;
    await guarded(async () => {
      const outcome = await analysis.startOrReview(snapshot);
      // Part 6 E36: a codebase switch while the check ran drops the answer.
      if (outcome === null || city.snapshot?.snapshotId !== snapshot.snapshotId) return;
      if (outcome.kind === 'review') open({ startAt: 'review', review: outcome.review, reason: outcome.reason });
      else if (outcome.kind === 'choose-executable') open({ startAt: 'path' });
      else if (outcome.kind === 'refused') {
        refusal.value = { code: outcome.code, detail: outcome.detail };
        announce(FALLOW_RUN_ERROR[outcome.code](outcome.detail));
      }
    }, FALLOW_RUN_START_FAILED);
    settle(repositoryId);
  };
  const cancel = (): void => {
    analysis.cancel();
  };
  const forget = async (): Promise<void> => {
    if (analysis.active || busy.value) return;
    const repositoryId = analysis.repositoryId;
    refusal.value = null;
    let forgotten = false;
    await guarded(async () => { forgotten = await analysis.forget(); }, FALLOW_EXE_FORGET_FAILED);
    if (settle(repositoryId) && forgotten) announce(FALLOW_EXE_FORGOTTEN);
  };
  return { refusal, failure, run, cancel, forget };
}
