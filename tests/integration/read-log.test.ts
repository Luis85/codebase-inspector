// The read-log proof (spec 6): the filesystem port records every path it opens; this
// test asserts the ABSENCE of a read for excluded paths, and the PRESENCE of one for an
// included path — proving the log itself is live, not merely empty (a read-log test
// that would pass against an empty log proves nothing).
import { afterEach, describe, expect, it } from 'vitest';
import { collectInventory } from '../../src/application/inventory-collector';
import { defaultExclusionsFor } from '../../src/host/scan-flow';
import { createRealNodePort } from '../fixtures/real-node-port';
import { createCancellationToken } from '../fixtures/cancellation-token';
import { createFixedClock } from '../fixtures/clock';
import { makeTempTree } from '../fixtures/temp-tree';
import type { TempTree, TempTreeSpec } from '../fixtures/temp-tree';
import type { AnalysisScope, ApprovedInventoryRun } from '../../src/domain/model';

const trees: TempTree[] = [];
afterEach(async () => {
  await Promise.all(trees.splice(0).map((t) => t.cleanup()));
});

function approvalFor(rootPath: string): ApprovedInventoryRun {
  return {
    profileId: 'read-log-proof',
    sourceFingerprint: `fp:${rootPath}`,
    scopeFingerprint: 'fp:scope',
    approvedAt: '2026-01-01T00:00:00.000Z',
    operation: 'read-only-inventory',
  };
}

async function scan(spec: TempTreeSpec, exclusions: readonly string[]): Promise<readonly string[]> {
  const tree = await makeTempTree(spec);
  trees.push(tree);
  const port = createRealNodePort();
  const { token } = createCancellationToken();
  const clock = createFixedClock();
  const scope: AnalysisScope = { rootPath: tree.root, exclusions, maxFileBytes: 1_000_000, followSymlinks: false };
  await collectInventory(port, scope, approvalFor(tree.root), token, clock);
  return port.readLog();
}

describe('read-log proof', () => {
  // Fix round 3, ruling M44 (Critical); extended fix round 4 (Important, .env): task
  // 5's own read-log proof (below) always passed exclusions explicitly, so it never
  // covered what a NEW profile actually excludes with none of that spelled out by hand
  // -- which is exactly the gap that let "0 files found" (an unbounded scan reading
  // .git, node_modules and the vault config directory) ship. This applies the same
  // technique to `defaultExclusionsFor` itself, not a hand-picked list, over a real
  // temporary tree. Checkpoint #2's own safety line names `.git`, `.env` and the vault
  // config directory explicitly -- a fixture with no `.env` would pass that line by
  // ABSENCE, not by exclusion, so this fixture deliberately includes one.
  it('excludes .git, node_modules, .env and the vault config directory by DEFAULT -- the same defaults a newly created profile actually carries', async () => {
    const log = await scan({
      'src/a.ts': 'export const a = 1;\n',
      '.git/config': '[core]\n',
      'node_modules/pkg/index.js': 'module.exports = {};\n',
      '.env': 'SECRET=hunter2\n',
      '.obsidian/workspace.json': '{}',
    }, defaultExclusionsFor('.obsidian'));

    expect(log.some((p) => p.includes('.git'))).toBe(false);
    expect(log.some((p) => p.includes('node_modules'))).toBe(false);
    expect(log.some((p) => p.replace(/\\/g, '/').endsWith('/.env'))).toBe(false);
    expect(log.some((p) => p.includes('.obsidian'))).toBe(false);
    // Positive control: the log is real, not vacuously empty.
    expect(log.some((p) => p.replace(/\\/g, '/').endsWith('src/a.ts'))).toBe(true);
  });

  it('never reads an excluded path, proving absence of a read', async () => {
    const log = await scan({
      'src/a.ts': 'export const a = 1;\n',
      '.env': 'SECRET=hunter2\n',
      '.git/config': '[core]\n',
      '.obsidian/plugins/other/data.json': '{"token":"secret"}',
    }, ['.env', '.git', '.obsidian']);

    expect(log.some((p) => p.includes('.env'))).toBe(false);
    expect(log.some((p) => p.includes('.git'))).toBe(false);
    expect(log.some((p) => p.includes('data.json'))).toBe(false);
    // The log is real, not vacuously empty: an INCLUDED path was genuinely opened.
    expect(log.some((p) => p.replace(/\\/g, '/').endsWith('src/a.ts'))).toBe(true);
  });

  it('excludes the vault config directory when the vault IS the codebase', async () => {
    // The actual vault.configDir, not a hard-coded '.obsidian' — the caller (never
    // src/adapters/**) decides this name and passes it as an exclusion.
    const log = await scan({
      'notes/note.md': '# note\n',
      '.my-config/workspace.json': '{}',
      '.my-config/plugins/other/data.json': '{"token":"secret"}',
    }, ['.my-config']);

    expect(log.some((p) => p.includes('.my-config'))).toBe(false);
    expect(log.some((p) => p.replace(/\\/g, '/').endsWith('notes/note.md'))).toBe(true);
  });

  it('keeps plugin outputs outside collection scope, so refresh never self-analyses', async () => {
    // Our OWN plugin's settings/output file lives under the same config directory as
    // every other plugin's — excluding the whole config directory (not a per-plugin
    // list src/adapters/** would have to maintain) is what keeps a refresh from ever
    // reading, and therefore never re-analysing, its own prior output.
    //
    // Fix-round-1 MINOR finding 5: makeTempTree names every temp root
    // `codebase-inspector-fixture-*`, so `p.includes('codebase-inspector')` was true for
    // EVERY logged path regardless of what it actually checked — the assertion reduced
    // to `p.includes('data.json')`, which does not distinguish our own plugin's output
    // from any other plugin's, despite the test's name and comment claiming it does.
    // Discriminates on the plugin FOLDER path itself instead, and adds a positive
    // control (tests 1 and 2 both have one; this one previously did not), so the test
    // cannot pass against an empty or broken log either.
    const log = await scan({
      'src/a.ts': 'export const a = 1;\n',
      '.obsidian/plugins/codebase-inspector/data.json': '{"lastSnapshotId":"abc"}',
      '.obsidian/plugins/other/data.json': '{"token":"secret"}',
    }, ['.obsidian']);

    const normalized = log.map((p) => p.replace(/\\/g, '/'));
    expect(normalized.some((p) => p.endsWith('/plugins/codebase-inspector/data.json'))).toBe(false);
    expect(normalized.some((p) => p.endsWith('/plugins/other/data.json'))).toBe(false);
    // Positive control: the log is real, not vacuously empty.
    expect(normalized.some((p) => p.endsWith('src/a.ts'))).toBe(true);
  });
});
