// Part 7 Z32/Z33/Z35: the run controls behind the fallow card AND the "Run fallow analysis"
// command, in one place, so both behave the same. A start goes through the analysis store;
// `review` and `choose-executable` open the installed route; a refusal is held for the banner
// and announced. Each finished run (completed, cancelled, failed) is announced ONCE (E17),
// and a run that had already finished when the screen opened or the codebase changed is not.
// - PF15: the refusal belongs to the attempt it answered; a new run id clears it.
// - The store rejects on a data.json read or write failure (Task 9). Run and Forget catch it
//   through a busy action, which also ignores a second press while one is pending; the
//   failure is shown in the banner (`failure`) and announced, never thrown.
// - PF14: the members SourcesScreen destructures are arrow-function properties.
import { ref, watch, type Ref } from 'vue';
import { useCityStore } from '../../stores/city-store';
import { useAnalysisStore } from '../../stores/analysis-store';
import { useBusyAction } from '../../kit/use-busy-action';
import { fallowRunBannerOf, type AnalysisRunState, type FallowRunErrorCode, type InstalledRouteStart } from '../../read-models/fallow-run';
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
const isFinished = (state: AnalysisRunState): boolean =>
  state.status === 'completed' || state.status === 'cancelled' || state.status === 'failed';
/** A run that had finished before the screen opened (or the codebase changed) is not announced. */
const finishedIdOf = (state: AnalysisRunState): string => (isFinished(state) ? runIdOf(state) : '');

export function useFallowRun(open: (start: InstalledRouteStart) => void, announce: (message: string) => void, hasEvidence: () => boolean): FallowRunControls {
  const city = useCityStore();
  const analysis = useAnalysisStore();
  const refusal = ref<FallowRunRefusal | null>(null);
  const { busy, error: failure, run: guarded } = useBusyAction();
  let seen = runIdOf(analysis.run);
  let announced = finishedIdOf(analysis.run);
  const clear = (): void => {
    refusal.value = null;
    failure.value = '';
  };

  watch(() => analysis.repositoryId, () => {
    clear();
    seen = runIdOf(analysis.run);
    announced = finishedIdOf(analysis.run);
  });
  watch(() => analysis.run, (state) => {
    const id = runIdOf(state);
    if (id !== '' && id !== seen) { seen = id; clear(); }
    if (!isFinished(state) || id === announced) return;
    announced = id;
    const banner = fallowRunBannerOf(state, hasEvidence());
    if (banner) announce(banner.reason === null ? banner.text : `${banner.text} ${banner.reason}`);
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
