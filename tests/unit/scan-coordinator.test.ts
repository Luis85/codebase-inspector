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

/** Fix round 1, Minor 5: the spies are hoisted to plain consts and assigned into the
 *  port via shorthand properties, so a caller asserts against the CONST
 *  (`expect(walk)...`), never a member expression (`expect(port.walk)...`) off a value
 *  typed as the real `SourceFileSystemPort` interface -- the exact pattern that used to
 *  need `@typescript-eslint/unbound-method` turned off for this file. No behaviour
 *  change from the previous version. */
function spyPort() {
  const walk = vi.fn(async function* () { /* never reached when a pre-flight guard refuses first */ });
  const readText = vi.fn(async () => ({ status: 'ok' as const, text: '', bytes: new Uint8Array() }));
  const stat = vi.fn(async () => (
    { exists: true, isDirectory: true, isFile: false, isSymbolicLink: false, size: 0, mtimeMs: 0 }));
  const readLog = vi.fn((): string[] => []);
  const port: SourceFileSystemPort = { walk, readText, stat, readLog };
  return { port, walk, stat, readLog };
}

const clock = createFixedClock();

function manyFiles(n: number): Record<string, string> {
  const files: Record<string, string> = {};
  for (let i = 0; i < n; i += 1) files[`file-${i}.ts`] = 'x';
  return files;
}

describe('ScanCoordinator', () => {
  let scope: AnalysisScope;
  let approval: ApprovedInventoryRun;

  beforeEach(() => {
    scope = { rootPath: '/fake-root', exclusions: [], maxFileBytes: 5_000_000, followSymlinks: false };
    approval = approve('p', scope.rootPath, scope, clock);
  });

  it('VALIDATES APPROVAL BEFORE ANY FILESYSTEM ACCESS', async () => {
    const { port, walk, stat, readLog } = spyPort();
    const store = new InMemorySnapshotStore(clock);
    const coordinator = new ScanCoordinator({ port, store, clock, createCancellationToken });
    const staleApproval = approve('p', '/fake-root', scope, clock);
    const changedScope: AnalysisScope = { ...scope, rootPath: '/a-completely-different-root' };

    await expect(coordinator.start(staleApproval, changedScope)).rejects.toThrow(/approval/i);
    expect(walk).not.toHaveBeenCalled();
    expect(stat).not.toHaveBeenCalled();
    expect(readLog()).toEqual([]);
  });

  it('refuses to start with no approval at all', async () => {
    const { port, walk } = spyPort();
    const store = new InMemorySnapshotStore(clock);
    const coordinator = new ScanCoordinator({ port, store, clock, createCancellationToken });

    await expect(coordinator.start(null, scope)).rejects.toThrow(/approval/i);
    expect(walk).not.toHaveBeenCalled();
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

  it('cancels through the REAL production token while files are being read, not via ' +
     'onProduce and not synchronously at SCAN_STARTED', async () => {
    // Fix round 1, Important 3: the only two cancellation tests before this one either
    // cancelled synchronously inside the SCAN_STARTED notification (before the token
    // even exists -- the re-entrancy catch-up path) or stubbed collectInventory away
    // entirely via onProduce (so the token was never consulted at all). This is the
    // "user presses Cancel while files are being read" path: real collectInventory,
    // real createCancellationToken, cancelled from a PROGRESS tick well after the first
    // file was read.
    const { port } = createFakeSourceFileSystem({
      'a.ts': 'one\n', 'b.ts': 'two\n', 'c.ts': 'three\n', 'd.ts': 'four\n', 'e.ts': 'five\n',
    });
    const store = new InMemorySnapshotStore(clock);
    const previous: CodebaseSnapshot = { ...buildSnapshotFixture({ files: 1, repositoryId: 'p' }), snapshotId: 'previous' };
    store.put(previous);
    const coordinator = new ScanCoordinator({ port, store, clock, createCancellationToken });

    let cancelled = false;
    coordinator.subscribe((s) => {
      if (!cancelled && s.run.status === 'running' && s.run.processedFiles >= 2) {
        cancelled = true;
        coordinator.cancel(s.run.runId);
      }
    });

    await coordinator.start(approval, scope);

    expect(coordinator.state.status).toBe('cancelled');
    const retained = store.latestFor('p');
    expect(retained?.snapshotId).toBe('previous');
    expect(retained?.providerRun.capturedAt).toBe(previous.providerRun.capturedAt);
  });

  // Ruling M50 (fix round 5): spec 5.2's "Throttle rapidly changing counters," applied
  // at the source. A fixed clock (never advances) means every file after the first
  // falls inside the SAME throttle window -- exactly the scenario that lets these
  // assertions be tight rather than approximate.
  describe('progress is THROTTLED (ruling M50)', () => {
    it('produces far fewer PROGRESS notifications than one per file', async () => {
      const { port } = createFakeSourceFileSystem(manyFiles(200));
      const store = new InMemorySnapshotStore(clock);
      const coordinator = new ScanCoordinator({ port, store, clock, createCancellationToken });
      let runningNotifications = 0;
      coordinator.subscribe((s) => { if (s.run.status === 'running') runningNotifications += 1; });

      await coordinator.start(approval, scope);

      expect(runningNotifications).toBeGreaterThan(0);
      // On a clock that never advances, only the very first tick and the forced final
      // one (see below) can ever get past the throttle -- nowhere close to 200.
      expect(runningNotifications).toBeLessThanOrEqual(3);
    });

    it('always emits a FINAL notification carrying the true, exact count', async () => {
      const { port } = createFakeSourceFileSystem(manyFiles(200));
      const store = new InMemorySnapshotStore(clock);
      const coordinator = new ScanCoordinator({ port, store, clock, createCancellationToken });
      const counts: number[] = [];
      coordinator.subscribe((s) => { if (s.run.status === 'running') counts.push(s.run.processedFiles); });

      await coordinator.start(approval, scope);

      // The count itself is never throttled, only how often it is REPORTED -- the last
      // reported value must be exact, never one file short of the truth.
      expect(counts[counts.length - 1]).toBe(200);
    });

    it('still emits fresh notifications once the throttle interval has genuinely elapsed', async () => {
      // A clock that ADVANCES past PROGRESS_THROTTLE_MS between files proves the
      // throttle is time-based, not "only ever the first and last tick" by coincidence.
      const advancingClock = createFixedClock();
      const { port } = createFakeSourceFileSystem(manyFiles(5));
      const wrappedWalk: SourceFileSystemPort = {
        ...port,
        walk: (root, opts, token) => ({
          async *[Symbol.asyncIterator]() {
            for await (const entry of port.walk(root, opts, token)) {
              if (entry.kind === 'file') advancingClock.advance(150);   // > PROGRESS_THROTTLE_MS
              yield entry;
            }
          },
        }),
      };
      const store = new InMemorySnapshotStore(advancingClock);
      const coordinator = new ScanCoordinator({
        port: wrappedWalk, store, clock: advancingClock, createCancellationToken,
      });
      let runningNotifications = 0;
      coordinator.subscribe((s) => { if (s.run.status === 'running') runningNotifications += 1; });

      await coordinator.start(approve('p', scope.rootPath, scope, advancingClock), scope);

      // Every one of the 5 files lands in its OWN window now -- one tick per file,
      // plus the initial SCAN_STARTED notification (processedFiles: 0) and the forced
      // final emission (obligation: exact count on completion) that always bracket it.
      expect(runningNotifications).toBe(1 + 5 + 1);
    });

    it('a cancel during a throttled (suppressed) window leaves no stray notification behind', async () => {
      const { port } = createFakeSourceFileSystem(manyFiles(50));
      const store = new InMemorySnapshotStore(clock);
      const coordinator = new ScanCoordinator({ port, store, clock, createCancellationToken });

      const notifications: ScanLifecycleState[] = [];
      let cancelledOnce = false;
      coordinator.subscribe((s) => {
        notifications.push(s);
        // Cancel the moment the FIRST progress tick is observed. On this fixed clock,
        // every subsequent file falls inside that SAME suppressed throttle window --
        // there is no second tick to wait for before cancelling.
        if (!cancelledOnce && s.run.status === 'running' && s.run.processedFiles >= 1) {
          cancelledOnce = true;
          coordinator.cancel(s.run.runId);
        }
      });

      await coordinator.start(approval, scope);

      expect(coordinator.state.status).toBe('cancelled');
      // Nothing arrives AFTER the collector confirms stopped -- specifically, no stray
      // 'running' notification, which a leftover forced-final emission would produce.
      const cancelledIndex = notifications.findIndex((s) => s.run.status === 'cancelled');
      expect(cancelledIndex).toBeGreaterThanOrEqual(0);
      expect(notifications.slice(cancelledIndex + 1)).toEqual([]);
    });
  });

  it('never starts a scan because a view became visible', () => {
    const { port, walk } = spyPort();
    const store = new InMemorySnapshotStore(clock);
    const coordinator = new ScanCoordinator({ port, store, clock, createCancellationToken });
    // pause/resume invariant (spec 4.2): visibility never authorises a scan. A
    // resize/visibility hook has NOTHING to call on the coordinator that would start
    // one -- there is no implicit trigger here at all, only the explicit start() this
    // test deliberately never calls.
    const view = { onResume: (): void => { /* a real resume hook touches the renderer only */ } };
    view.onResume();
    expect(coordinator.state.status).toBe('idle');
    expect(walk).not.toHaveBeenCalled();
  });
});
