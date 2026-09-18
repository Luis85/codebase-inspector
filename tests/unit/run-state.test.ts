// Ported from docs/concept/design/wp01-review/validation/model.test.cjs
// (task-8-context.md section 8): the eight highest-value run-lifecycle invariants, kept
// as invariants rather than copied code. Ruling M34: every fixture below is a REAL
// InventoryRunState carrying a REAL ApprovedInventoryRun inside `approval` -- no `as any`
// anywhere in this file, because a cast in a test of a frozen contract hides exactly the
// drift the contract exists to prevent.
import { describe, expect, it } from 'vitest';
import {
  identityOf, initialScanLifecycleState, mayPublish, reduce, CANCELLED_BANNER,
} from '../../src/application/run-state';
import type { RunIdentity, ScanLifecycleState } from '../../src/application/run-state';
import type { ApprovedInventoryRun, InventoryRunState } from '../../src/domain/model';

/** Narrows a non-idle InventoryRunState down to its runId without a cast -- every
 *  variant but 'idle' carries one. */
function runIdOf(run: InventoryRunState): string {
  if (run.status === 'idle') throw new Error('test setup: no active run');
  return run.runId;
}

const approval: ApprovedInventoryRun = {
  profileId: 'p', sourceFingerprint: 'sf', scopeFingerprint: 'kf',
  approvedAt: '2026-01-01T00:00:00.000Z', operation: 'read-only-inventory',
};

const idle: ScanLifecycleState = initialScanLifecycleState();

const running: ScanLifecycleState = {
  ...idle,
  run: { status: 'running', runId: 'r1', generation: 1, approval, processedFiles: 0 },
  approval,
  generation: 1,
};

const runningWithPrevious: ScanLifecycleState = { ...running, publishedSnapshotId: 'previous' };

describe('run lifecycle', () => {
  it('does not replace the snapshot before completion', () => {
    const s = reduce(idle, { type: 'SCAN_STARTED', approval, runId: 'r1', generation: 1 });
    expect(s.publishedSnapshotId).toBe(idle.publishedSnapshotId);
  });

  it('treats a duplicate start during a run as a no-op', () => {
    const s = reduce(running, { type: 'SCAN_STARTED', approval, runId: 'r2', generation: 2 });
    expect(s).toBe(running);
  });

  it('CANCELS TO cancelling FIRST, never claiming work stopped before the collector confirms', () => {
    // cancelling is distinct from cancelled: publication is forbidden IMMEDIATELY, but
    // the UI never claims work stopped until the collector confirms (spec §7).
    const s = reduce(running, { type: 'CANCEL_REQUESTED' });
    expect(s.run.status).toBe('cancelling');
    expect(mayPublish(identityOf(running), identityOf(s), s.run)).toBe(false);
  });

  it('reaches cancelled only on collector confirmation', () => {
    let s = reduce(running, { type: 'CANCEL_REQUESTED' });
    s = reduce(s, { type: 'COLLECTOR_STOPPED', runId: runIdOf(s.run) });
    expect(s.run.status).toBe('cancelled');
  });

  it('PUBLISHES NOTHING for a cancelled run and retains the previous snapshot', () => {
    let s = reduce(runningWithPrevious, { type: 'CANCEL_REQUESTED' });
    s = reduce(s, { type: 'COLLECTOR_STOPPED', runId: runIdOf(running.run) });
    expect(s.publishedSnapshotId).toBe('previous');
    expect(s.banner).toContain(CANCELLED_BANNER);
  });

  it('ignores a late completion after cancel', () => {
    let s = reduce(running, { type: 'CANCEL_REQUESTED' });
    const stale = runIdOf(running.run);
    s = reduce(s, { type: 'SCAN_COMPLETED', runId: stale, snapshotId: 'late' });
    expect(s.publishedSnapshotId).not.toBe('late');
  });

  it('ignores progress after cancel', () => {
    let s = reduce(running, { type: 'CANCEL_REQUESTED' });
    s = reduce(s, { type: 'PROGRESS', runId: runIdOf(running.run), processedFiles: 42 });
    // A cancelling run has no processedFiles field at all (spec 4.1's frozen union) --
    // the status staying 'cancelling', unmoved, is exactly the proof that PROGRESS was
    // ignored rather than silently reviving a running-shaped object.
    expect(s.run.status).toBe('cancelling');
  });

  it('never lets an OLD run overwrite a NEWER run', () => {
    let s = reduce(running, { type: 'CANCEL_REQUESTED' });
    const old = runIdOf(running.run);
    s = reduce(s, { type: 'COLLECTOR_STOPPED', runId: old });
    s = reduce(s, { type: 'SCAN_STARTED', approval, runId: 'r2', generation: 2 });
    s = reduce(s, { type: 'SCAN_COMPLETED', runId: old, snapshotId: 'stale' });
    expect(s.publishedSnapshotId).not.toBe('stale');
  });

  it('leaves the previous snapshot INTACT on failure and labels the failed refresh', () => {
    const s = reduce(runningWithPrevious, {
      type: 'SCAN_FAILED', runId: runIdOf(running.run), message: 'EACCES',
    });
    expect(s.publishedSnapshotId).toBe('previous');
    expect(s.run.status).toBe('failed');
    expect(s.banner).toContain('EACCES');
  });

  it('preserves inspection context across a completion', () => {
    // selection, query, camera and inspector state survive a republish.
    const before: ScanLifecycleState = { ...runningWithPrevious, selectedEntityId: 'e1', query: 'layout' };
    const s = reduce(before, { type: 'SCAN_COMPLETED', runId: runIdOf(before.run), snapshotId: 'next' });
    expect(s.selectedEntityId).toBe('e1');
    expect(s.query).toBe('layout');
  });
});

function runningStateFor(identity: RunIdentity): InventoryRunState {
  const a: ApprovedInventoryRun = {
    profileId: identity.profileId, sourceFingerprint: identity.sourceFingerprint,
    scopeFingerprint: identity.scopeFingerprint, approvedAt: '2026-01-01T00:00:00.000Z',
    operation: 'read-only-inventory',
  };
  return { status: 'running', runId: identity.runId, generation: identity.generation, approval: a, processedFiles: 0 };
}

describe('mayPublish — run identity is the FULL TUPLE', () => {
  const base: RunIdentity = {
    profileId: 'p', sourceFingerprint: 'sf', scopeFingerprint: 'kf', runId: 'r1', generation: 3,
  };

  it('permits publication only when every identity component still matches', () => {
    expect(mayPublish(base, base, runningStateFor(base))).toBe(true);
  });

  for (const key of ['profileId', 'sourceFingerprint', 'scopeFingerprint', 'runId', 'generation'] as const) {
    it(`refuses publication when ${key} has changed`, () => {
      const current: RunIdentity = { ...base, [key]: key === 'generation' ? 4 : 'other' };
      expect(mayPublish(base, current, runningStateFor(current))).toBe(false);
    });
  }

  it('refuses publication in the cancelling state, immediately', () => {
    expect(mayPublish(base, base, { status: 'cancelling', runId: 'r1', generation: 3 })).toBe(false);
  });

  it('refuses publication in the CROSS-PROFILE late-result case', () => {
    // The restored form of the v1.1 late-result scenario: a result arriving for
    // profile A while profile B is active must not publish (spec §6, §7).
    expect(mayPublish(base, { ...base, profileId: 'other-profile' }, { status: 'idle' })).toBe(false);
  });
});
