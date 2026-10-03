import { describe, expect, it, beforeEach } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { useRunStore } from '../../src/ui/stores/run-store';
import { CANCELLED_BANNER } from '../../src/application/run-state';
import type { ApprovedInventoryRun } from '../../src/domain/model';

// Not in task-9-brief.md's own required test list (only escape-intent.test.ts and
// city-store.test.ts are named) — added because run-store.ts is new production code
// this task ships, and the non-negotiables require a failing test before any
// implementation, every time, not only where the brief happens to name a file.
describe('useRunStore — mirrors InventoryRunState (spec 4.1)', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  const approval: ApprovedInventoryRun = {
    profileId: 'p1', sourceFingerprint: 'sf', scopeFingerprint: 'cf',
    approvedAt: '2026-01-01T00:00:00.000Z', operation: 'read-only-inventory',
  };

  it('starts idle', () => {
    const store = useRunStore();
    expect(store.run.status).toBe('idle');
  });

  it('mirrors a running lifecycle, including processedFiles', () => {
    const store = useRunStore();
    store.setLifecycle({
      run: { status: 'running', runId: 'r1', generation: 0, approval, processedFiles: 3 },
      approval, generation: 0, publishedSnapshotId: null, banner: null,
      selectedEntityId: null, query: '',
    });
    expect(store.run).toEqual({ status: 'running', runId: 'r1', generation: 0, approval, processedFiles: 3 });
    expect(store.banner).toBeNull();
  });

  it('carries the coordinator banner through unchanged for a cancelled run', () => {
    const store = useRunStore();
    store.setLifecycle({
      run: { status: 'cancelled', runId: 'r1' },
      approval: null, generation: 0, publishedSnapshotId: 'snap-old', banner: CANCELLED_BANNER,
      selectedEntityId: null, query: '',
    });
    expect(store.banner).toBe(CANCELLED_BANNER);
    expect(store.run.status).toBe('cancelled');
  });

  it('never mutates the ScanLifecycleState object it was handed', () => {
    const store = useRunStore();
    const lifecycle = {
      run: { status: 'idle' as const },
      approval: null, generation: 0, publishedSnapshotId: null, banner: null,
      selectedEntityId: null, query: '',
    };
    const before = JSON.stringify(lifecycle);
    store.setLifecycle(lifecycle);
    expect(JSON.stringify(lifecycle)).toBe(before);
  });

  it('each call to useRunStore() under its own pinia instance is independent (spec 4.4)', () => {
    const storeA = useRunStore();
    setActivePinia(createPinia());
    const storeB = useRunStore();
    storeA.setLifecycle({
      run: { status: 'running', runId: 'rA', generation: 0, approval, processedFiles: 1 },
      approval, generation: 0, publishedSnapshotId: null, banner: null,
      selectedEntityId: null, query: '',
    });
    expect(storeB.run.status).toBe('idle');
  });
});
