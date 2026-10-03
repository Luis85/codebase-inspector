// Part 7 Z34: one Notice per failed run, for operational failures and a changed version only.
import { describe, expect, it, vi } from 'vitest';
import { watchAnalysisFailures } from '../../src/host/analysis-notices';
import { FALLOW_RUN_ERROR, FALLOW_RUN_NOTICE } from '../../src/ui/inspector-copy';
import { createFakeFallowAnalysis } from '../fixtures/fake-fallow-analysis';

const failed = (runId: string, code: 'timed-out' | 'version-changed' | 'snapshot-changed' | 'superseded') =>
  ({ status: 'failed', runId, code, detail: '120', logExcerpt: '', evidenceKept: false, finishedAt: '2026-09-23T10:00:00.000Z' }) as const;

describe('watchAnalysisFailures (Z34)', () => {
  it('notifies once per failed run, with COPY-15 and the reason', () => {
    const fake = createFakeFallowAnalysis();
    const notify = vi.fn();
    watchAnalysisFailures(fake, notify);
    fake.setState('p1', failed('r1', 'timed-out'));
    fake.setState('p1', failed('r1', 'timed-out'));
    expect(notify.mock.calls).toEqual([[FALLOW_RUN_NOTICE(FALLOW_RUN_ERROR['timed-out']('120'))]]);
    fake.setState('p1', failed('r2', 'version-changed'));
    expect(notify).toHaveBeenCalledTimes(2);
  });

  it('stays quiet for a discarded run, a completion or a cancel, and after unwatching', () => {
    const fake = createFakeFallowAnalysis();
    const notify = vi.fn();
    const stop = watchAnalysisFailures(fake, notify);
    fake.setState('p1', failed('r1', 'snapshot-changed'));
    fake.setState('p1', failed('r2', 'superseded'));
    fake.setState('p1', { status: 'cancelled', runId: 'r3' });
    stop();
    fake.setState('p1', failed('r4', 'timed-out'));
    expect(notify).not.toHaveBeenCalled();
  });

  it('Polish C12: two codebases failing in turn are each told once per run', () => {
    const fake = createFakeFallowAnalysis();
    const notify = vi.fn();
    watchAnalysisFailures(fake, notify);
    fake.setState('p1', failed('r1', 'timed-out'));
    fake.setState('p2', failed('r2', 'timed-out'));
    fake.setState('p1', failed('r1', 'timed-out'));
    fake.setState('p1', failed('r3', 'timed-out'));
    expect(notify).toHaveBeenCalledTimes(3);
  });
});
