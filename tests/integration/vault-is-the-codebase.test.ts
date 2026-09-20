// The "vault is the codebase" proof (spec §6's own repair, and
// docs/deliverables/Native Codebase City.md's requirement): when the approved source IS
// the vault, the scan must never open the vault's config directory, any other plugin's
// data.json, `.git`, or this plugin's own output.
//
// Against a REAL temporary vault, through the real Node adapter, with the plugin
// already installed -- the fixture scripts/make-benchmark-fixture.mjs produces carries
// `.obsidian/plugins/codebase-inspector/` (dist/'s own files when a build exists), so
// this is the real configuration rather than a bare directory the plugin has never
// been near.
//
// The config directory's NAME is never hardcoded here: `defaultExclusionsFor` takes
// the caller's `vault.configDir`, and the second test below passes a deliberately
// non-default one, because a proof that only ever sees '.obsidian' cannot tell "we
// exclude the configured directory" from "we exclude a directory that happens to be
// called .obsidian".
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { rename } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { collectInventory } from '../../src/application/inventory-collector';
import { defaultExclusionsFor } from '../../src/host/scan-flow';
import { createRealNodePort } from '../fixtures/real-node-port';
import { createCancellationToken } from '../fixtures/cancellation-token';
import { createFixedClock } from '../fixtures/clock';
import type { AnalysisScope, ApprovedInventoryRun, CodebaseSnapshot } from '../../src/domain/model';

const SCRIPT = resolve(process.cwd(), 'scripts', 'make-benchmark-fixture.mjs');

function approvalFor(rootPath: string): ApprovedInventoryRun {
  return {
    profileId: 'vault-is-the-codebase',
    sourceFingerprint: `fp:${rootPath}`,
    scopeFingerprint: 'fp:scope',
    approvedAt: '2026-01-01T00:00:00.000Z',
    operation: 'read-only-inventory',
  };
}

async function scan(root: string, configDir: string): Promise<{ snapshot: CodebaseSnapshot; log: string[] }> {
  const port = createRealNodePort();
  const { token } = createCancellationToken();
  const scope: AnalysisScope = {
    rootPath: root, exclusions: defaultExclusionsFor(configDir),
    maxFileBytes: 1_000_000, followSymlinks: false,
  };
  const snapshot = await collectInventory(port, scope, approvalFor(root), token, createFixedClock());
  return { snapshot, log: port.readLog().map((p) => p.replace(/\\/g, '/')) };
}

let vault: string;

beforeAll(() => {
  vault = mkdtempSync(join(tmpdir(), 'codebase-inspector-vault-'));
  // 60 source files is enough for the property under test and keeps this suite quick;
  // the 1,000-file run of the same generator is the G2 no-write proof's fixture.
  execFileSync(process.execPath, [SCRIPT, '--files', '60', '--out', vault, '--force'], { stdio: 'pipe' });
}, 120_000);

afterAll(() => {
  rmSync(vault, { recursive: true, force: true });
});

describe('vault is the codebase', () => {
  it('never opens the vault config directory, another plugin\'s data.json, .git or its own output', async () => {
    const { snapshot, log } = await scan(vault, '.obsidian');

    // Positive control FIRST: an empty or broken log would satisfy every absence below.
    expect(log.some((p) => p.endsWith('/README.md'))).toBe(true);
    expect(snapshot.entities.filter((e) => e.kind === 'file').length).toBeGreaterThan(50);

    expect(log.filter((p) => p.includes('/.obsidian'))).toEqual([]);
    expect(log.filter((p) => p.endsWith('/other-plugin/data.json'))).toEqual([]);
    expect(log.filter((p) => p.endsWith('/codebase-inspector/data.json'))).toEqual([]);
    expect(log.filter((p) => p.includes('/.git/'))).toEqual([]);
    expect(log.filter((p) => p.includes('/node_modules/'))).toEqual([]);
    expect(log.filter((p) => p.endsWith('/.env'))).toEqual([]);

    // …and nothing under any of them reached the snapshot either, which is the half a
    // read-log check alone would not cover if an entity were ever fabricated.
    const paths = snapshot.entities.map((e) => e.path);
    for (const excluded of ['.obsidian', '.git', 'node_modules', '.env']) {
      expect(paths.filter((p) => p === excluded || p.startsWith(`${excluded}/`)), excluded).toEqual([]);
    }
  }, 120_000);

  it('excludes the ACTUAL configured config directory, not a hardcoded .obsidian', async () => {
    // Rename the generated `.obsidian` to a name nothing in src/** could have guessed.
    await rename(join(vault, '.obsidian'), join(vault, '.my-config'));
    try {
      const { log } = await scan(vault, '.my-config');
      expect(log.some((p) => p.endsWith('/README.md'))).toBe(true);     // positive control
      expect(log.filter((p) => p.includes('/.my-config'))).toEqual([]);

      // The discriminating half: with the WRONG configDir passed, the same directory IS
      // read -- so the exclusion above is the configured name doing the work, not a
      // constant that happens to match.
      const wrong = await scan(vault, '.obsidian');
      expect(wrong.log.some((p) => p.includes('/.my-config/'))).toBe(true);
    } finally {
      await rename(join(vault, '.my-config'), join(vault, '.obsidian'));
    }
  }, 120_000);
});
