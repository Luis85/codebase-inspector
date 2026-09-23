// Part 7 Z34: a failed fallow run tells the user even if they left Data & scans. main.ts
// calls this once. One Notice per run id, for operational failures and a changed version
// only; a completion or a cancel shows up on every screen and raises none.
import { OPERATIONAL_FAILURES } from '../application/analysis/fallow-run-errors';
import type { FallowAnalysisService } from '../application/analysis/fallow-analysis-service';
import { FALLOW_RUN_ERROR, FALLOW_RUN_NOTICE } from '../ui/inspector-copy';

export function watchAnalysisFailures(
  service: Pick<FallowAnalysisService, 'subscribe' | 'stateOf'>, notify: (message: string) => void,
): () => void {
  /** Polish C12: the last run told, per codebase — not every run of the session. */
  const told = new Map<string, string>();
  return service.subscribe((profileId) => {
    const state = service.stateOf(profileId);
    if (state.status !== 'failed' || told.get(profileId) === state.runId) return;
    if (!OPERATIONAL_FAILURES.has(state.code) && state.code !== 'version-changed') return;
    told.set(profileId, state.runId);
    notify(FALLOW_RUN_NOTICE(FALLOW_RUN_ERROR[state.code](state.detail)));
  });
}
