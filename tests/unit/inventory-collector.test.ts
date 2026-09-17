import { describe, expect, it } from 'vitest';
import { collectInventory, CancellationError } from '../../src/application/inventory-collector';
import { createFakeSourceFileSystem } from '../fixtures/fake-source-filesystem';
import type { FakeTree } from '../fixtures/fake-source-filesystem';
import { createCancellationToken } from '../fixtures/cancellation-token';
import { createFixedClock } from '../fixtures/clock';
import type { AnalysisScope, ApprovedInventoryRun } from '../../src/domain/model';

const SCOPE: AnalysisScope = {
  rootPath: '/fake-root', exclusions: ['excluded'], maxFileBytes: 100, followSymlinks: false,
};

const APPROVAL: ApprovedInventoryRun = {
  profileId: 'repo-1',
  sourceFingerprint: 'fp-source',
  scopeFingerprint: 'fp-scope',
  approvedAt: '2026-01-01T00:00:00.000Z',
  operation: 'read-only-inventory',
};

function setUp(tree: FakeTree) {
  const { port } = createFakeSourceFileSystem(tree);
  const { token } = createCancellationToken();
  const clock = createFixedClock('2026-02-01T00:00:00.000Z');
  return { port, token, clock };
}

describe('collectInventory', () => {
  it('produces a valid, complete snapshot for an all-measured tree', async () => {
    const { port, token, clock } = setUp({
      'src/a.ts': 'export const a = 1;\n',
      'src/nested/b.ts': 'line one\nline two\n',
    });
    const snapshot = await collectInventory(port, SCOPE, APPROVAL, token, clock);

    expect(snapshot.completeness).toBe('complete');
    expect(snapshot.warnings).toEqual([]);
    expect(snapshot.providerRun.provider).toBe('builtin-inventory');
    expect(snapshot.providerRun.origin).toBe('collected');
    expect(snapshot.providerRun.completedAt).not.toBeNull();
    expect(snapshot.repositoryId).toBe('repo-1');

    const fileEntities = snapshot.entities.filter((e) => e.kind === 'file');
    expect(fileEntities.map((e) => e.path).sort()).toEqual(['src/a.ts', 'src/nested/b.ts']);

    const dirEntities = snapshot.entities.filter((e) => e.kind === 'directory');
    expect(dirEntities.map((e) => e.path).sort()).toEqual(['src', 'src/nested']);

    // Two observations per KEPT file: physical-lines and byte-size, both measured.
    const aId = fileEntities.find((e) => e.path === 'src/a.ts')!.id;
    const aObservations = snapshot.observations.filter((o) => o.entityId === aId);
    expect(aObservations).toHaveLength(2);
    expect(aObservations.every((o) => o.status === 'measured')).toBe(true);
    const lines = aObservations.find((o) => o.measurement.metricId === 'physical-lines')!;
    expect(lines.value).toBe(1);
    const bytes = aObservations.find((o) => o.measurement.metricId === 'byte-size')!;
    expect(bytes.value).toBe('export const a = 1;\n'.length);
  });

  it('never coerces an unavailable metric to 0, for either metric, and marks the run partial', async () => {
    const { port, token, clock } = setUp({
      'kept.ts': 'export const a = 1;\n',
      'binary.dat': { binary: true },
      'oversized.ts': { oversizedBytes: 1000 },
    });
    const snapshot = await collectInventory(port, SCOPE, APPROVAL, token, clock);

    expect(snapshot.completeness).toBe('partial');
    expect(snapshot.warnings.length).toBeGreaterThan(0);

    const binaryEntity = snapshot.entities.find((e) => e.path === 'binary.dat')!;
    expect(binaryEntity).toBeDefined();
    const binaryObservations = snapshot.observations.filter((o) => o.entityId === binaryEntity.id);
    expect(binaryObservations).toHaveLength(2);
    for (const obs of binaryObservations) {
      expect(obs.status).toBe('unavailable');
      expect(obs.value).toBeNull();
      expect(obs.reason).toEqual(expect.any(String));
      expect(obs.reason!.length).toBeGreaterThan(0);
    }
  });

  it('excludes paths before ever reading them', async () => {
    const { port, token, clock } = setUp({
      'kept.ts': 'export const a = 1;\n',
      'excluded/secret.ts': 'export const s = 1;\n',
    });
    const snapshot = await collectInventory(port, SCOPE, APPROVAL, token, clock);
    expect(snapshot.entities.some((e) => e.path.startsWith('excluded'))).toBe(false);
    expect(port.readLog().some((p) => p.includes('excluded'))).toBe(false);
  });

  it('rejects with CancellationError and produces no snapshot when cancelled', async () => {
    const { port, clock } = setUp({ 'a.ts': 'x\n', 'b.ts': 'y\n', 'c.ts': 'z\n' });
    const { token, cancel } = createCancellationToken();
    cancel();
    await expect(collectInventory(port, SCOPE, APPROVAL, token, clock)).rejects.toBeInstanceOf(CancellationError);
  });

  it('returns a snapshot that independently passes validateSnapshot', async () => {
    const { port, token, clock } = setUp({ 'a.ts': 'x\ny\n' });
    const snapshot = await collectInventory(port, SCOPE, APPROVAL, token, clock);
    const { validateSnapshot } = await import('../../src/domain/validator');
    expect(() => validateSnapshot(JSON.parse(JSON.stringify(snapshot)) as unknown)).not.toThrow();
  });
});
