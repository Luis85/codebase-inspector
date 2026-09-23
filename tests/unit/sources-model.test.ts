import { describe, expect, it } from 'vitest';
import { buildSnapshotFixture } from '../fixtures/snapshot-builder';
import { buildSourcesModel, formatBytes, runView } from '../../src/ui/read-models/sources';
import { EVIDENCE_SOURCE_NONE, FALLOW_SOURCE } from '../../src/ui/inspector-copy';
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
  it('labels every non-inventory provider as sample or unknown, never collected, while no report is imported', () => {
    const m = buildSourcesModel(buildSnapshotFixture({ files: 3 }), IDLE);
    const others = m.providers.filter((p) => p.id !== 'inventory');
    expect(others.length).toBe(7);
    expect(others.every((p) => p.state === 'sample' || p.state === 'unknown')).toBe(true);
    expect(m.providers.filter((p) => p.state === 'unknown').map((p) => p.id)).toEqual(['fallow', 'secrets', 'runtime']);
    expect(others.every((p) => p.routes.length > 0)).toBe(true);
  });
  it('Part 6 Y37: the fallow card is Unknown without a report, Collected when imported, Stale when older than the snapshot', () => {
    const snap = buildSnapshotFixture({ files: 3 });
    const card = (fallow?: Parameters<typeof buildSourcesModel>[2]) => buildSourcesModel(snap, IDLE, fallow).providers.find((p) => p.id === 'fallow')!;
    expect(card()).toMatchObject({ state: 'unknown', source: EVIDENCE_SOURCE_NONE, title: 'fallow findings', routes: ['quality', 'file'] });
    expect(card({ state: 'current', version: '3.27.0' })).toMatchObject({ state: 'collected', source: FALLOW_SOURCE('3.27.0') });
    expect(card({ state: 'stale', version: '3.21.0' })).toMatchObject({ state: 'stale', source: FALLOW_SOURCE('3.21.0') });
  });
  it('formats byte limits', () => {
    expect(formatBytes(5_000_000)).toBe('5 MB');
    expect(formatBytes(1_500_000)).toBe('1.5 MB');
    expect(formatBytes(2_048)).toBe('2 KB');
    expect(formatBytes(512)).toBe('512 bytes');
  });
  it('picks the unit after rounding, so a limit never reads "1,000 KB", and says "1 byte" (Part 5 V26)', () => {
    expect(formatBytes(999_999)).toBe('1 MB');
    expect(formatBytes(999_950)).toBe('1 MB');
    expect(formatBytes(999_949)).toBe('999.9 KB');
    expect(formatBytes(1_000)).toBe('1 KB');
    expect(formatBytes(999)).toBe('999 bytes');
    expect(formatBytes(1)).toBe('1 byte');
    expect(formatBytes(0)).toBe('0 bytes');
  });
});
