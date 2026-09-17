// The no-source-write proof (spec 6): a PROOF, not an assertion — hash every file in the
// fixture tree before and after a scan, including modification times, and diff the
// WHOLE tree. A spot check on one file would not catch a write to a different one; only
// a full-tree diff proves the collector never touches the inspected project.
import { afterEach, describe, expect, it } from 'vitest';
import { collectInventory } from '../../src/application/inventory-collector';
import { createRealNodePort } from '../fixtures/real-node-port';
import { createCancellationToken } from '../fixtures/cancellation-token';
import { createFixedClock } from '../fixtures/clock';
import { makeTempTree, hashTree } from '../fixtures/temp-tree';
import type { TempTree, TempTreeSpec } from '../fixtures/temp-tree';
import type { AnalysisScope, ApprovedInventoryRun } from '../../src/domain/model';

const FIXTURE: TempTreeSpec = {
  'src/a.ts': 'export const a = 1;\n',
  'src/nested/b.ts': 'export const b = 2;\n',
  'README.md': '# Fixture\n',
  'binary.dat': { binary: new Uint8Array([0x00, 0x01, 0x02, 0xff]) },
  'unreadable.ts': { unreadable: 'export const secret = 1;\n' },
  linked: { symlinkTo: 'src' },
};

const trees: TempTree[] = [];
afterEach(async () => {
  await Promise.all(trees.splice(0).map((t) => t.cleanup()));
});

function approvalFor(rootPath: string): ApprovedInventoryRun {
  return {
    profileId: 'no-write-proof',
    sourceFingerprint: `fp:${rootPath}`,
    scopeFingerprint: 'fp:scope',
    approvedAt: '2026-01-01T00:00:00.000Z',
    operation: 'read-only-inventory',
  };
}

describe('no-source-writes proof', () => {
  it('changes no file in the inspected project, including modification times', async () => {
    const tree = await makeTempTree(FIXTURE);
    trees.push(tree);
    const before = await hashTree(tree.root);

    const scope: AnalysisScope = {
      rootPath: tree.root, exclusions: [], maxFileBytes: 1_000_000, followSymlinks: false,
    };
    const port = createRealNodePort();
    const { token } = createCancellationToken();
    const clock = createFixedClock();

    const snapshot = await collectInventory(port, scope, approvalFor(tree.root), token, clock);
    // Fix-round-1 IMPORTANT finding 2: `entities.length > 0` was the sole liveness guard
    // here, and collectInventory ALWAYS pushes a repository entity regardless of what the
    // walk found — so a regression that silently stopped the walk (everything excluded,
    // or the walk failing over and returning nothing) would still satisfy that assertion
    // (reviewer measurement: entities: 1, files: 0, completeness: 'complete'). Assert the
    // SPECIFIC entities and observations this fixture must produce, so an empty or
    // truncated scan actually fails this proof instead of passing it falsely.
    const filesByPath = new Map(
      snapshot.entities.filter((e) => e.kind === 'file').map((e) => [e.path, e] as const),
    );
    for (const measuredPath of ['src/a.ts', 'src/nested/b.ts', 'README.md']) {
      const entity = filesByPath.get(measuredPath);
      expect(entity, measuredPath).toBeDefined();
      const observations = snapshot.observations.filter((o) => o.entityId === entity!.id);
      expect(observations, measuredPath).toHaveLength(2);
      expect(observations.every((o) => o.status === 'measured'), measuredPath).toBe(true);
    }
    for (const unavailablePath of ['binary.dat', 'unreadable.ts']) {
      const entity = filesByPath.get(unavailablePath);
      expect(entity, unavailablePath).toBeDefined();
      const observations = snapshot.observations.filter((o) => o.entityId === entity!.id);
      expect(observations, unavailablePath).toHaveLength(2);
      expect(observations.every((o) => o.status === 'unavailable'), unavailablePath).toBe(true);
    }

    const after = await hashTree(tree.root);
    // The whole tree, not a spot check: content (sha256), size AND mtimeMs for every
    // file — a write that only touched a timestamp, or only one file among several,
    // would still fail this single assertion.
    expect(after).toEqual(before);
  });
});
