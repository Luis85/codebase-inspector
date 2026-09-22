import { describe, expect, it } from 'vitest';
import { buildSnapshotFixture } from '../fixtures/snapshot-builder';
import { buildSourcesModel, formatBytes, runView } from '../../src/ui/read-models/sources';
import type { InventoryRunState } from '../../src/domain/model';

const IDLE: InventoryRunState = { status: 'idle' };

describe('sources model (Part 4 W2/W3/W15)', () => {
  it('shows the real scope of the snapshot on screen', () => {
    const snap = buildSnapshotFixture({ files: 10, directories: 2 });
    const m = buildSourcesModel(snap, IDLE);
    const rows = Object.fromEntries((m.scope ?? []).map((r) => [r.id, r.value]));
    expect(rows.path).toBe(snap.scope.rootPath);
    expect(rows.exclusions).toBe(snap.scope.exclusions.join(', ') || 'None');
    expect(rows.symlinks).toBe('Not followed');
    expect(rows.completeness).toBe('Complete');
  });
  it('has no scope without a snapshot, and the inventory card is then unknown', () => {
    const m = buildSourcesModel(null, IDLE);
    expect(m.scope).toBeNull();
    expect(m.providers.find((p) => p.id === 'inventory')!.state).toBe('unknown');
  });
  it('reports a partial read with measured and included counts', () => {
    const snap = buildSnapshotFixture({ files: 10, directories: 2, unavailable: 2, completeness: 'partial' });
    const m = buildSourcesModel(snap, IDLE);
    expect(m.scope!.find((r) => r.id === 'completeness')!.value).toMatch(/^Partial: 8 of 10 files measured/);
    expect(m.providers.find((p) => p.id === 'inventory')!.state).toBe('partial');
  });
  it('maps every run state', () => {
    const approval = { profileId: 'p', sourceFingerprint: 's', scopeFingerprint: 'c', approvedAt: 'a', operation: 'read-only-inventory' as const };
    expect(runView(IDLE)).toEqual({ kind: 'idle' });
    expect(runView({ status: 'running', runId: 'r', generation: 1, approval, processedFiles: 42 })).toEqual({ kind: 'running', processed: 42 });
    expect(runView({ status: 'cancelling', runId: 'r', generation: 1 })).toEqual({ kind: 'cancelling' });
    expect(runView({ status: 'cancelled', runId: 'r' })).toEqual({ kind: 'cancelled' });
    expect(runView({ status: 'failed', runId: 'r', message: 'EACCES' })).toEqual({ kind: 'failed', message: 'EACCES' });
    expect(runView({ status: 'complete', runId: 'r', snapshotId: 's' })).toEqual({ kind: 'complete' });
  });
  it('labels every non-inventory provider as sample or unknown, never collected', () => {
    const m = buildSourcesModel(buildSnapshotFixture({ files: 3 }), IDLE);
    const others = m.providers.filter((p) => p.id !== 'inventory');
    expect(others.length).toBe(7);
    expect(others.every((p) => p.state === 'sample' || p.state === 'unknown')).toBe(true);
    expect(m.providers.filter((p) => p.state === 'unknown').map((p) => p.id)).toEqual(['secrets', 'runtime']);
    expect(others.every((p) => p.routes.length > 0)).toBe(true);
  });
  it('formats byte limits', () => {
    expect(formatBytes(5_000_000)).toBe('5 MB');
    expect(formatBytes(1_500_000)).toBe('1.5 MB');
    expect(formatBytes(2_048)).toBe('2 KB');
    expect(formatBytes(512)).toBe('512 bytes');
  });
});
