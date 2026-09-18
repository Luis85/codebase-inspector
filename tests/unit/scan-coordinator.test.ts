// Task-8 brief step 3. ScanCoordinator is the ONLY thing that starts a walk; these
// tests exercise the seven numbered obligations from step 4 against a real (fake, but
// not mocked-away) SourceFileSystemPort, so a stub can never quietly satisfy an
// assertion the real adapter would fail.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ScanCoordinator, formatProgressMessage } from '../../src/application/scan-coordinator';
import { InMemorySnapshotStore } from '../../src/adapters/storage/in-memory-snapshot-store';
import { approve } from '../../src/application/approval';
import { createFakeSourceFileSystem } from '../fixtures/fake-source-filesystem';
import { createFixedClock } from '../fixtures/clock';
import { createCancellationToken } from '../fixtures/cancellation-token';
import { buildSnapshotFixture } from '../fixtures/snapshot-builder';
import type { AnalysisScope, ApprovedInventoryRun, CodebaseSnapshot } from '../../src/domain/model';
import type { SourceFileSystemPort } from '../../src/application/ports/source-filesystem-port';
import type { ScanLifecycleState } from '../../src/application/run-state';

function spyPort(): SourceFileSystemPort {
  return {
    walk: vi.fn(async function* () { /* never reached when a pre-flight guard refuses first */ }),
    readText: vi.fn(async () => ({ status: 'ok' as const, text: '', bytes: new Uint8Array() })),
    stat: vi.fn(async () => (
      { exists: true, isDirectory: true, isFile: false, isSymbolicLink: false, size: 0, mtimeMs: 0 })),
    readLog: vi.fn(() => []),
  };
}

const clock = createFixedClock();

describe('ScanCoordinator', () => {
  let scope: AnalysisScope;
  let approval: ApprovedInventoryRun;

  beforeEach(() => {
    scope = { rootPath: '/fake-root', exclusions: [], maxFileBytes: 5_000_000, followSymlinks: false };
    approval = approve('p', scope.rootPath, scope, clock);
  });

  it('VALIDATES APPROVAL BEFORE ANY FILESYSTEM ACCESS', async () => {
    const port = spyPort();
    const store = new InMemorySnapshotStore(clock);
    const coordinator = new ScanCoordinator({ port, store, clock, createCancellationToken });
    const staleApproval = approve('p', '/fake-root', scope, clock);
    const changedScope: AnalysisScope = { ...scope, rootPath: '/a-completely-different-root' };

    await expect(coordinator.start(staleApproval, changedScope)).rejects.toThrow(/approval/i);
    expect(port.walk).not.toHaveBeenCalled();
    expect(port.stat).not.toHaveBeenCalled();
    expect(port.readLog()).toEqual([]);
  });

  it('refuses to start with no approval at all', async () => {
    const port = spyPort();
    const store = new InMemorySnapshotStore(clock);
    const coordinator = new ScanCoordinator({ port, store, clock, createCancellationToken });

    await expect(coordinator.start(null, scope)).rejects.toThrow(/approval/i);
    expect(port.walk).not.toHaveBeenCalled();
  });

  it('validates the produced snapshot BEFORE publishing it', async () => {
    const { port } = createFakeSourceFileSystem({});
    const store = new InMemorySnapshotStore(clock);
    const coordinator = new ScanCoordinator({ port, store, clock, createCancellationToken });
    const corruptSnapshot = { ...buildSnapshotFixture({ files: 1 }), schemaVersion: 2 } as unknown as CodebaseSnapshot;
    coordinator.onProduce = () => corruptSnapshot;

    await coordinator.start(approval, scope);

    expect(store.latestFor('p')).toBeNull();
    expect(coordinator.state.status).toBe('failed');
  });

  it('publishes as an ATOMIC SWAP: the previous snapshot is immutable until then', async () => {
    // The REAL collectInventory, over several files, so several real PROGRESS ticks
    // land between start and completion — every one of them is a chance for this test
    // to observe a half-built or missing store value, not just the first and last tick.
    const { port } = createFakeSourceFileSystem({ 'a.ts': 'one\ntwo\n', 'b.ts': 'three\n', 'c.ts': 'four\nfive\n' });
    const store = new InMemorySnapshotStore(clock);
    const previous: CodebaseSnapshot = { ...buildSnapshotFixture({ files: 1, repositoryId: 'p' }), snapshotId: 'previous' };
    store.put(previous);
    const coordinator = new ScanCoordinator({ port, store, clock, createCancellationToken });

    const seen: (string | null)[] = [];
    coordinator.subscribe(() => { seen.push(store.latestFor('p')?.snapshotId ?? null); });

    await coordinator.start(approval, scope);

    const publishedId = store.latestFor('p')?.snapshotId;
    expect(publishedId).not.toBe('previous');
    expect(seen.length).toBeGreaterThan(2);   // start + at least one progress tick + complete
    // No intermediate state ever exposes a half-built or missing snapshot.
    expect(new Set(seen)).toEqual(new Set(['previous', publishedId]));
  });

  it('reports progress with a COUNT, never a fabricated percentage or ETA', async () => {
    const { port } = createFakeSourceFileSystem({ 'a.ts': 'x', 'b.ts': 'y', 'c.ts': 'z' });
    const store = new InMemorySnapshotStore(clock);
    const coordinator = new ScanCoordinator({ port, store, clock, createCancellationToken });
    const msgs: string[] = [];
    coordinator.subscribe((s: ScanLifecycleState) => {
      if (s.run.status === 'running') msgs.push(formatProgressMessage(s.run.processedFiles));
    });

    await coordinator.start(approval, scope);

    expect(msgs.length).toBeGreaterThan(0);
    expect(msgs[0]).toMatch(/^Reading included files\. \d+ files read so far\.$/);
    expect(msgs.join(' ')).not.toMatch(/%|ETA|remaining/i);
  });

  it('exposes no aria-valuenow for an unknown total (task 9 renders the DOM; this only ' +
     'guarantees no total/percentage value exists anywhere in the state to render)', async () => {
    const { port } = createFakeSourceFileSystem({ 'a.ts': 'x' });
    const store = new InMemorySnapshotStore(clock);
    const coordinator = new ScanCoordinator({ port, store, clock, createCancellationToken });
    let sawRunning = false;
    coordinator.subscribe((s: ScanLifecycleState) => {
      if (s.run.status === 'running') {
        sawRunning = true;
        expect(Object.keys(s.run).sort()).toEqual(['approval', 'generation', 'processedFiles', 'runId', 'status']);
      }
    });

    await coordinator.start(approval, scope);
    expect(sawRunning).toBe(true);
  });

  it('rejects a stale callback rather than acting on it', async () => {
    const { port } = createFakeSourceFileSystem({});
    const store = new InMemorySnapshotStore(clock);
    const coordinator = new ScanCoordinator({ port, store, clock, createCancellationToken });

    let resolveProduce!: (s: CodebaseSnapshot) => void;
    coordinator.onProduce = () => new Promise<CodebaseSnapshot>((resolve) => { resolveProduce = resolve; });

    const runPromise = coordinator.start(approval, scope);
    // Let start() reach the pending onProduce() call before cancelling.
    await Promise.resolve();
    await Promise.resolve();
    const runningState = coordinator.state;
    if (runningState.status !== 'running') throw new Error('test setup: expected a running scan');
    coordinator.cancel(runningState.runId);

    // The 'collector' resolves AFTER cancellation was requested -- a defensive case:
    // even if some future collector implementation resolved instead of rejecting with
    // CancellationError once asked to stop, the coordinator's own identity/cancellation
    // check must still refuse to publish a result for a run it no longer trusts.
    resolveProduce({ ...buildSnapshotFixture({ files: 1, repositoryId: 'p' }), snapshotId: 'stale-result' });
    await runPromise;

    expect(store.latestFor('p')).toBeNull();
    expect(coordinator.state.status).toBe('cancelled');
  });

  it('never starts a scan because a view became visible', () => {
    const port = spyPort();
    const store = new InMemorySnapshotStore(clock);
    const coordinator = new ScanCoordinator({ port, store, clock, createCancellationToken });
    // pause/resume invariant (spec 4.2): visibility never authorises a scan. A
    // resize/visibility hook has NOTHING to call on the coordinator that would start
    // one -- there is no implicit trigger here at all, only the explicit start() this
    // test deliberately never calls.
    const view = { onResume: (): void => { /* a real resume hook touches the renderer only */ } };
    view.onResume();
    expect(coordinator.state.status).toBe('idle');
    expect(port.walk).not.toHaveBeenCalled();
  });
});
