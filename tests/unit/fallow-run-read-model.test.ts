// Part 7 Z33: the run banner as pure data, one row per state; a failure keeps its log tail.
import { describe, expect, it } from 'vitest';
import type { AnalysisIdentity } from '../../src/application/analysis/analysis-state';
import { LOG_SHOWN_CHARS, fallowRunBannerOf, refusalBanner } from '../../src/ui/read-models/fallow-run';
import { formatAbsoluteTime } from '../../src/ui/copy';
import {
  COPY_15, FALLOW_RUN_CANCELLED, FALLOW_RUN_CANCELLING, FALLOW_RUN_COMPLETED, FALLOW_RUN_ERROR, FALLOW_RUN_PROBING, FALLOW_RUN_RUNNING,
} from '../../src/ui/inspector-copy';

const ID: AnalysisIdentity = { profileId: 'p1', snapshotId: 's1', rootFingerprint: 'a', subjectFingerprint: 'b', runId: 'r1', generation: 0 };
const AT = '2026-09-23T10:00:00.000Z';
const info = (icon: string, text: string) => ({ tone: 'info', icon, text, reason: null, kept: false, log: null });

describe('fallowRunBannerOf (Z33)', () => {
  it('shows nothing while idle', () => {
    expect(fallowRunBannerOf({ status: 'idle' }, true)).toBeNull();
  });

  it('probing, running and cancelling are info with a loader; the folder is the root\'s last segment', () => {
    expect(fallowRunBannerOf({ status: 'probing', identity: ID, rootPath: '/work/my repo', startedAt: AT, timeoutSeconds: 120 }, true))
      .toEqual(info('loader', FALLOW_RUN_PROBING(true)));
    expect(fallowRunBannerOf({ status: 'running', identity: ID, rootPath: '/work/my repo', startedAt: AT, timeoutSeconds: 300, version: '3.27.0', tested: true }, false))
      .toEqual(info('loader', FALLOW_RUN_RUNNING('my repo', formatAbsoluteTime(AT, Intl), 300, false)));
    expect(fallowRunBannerOf({ status: 'cancelling', identity: ID }, true)).toEqual(info('loader', FALLOW_RUN_CANCELLING));
  });

  it('cancelled and completed are info', () => {
    expect(fallowRunBannerOf({ status: 'cancelled', runId: 'r1' }, true)).toEqual(info('circle-slash', FALLOW_RUN_CANCELLED));
    expect(fallowRunBannerOf({ status: 'completed', runId: 'r1', finishedAt: AT, version: '3.27.0', tested: true, matchedFindings: 5, matchedFiles: 4 }, true))
      .toEqual(info('check', FALLOW_RUN_COMPLETED(5, 4)));
  });

  it('a failure is a warning with COPY-15, its reason, whether evidence was kept, and the log tail', () => {
    const log = `${'x'.repeat(3000)}last`;
    expect(fallowRunBannerOf({ status: 'failed', runId: 'r1', code: 'timed-out', detail: '120', logExcerpt: log, evidenceKept: true, finishedAt: AT }, true)).toEqual({
      tone: 'warning', icon: 'alert-triangle', text: COPY_15('fallow'), reason: FALLOW_RUN_ERROR['timed-out']('120'), kept: true, log: log.slice(-LOG_SHOWN_CHARS),
    });
    expect(fallowRunBannerOf({ status: 'failed', runId: 'r1', code: 'exit-code', detail: '3', logExcerpt: '', evidenceKept: false, finishedAt: AT }, false))
      .toMatchObject({ kept: false, log: null });
  });

  it('a refused start is the failed form without a log', () => {
    expect(refusalBanner('root-unavailable', '')).toEqual({
      tone: 'warning', icon: 'alert-triangle', text: COPY_15('fallow'), reason: FALLOW_RUN_ERROR['root-unavailable'](''), kept: false, log: null,
    });
  });
});
