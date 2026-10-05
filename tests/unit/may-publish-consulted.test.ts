// M118 / GRC13: the `mayPublish` supersession guard is unreachable by construction inside
// one ScanCoordinator, so no behavioural test can make it fail by driving a real race --
// `gate-evidence.test.ts` pins the yield-point invariant by reading the source, which is a
// tripwire and not coverage. This file is the behavioural half: it makes `mayPublish`
// answer "no" for ONE scan and proves the coordinator obeys it -- nothing reaches the
// store, no SCAN_COMPLETED is reported -- and that the very same scan publishes when the
// guard answers as the real function does. Delete the `if (!mayPublish(...)) return`
// at the publish step and the refusal test fails.
//
// The mock delegates to the real `mayPublish` by default, so the control scan below runs
// the UNMOCKED function through the same module graph; only the refusal test overrides it.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { InMemorySnapshotStore } from '../../src/adapters/storage/in-memory-snapshot-store';
import { approve } from '../../src/application/approval';
import { mayPublish } from '../../src/application/run-state';
import { ScanCoordinator } from '../../src/application/scan-coordinator';
import { createCancellationToken } from '../fixtures/cancellation-token';
import { createFixedClock } from '../fixtures/clock';
import { createFakeSourceFileSystem } from '../fixtures/fake-source-filesystem';
import type { ScanLifecycleState } from '../../src/application/run-state';
import type { AnalysisScope, ApprovedInventoryRun } from '../../src/domain/model';

vi.mock('../../src/application/run-state', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../src/application/run-state')>();
  return { ...original, mayPublish: vi.fn(original.mayPublish) };
});

const clock = createFixedClock();

describe('ScanCoordinator consults mayPublish before it publishes', () => {
  let scope: AnalysisScope;
  let approval: ApprovedInventoryRun;

  beforeEach(() => {
    vi.mocked(mayPublish).mockClear();
    scope = { rootPath: '/fake-root', exclusions: [], maxFileBytes: 5_000_000, followSymlinks: false };
    approval = approve('p', scope.rootPath, scope, clock);
  });

  function scan() {
    const { port } = createFakeSourceFileSystem({ 'a.ts': 'one\n', 'b.ts': 'two\n' });
    const store = new InMemorySnapshotStore(clock);
    const put = vi.spyOn(store, 'put');
    const coordinator = new ScanCoordinator({ port, store, clock, createCancellationToken });
    const statuses: string[] = [];
    coordinator.subscribe((s: ScanLifecycleState) => { statuses.push(s.run.status); });
    return { coordinator, store, put, statuses };
  }

  it('publishes nothing and reports no completion when mayPublish refuses', async () => {
    vi.mocked(mayPublish).mockImplementationOnce(() => false);
    const { coordinator, store, put, statuses } = scan();

    await coordinator.start(approval, scope);

    expect(mayPublish).toHaveBeenCalledTimes(1);
    const [identity, current, state] = vi.mocked(mayPublish).mock.calls[0]!;
    expect(identity).toMatchObject({
      profileId: approval.profileId,
      sourceFingerprint: approval.sourceFingerprint,
      scopeFingerprint: approval.scopeFingerprint,
    });
    expect(identity.runId.length, 'the consulted identity carries no runId').toBeGreaterThan(0);
    expect(current).toEqual(identity);
    expect(state.status).toBe('running');
    expect(put, 'a refused result reached the store').not.toHaveBeenCalled();
    expect(store.latestFor('p')).toBeNull();
    expect(statuses, 'SCAN_COMPLETED was reported for a refused result').not.toContain('complete');
  });

  it('CONTROL: the same scan publishes when mayPublish answers as the real function does', async () => {
    const { coordinator, store, put, statuses } = scan();

    await coordinator.start(approval, scope);

    expect(mayPublish).toHaveBeenCalledTimes(1);
    expect(put).toHaveBeenCalledTimes(1);
    expect(store.latestFor('p')).not.toBeNull();
    expect(statuses).toContain('complete');
  });
});
