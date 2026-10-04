// Gap closure GRA4 (spec §7): the root-unavailable producer. A scan or refresh that finds the
// source folder missing or unreadable sets `rootUnavailable`; the published snapshot is untouched,
// and the next scan start clears the flag.
import { describe, expect, it, vi } from 'vitest';
import { initialScanLifecycleState, reduce } from '../../src/application/run-state';
import type { ScanLifecycleState } from '../../src/application/run-state';
import { ScanCoordinator } from '../../src/application/scan-coordinator';
import { InMemorySnapshotStore } from '../../src/adapters/storage/in-memory-snapshot-store';
import { approve } from '../../src/application/approval';
import { createFixedClock } from '../fixtures/clock';
import { createCancellationToken } from '../fixtures/cancellation-token';
import type { AnalysisScope, ApprovedInventoryRun } from '../../src/domain/model';
import type { SourceFileSystemPort } from '../../src/application/ports/source-filesystem-port';

const approval: ApprovedInventoryRun = {
  profileId: 'p', sourceFingerprint: 'sf', scopeFingerprint: 'kf',
  approvedAt: '2026-01-01T00:00:00.000Z', operation: 'read-only-inventory',
};

const published: ScanLifecycleState = { ...initialScanLifecycleState(), publishedSnapshotId: 'snap-1' };
const running: ScanLifecycleState = {
  ...published,
  run: { status: 'running', runId: 'r1', generation: 1, approval, processedFiles: 0 },
  approval,
  generation: 1,
};
const cancelling: ScanLifecycleState = { ...running, run: { status: 'cancelling', runId: 'r1', generation: 1 } };

describe('the rootUnavailable reducer state', () => {
  it('starts false', () => {
    expect(initialScanLifecycleState().rootUnavailable).toBe(false);
  });

  it('SCAN_FAILED with the root-unavailable cause sets it and keeps the published snapshot', () => {
    const s = reduce(running, { type: 'SCAN_FAILED', runId: 'r1', message: 'gone', cause: 'root-unavailable' });
    expect(s.rootUnavailable).toBe(true);
    expect(s.run.status).toBe('failed');
    expect(s.publishedSnapshotId).toBe('snap-1');
  });

  it('SCAN_FAILED without a cause leaves it false', () => {
    const s = reduce(running, { type: 'SCAN_FAILED', runId: 'r1', message: 'boom' });
    expect(s.rootUnavailable).toBe(false);
    expect(s.publishedSnapshotId).toBe('snap-1');
  });

  it('SCAN_STARTED clears it', () => {
    const unavailable: ScanLifecycleState = { ...published, rootUnavailable: true };
    const s = reduce(unavailable, { type: 'SCAN_STARTED', approval, runId: 'r2', generation: 2 });
    expect(s.rootUnavailable).toBe(false);
    expect(s.publishedSnapshotId).toBe('snap-1');
  });

  it('ROOT_UNAVAILABLE sets it and the failure banner when no run is in flight', () => {
    const s = reduce(published, { type: 'ROOT_UNAVAILABLE', message: 'The source directory is no longer available: /x' });
    expect(s.rootUnavailable).toBe(true);
    expect(s.banner).toBe('Scan failed: The source directory is no longer available: /x');
    expect(s.publishedSnapshotId).toBe('snap-1');
  });

  it('ROOT_UNAVAILABLE is ignored while a run is running or cancelling (same reference)', () => {
    const action = { type: 'ROOT_UNAVAILABLE', message: 'x' } as const;
    expect(reduce(running, action)).toBe(running);
    expect(reduce(cancelling, action)).toBe(cancelling);
  });
});

describe('ScanCoordinator and the unavailable root', () => {
  const scope: AnalysisScope = { rootPath: '/x', exclusions: [], maxFileBytes: 5_000_000, followSymlinks: false };
  const clock = createFixedClock();

  function setUp(exists: boolean) {
    const walk = vi.fn(async function* () { /* never reached for a missing root */ });
    const stat = vi.fn(async () => (
      { exists, isDirectory: exists, isFile: false, isSymbolicLink: false, size: 0, mtimeMs: 0 }));
    const port: SourceFileSystemPort = {
      walk, readText: vi.fn(async () => ({ status: 'ok' as const, text: '', bytes: new Uint8Array() })), stat, readLog: () => [],
    };
    const coordinator = new ScanCoordinator({
      port, store: new InMemorySnapshotStore(clock), clock, createCancellationToken,
    });
    const seen: ScanLifecycleState[] = [];
    coordinator.subscribe((s) => { seen.push(s); });
    return { coordinator, seen, walk };
  }

  it('a start whose root is missing fails with rootUnavailable, and never walks', async () => {
    const { coordinator, seen, walk } = setUp(false);
    await coordinator.start(approve('p', scope.rootPath, scope, clock), scope);
    const last = seen[seen.length - 1]!;
    expect(last.run.status).toBe('failed');
    expect(last.rootUnavailable).toBe(true);
    expect(last.banner).toBe('Scan failed: The source directory is no longer available: /x');
    expect(walk).not.toHaveBeenCalled();
  });

  it('reportRootUnavailable dispatches ROOT_UNAVAILABLE with the message', () => {
    const { coordinator, seen } = setUp(false);
    coordinator.reportRootUnavailable('/x');
    expect(seen).toHaveLength(1);
    expect(seen[0]!.rootUnavailable).toBe(true);
    expect(seen[0]!.run.status).toBe('idle');
    expect(seen[0]!.banner).toBe('Scan failed: The source directory is no longer available: /x');
  });
});
