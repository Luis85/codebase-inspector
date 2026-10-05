// Task-8 brief step 6: the whole chain over a REAL temporary tree, through the REAL
// Node adapter (ruling M17 part 2) -- approve -> scan -> publish -> refresh -> cancel ->
// verify retention. No fake filesystem anywhere in this file.
import { rename, rm } from 'node:fs/promises';
import { afterEach, describe, expect, it } from 'vitest';
import { ScanCoordinator, createCancellationToken } from '../../src/application/scan-coordinator';
import { InMemorySnapshotStore } from '../../src/adapters/storage/in-memory-snapshot-store';
import { approve, isApprovalValid } from '../../src/application/approval';
import { createRealNodePort } from '../fixtures/real-node-port';
import { createFixedClock } from '../fixtures/clock';
import { makeTempTree } from '../fixtures/temp-tree';
import type { TempTree } from '../fixtures/temp-tree';
import type { AnalysisScope } from '../../src/domain/model';
import type { ScanLifecycleState } from '../../src/application/run-state';

const trees: TempTree[] = [];
afterEach(async () => {
  await Promise.all(trees.splice(0).map((t) => t.cleanup()));
});

async function makeTree(): Promise<TempTree> {
  const tree = await makeTempTree({
    'src/a.ts': 'export const a = 1;\nexport const b = 2;\n',
    'src/nested/b.ts': 'export const b = 2;\n',
    'README.md': '# Fixture\n',
  });
  trees.push(tree);
  return tree;
}

describe('scan lifecycle over a real temporary tree', () => {
  it('approves, scans, publishes, refreshes, cancels, and retains the original snapshot', async () => {
    const tree = await makeTree();
    const clock = createFixedClock();
    const port = createRealNodePort();
    const store = new InMemorySnapshotStore(clock);
    const coordinator = new ScanCoordinator({ port, store, clock, createCancellationToken });

    const scope: AnalysisScope = { rootPath: tree.root, exclusions: [], maxFileBytes: 5_000_000, followSymlinks: false };
    const approval = approve('profile-1', tree.root, scope, clock);
    expect(isApprovalValid(approval, tree.root, scope)).toBe(true);

    // --- approve -> scan -> publish ---
    await coordinator.start(approval, scope);
    expect(coordinator.state.status).toBe('complete');
    const first = store.latestFor('profile-1');
    expect(first).not.toBeNull();
    expect(first!.entities.some((e) => e.kind === 'file' && e.path === 'src/a.ts')).toBe(true);
    expect(first!.completeness).toBe('complete');
    const firstSnapshotId = first!.snapshotId;
    const firstCapturedAt = first!.providerRun.capturedAt;

    // --- refresh: the previous snapshot stays visible while a new run happens ---
    clock.advance(60_000);
    const refreshApproval = approve('profile-1', tree.root, scope, clock);
    await coordinator.start(refreshApproval, scope);
    expect(coordinator.state.status).toBe('complete');
    const second = store.latestFor('profile-1');
    expect(second!.snapshotId).not.toBe(firstSnapshotId);   // a genuinely NEW snapshot
    expect(new Date(second!.providerRun.capturedAt).getTime())
      .toBeGreaterThan(new Date(firstCapturedAt).getTime());

    // --- cancel a refresh: cancel the moment the run starts, before any file is read,
    // which is the most deterministic point at which to prove the invariant against
    // real (fast) disk I/O without racing a timer. ---
    const cancelledSeen: ScanLifecycleState[] = [];
    const unsubscribe = coordinator.subscribe((s) => {
      cancelledSeen.push(s);
      if (s.run.status === 'running') coordinator.cancel(s.run.runId);
    });
    clock.advance(60_000);
    const thirdApproval = approve('profile-1', tree.root, scope, clock);
    await coordinator.start(thirdApproval, scope);
    unsubscribe();

    expect(coordinator.state.status).toBe('cancelled');
    const afterCancel = store.latestFor('profile-1');
    // PUBLISHES NOTHING: the retained snapshot is still the SECOND one, unchanged --
    // same id, same original timestamp (not the cancelled run's).
    expect(afterCancel!.snapshotId).toBe(second!.snapshotId);
    expect(afterCancel!.providerRun.capturedAt).toBe(second!.providerRun.capturedAt);
    expect(cancelledSeen.some((s) => s.banner?.includes('Scan cancelled. The incomplete result was discarded.'))).toBe(true);

    // --- root moved or unavailable: refresh never scans a fallback root ---
    const movedRoot = `${tree.root}-moved`;
    await rename(tree.root, movedRoot);
    trees.push({ root: movedRoot, cleanup: async () => { await rm(movedRoot, { recursive: true, force: true }); } });
    clock.advance(60_000);
    const fourthApproval = approve('profile-1', tree.root, scope, clock);
    await coordinator.start(fourthApproval, scope);
    expect(coordinator.state.status).toBe('failed');
    const afterMove = store.latestFor('profile-1');
    expect(afterMove!.snapshotId).toBe(second!.snapshotId);   // still the retained snapshot
  });
});
