// The no-source-write proof (spec 6): a PROOF, not an assertion — hash every file in the
// fixture tree before and after a scan, including modification times, and diff the
// WHOLE tree. A spot check on one file would not catch a write to a different one; only
// a full-tree diff proves the collector never touches the inspected project.
import { afterEach, describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { collectInventory } from '../../src/application/inventory-collector';
import { createRealNodePort } from '../fixtures/real-node-port';
import { createCancellationToken } from '../fixtures/cancellation-token';
import { createFixedClock } from '../fixtures/clock';
import { makeTempTree, hashTree } from '../fixtures/temp-tree';
import { defaultExclusionsFor } from '../../src/host/scan-flow';
import type { TempTree, TempTreeSpec } from '../fixtures/temp-tree';
import type { AnalysisScope, ApprovedInventoryRun } from '../../src/domain/model';

// Task 12 step 3: the same proof at FULL SCALE, over the 1,000-file functional fixture,
// WITH THE PLUGIN ALREADY INSTALLED -- the generator plants dist/'s own files under
// `.obsidian/plugins/codebase-inspector/`, so this covers the real configuration rather
// than a bare directory the plugin has never been near.
//
// Cached under the OS temp directory (NEVER inside the repository) and keyed by file
// count, so a re-run reuses the tree instead of regenerating ~20 MB. `--force` is not
// passed: the generator's own marker file decides.
const GENERATOR = resolve(process.cwd(), 'scripts', 'make-benchmark-fixture.mjs');
const FULL_SCALE_ROOT = join(tmpdir(), 'codebase-inspector-benchmark', 'functional-1000');

interface FixtureManifest { root: string; sourceFiles: number; excludedDirs: string[] }

function ensureFullScaleFixture(): FixtureManifest {
  mkdirSync(join(tmpdir(), 'codebase-inspector-benchmark'), { recursive: true });
  execFileSync(process.execPath, [GENERATOR, '--files', '1000', '--out', FULL_SCALE_ROOT], { stdio: 'pipe' });
  return JSON.parse(readFileSync(join(FULL_SCALE_ROOT, '.benchmark-fixture.json'), 'utf8')) as FixtureManifest;
}

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

  // ---- Full scale, with the plugin installed (task-12-brief.md step 3) --------------
  it('changes nothing in a 1,000-file tree with the plugin already installed', async () => {
    const manifest = ensureFullScaleFixture();
    expect(manifest.sourceFiles).toBe(1000);
    const before = await hashTree(FULL_SCALE_ROOT);

    const scope: AnalysisScope = {
      rootPath: FULL_SCALE_ROOT,
      // The exclusions a newly created profile actually carries -- not a hand-picked
      // list -- so the proof covers what the product really does.
      exclusions: defaultExclusionsFor('.obsidian'),
      maxFileBytes: 1_000_000, followSymlinks: false,
    };
    const port = createRealNodePort();
    const { token } = createCancellationToken();
    const snapshot = await collectInventory(port, scope, approvalFor(FULL_SCALE_ROOT), token, createFixedClock());

    // Liveness: a scan that silently did nothing would satisfy the diff below trivially.
    const measured = snapshot.observations.filter((o) => o.status === 'measured');
    expect(snapshot.entities.filter((e) => e.kind === 'file').length).toBeGreaterThan(900);
    expect(measured.length).toBeGreaterThan(900);
    expect(port.readLog().length).toBeGreaterThan(900);

    const after = await hashTree(FULL_SCALE_ROOT);
    // The WHOLE tree: sha256 + size + mtimeMs for every file, directory and link.
    expect(Object.keys(after).length).toBe(Object.keys(before).length);
    expect(after).toEqual(before);

    // …and, separately, the INSPECTED tree alone. The brief is explicit that unavoidable
    // Obsidian workspace updates must not be compared as if they were source-code
    // modifications; nothing writes to `.obsidian` here (no Obsidian is running), but
    // the inspected subset is asserted in its own right so a future run inside a live
    // host can use the same assertion without weakening it.
    const inspectedOnly = (tree: Record<string, unknown>): Record<string, unknown> => (
      Object.fromEntries(Object.entries(tree).filter(
        ([path]) => !manifest.excludedDirs.some((dir) => path === dir || path.startsWith(`${dir}/`)),
      ))
    );
    const inspectedBefore = inspectedOnly(before);
    expect(Object.keys(inspectedBefore).length).toBeGreaterThan(1000);
    expect(inspectedOnly(after)).toEqual(inspectedBefore);
  }, 180_000);
});
