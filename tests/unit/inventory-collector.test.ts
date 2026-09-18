import { describe, expect, it } from 'vitest';
import { collectInventory, CancellationError } from '../../src/application/inventory-collector';
import { createFakeSourceFileSystem } from '../fixtures/fake-source-filesystem';
import type { FakeTree } from '../fixtures/fake-source-filesystem';
import { createCancellationToken } from '../fixtures/cancellation-token';
import { createFixedClock } from '../fixtures/clock';
import type { AnalysisScope, ApprovedInventoryRun } from '../../src/domain/model';
import type { SourceFileSystemPort } from '../../src/application/ports/source-filesystem-port';

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

  // CRITICAL fix-round-1 finding 1, RESTRUCTURED at fix round 3 (ruling M45): this used
  // to cancel from inside a SEPARATE per-file readText() loop that ran after the walk
  // finished. That second loop no longer exists — the walk itself now does the only read
  // a kept file gets (see inventory-collector.ts), so there is nothing left to wrap by
  // wrapping readText(); cancelling that way would never fire at all, since collectInventory
  // never calls it. The underlying invariant this test protects — a cancellation noticed
  // while files are still being read must stop the scan promptly, not resolve with a full,
  // publishable snapshot (ruling M21) — is unchanged and, if anything, now enforced
  // earlier: reading happens INSIDE the already cancellation-checked walk loop, so this
  // cancels from inside the walk's own iteration instead, after the FIRST kept file has
  // already been yielded (and therefore already read).
  it('rejects and stops reading further files when cancelled during the walk (which now does the only read)', async () => {
    const { port, clock } = setUp({
      'a.ts': 'a\n', 'b.ts': 'b\n', 'c.ts': 'c\n', 'd.ts': 'd\n',
    });
    const { token, cancel } = createCancellationToken();
    let filesYielded = 0;
    const wrappedPort: SourceFileSystemPort = {
      ...port,
      walk: (root, opts, walkToken) => ({
        async *[Symbol.asyncIterator]() {
          for await (const entry of port.walk(root, opts, walkToken)) {
            if (entry.kind === 'file') {
              filesYielded += 1;
              if (filesYielded === 1) cancel();   // fires once the first kept file is read
            }
            yield entry;
          }
        },
      }),
    };

    await expect(collectInventory(wrappedPort, SCOPE, APPROVAL, token, clock))
      .rejects.toBeInstanceOf(CancellationError);
    // Stopped promptly: only the FIRST file was ever read — the walk noticed the
    // cancellation (checked at the top of its own per-entry loop) before processing a
    // second entry, not after reading all four kept files (which is what the
    // uncancelled path would have done).
    expect(filesYielded).toBe(1);
  });

  // Fix-round-1 MINOR finding 8: a genuine walk failure (spec 7's "a failed run") must
  // propagate distinguishably from a cancellation, and must not resolve with a snapshot.
  it('propagates a genuine walk failure, distinguishable from CancellationError, with no snapshot', async () => {
    const { port, token, clock } = setUp({ 'a.ts': 'x\n' });
    const rootFailure = new Error('EACCES: permission denied, scandir /fake-root');
    const failingPort: SourceFileSystemPort = {
      ...port,
      walk: () => ({
        [Symbol.asyncIterator]() {
          return {
            next: (): Promise<IteratorResult<never>> => Promise.reject(rootFailure),
          };
        },
      }),
    };
    await expect(collectInventory(failingPort, SCOPE, APPROVAL, token, clock)).rejects.toBe(rootFailure);
    // Not disguised as cancellation — the token was never cancelled.
    expect(token.cancelled).toBe(false);
  });

  // Fix-round-1 MINOR finding 7: a skipped DIRECTORY must never become a `kind: 'file'`
  // CodeEntity carrying a file category — it should not become any CodeEntity at all,
  // since nothing is known about its contents, but its reason must still surface in
  // `warnings` (never dropped silently, per spec 7).
  it('never turns a skipped DIRECTORY into a file-kind entity, but still surfaces its reason', async () => {
    const { port, clock } = setUp({ 'kept.ts': 'x\n' });
    const { token } = createCancellationToken();
    const directoryReason = 'directory is unreadable: EACCES';
    const portWithDirectorySkip: SourceFileSystemPort = {
      ...port,
      walk: (root, opts, walkToken) => ({
        async* [Symbol.asyncIterator]() {
          for await (const entry of port.walk(root, opts, walkToken)) yield entry;
          yield { kind: 'skipped', relativePath: 'locked', reason: directoryReason, wasDirectory: true };
        },
      }),
    };
    const snapshot = await collectInventory(portWithDirectorySkip, SCOPE, APPROVAL, token, clock);

    expect(snapshot.entities.some((e) => e.path === 'locked')).toBe(false);
    expect(snapshot.observations.some((o) => snapshot.entities.find((e) => e.id === o.entityId)?.path === 'locked')).toBe(false);
    expect(snapshot.completeness).toBe('partial');
    expect(snapshot.warnings).toContain(directoryReason);
  });

  it('returns a snapshot that independently passes validateSnapshot', async () => {
    const { port, token, clock } = setUp({ 'a.ts': 'x\ny\n' });
    const snapshot = await collectInventory(port, SCOPE, APPROVAL, token, clock);
    const { validateSnapshot } = await import('../../src/domain/validator');
    expect(() => validateSnapshot(JSON.parse(JSON.stringify(snapshot)) as unknown)).not.toThrow();
  });
});
