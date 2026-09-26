// Part 7 Z28/Z33: the screens' only door to the fallow run types (Part 6 E20's barrel), and
// the run banner (C16) as pure data.
import type { AnalysisRunState } from '../../application/analysis/analysis-state';
import type { FallowRunErrorCode } from '../../application/analysis/fallow-run-errors';
import type { RunReview } from '../../application/analysis/fallow-analysis-service';
import { formatAbsoluteTime } from '../copy';
import {
  COPY_15, FALLOW_RUN_CANCELLED, FALLOW_RUN_CANCELLING, FALLOW_RUN_COMPLETED, FALLOW_RUN_ERROR, FALLOW_RUN_PROBING, FALLOW_RUN_RUNNING,
} from '../inspector-copy';
import { rootFolderLabel } from './root-label';

export type { AnalysisRunState } from '../../application/analysis/analysis-state';
export type { ReviewResult, RunReview, StartOutcome } from '../../application/analysis/fallow-analysis-service';
export type { FallowRunErrorCode } from '../../application/analysis/fallow-run-errors';
export { FALLOW_TESTED_VERSIONS } from '../../application/analysis/fallow-invocation';

/** Z29/Z30: where the installed route opens. */
export type InstalledRouteStart = { startAt: 'path' } | { startAt: 'review'; review: RunReview; reason: 'untrusted' | 'changed' };

export interface FallowRunBanner {
  tone: 'info' | 'warning';
  icon: string;
  text: string;
  reason: string | null;
  /** The previous findings were kept (and marked stale). */
  kept: boolean;
  log: string | null;
}

/** Z33: how much of a failure's stderr tail is shown. */
export const LOG_SHOWN_CHARS = 2000;

const info = (icon: string, text: string): FallowRunBanner => ({ tone: 'info', icon, text, reason: null, kept: false, log: null });

/** Z33: a refused start, in the failed form, with no log. */
export function refusalBanner(code: FallowRunErrorCode, detail: string): FallowRunBanner {
  return { tone: 'warning', icon: 'alert-triangle', text: COPY_15('fallow'), reason: FALLOW_RUN_ERROR[code](detail), kept: false, log: null };
}

/** Polish C8: a Run or a Forget that threw (use-fallow-run.ts): the failed form, its text only. */
export function failureBanner(text: string): FallowRunBanner {
  return { tone: 'warning', icon: 'alert-triangle', text, reason: null, kept: false, log: null };
}

/** `evidenceMarkedFailed`: the CURRENT report carries `staleReason: 'failed-run'`. "Kept" is
 *  said only when this failure marked it AND the mark is still there: a later import or
 *  removal replaced the report the failure kept (final review). */
export function fallowRunBannerOf(state: AnalysisRunState, hasEvidence: boolean, evidenceMarkedFailed: boolean): FallowRunBanner | null {
  switch (state.status) {
    case 'idle': return null;
    case 'probing': return info('loader', FALLOW_RUN_PROBING(hasEvidence));
    case 'running':
      return info('loader', FALLOW_RUN_RUNNING(rootFolderLabel(state.rootPath), formatAbsoluteTime(state.startedAt, Intl), state.timeoutSeconds, hasEvidence));
    case 'cancelling': return info('loader', FALLOW_RUN_CANCELLING);
    case 'cancelled': return info('circle-slash', FALLOW_RUN_CANCELLED);
    case 'completed': return info('check', FALLOW_RUN_COMPLETED(state.matchedFindings, state.matchedFiles));
    case 'failed': {
      const log = state.logExcerpt.slice(-LOG_SHOWN_CHARS);
      return {
        tone: 'warning', icon: 'alert-triangle', text: COPY_15('fallow'), reason: FALLOW_RUN_ERROR[state.code](state.detail),
        kept: state.evidenceKept && evidenceMarkedFailed, log: log === '' ? null : log,
      };
    }
    default: {
      const exhaustive: never = state;
      return exhaustive;
    }
  }
}
