// Step definitions for the SOURCE-SAFETY scenarios: the approved boundary, unreadable
// content, the whole-tree no-write proof, the vault-is-the-codebase repair and the
// cross-profile late-result repair.
//
// Every filesystem assertion here runs against a REAL temporary directory through the
// real Node adapter and the real walker -- never a fake tree. Split from
// evidence-steps.ts for the tests/** 450-line cap; the two share scan-harness.ts.
import { expect } from 'vitest';
import { readFile, symlink } from 'node:fs/promises';
import { join, relative, resolve, sep } from 'node:path';
import { createCancellationToken } from '../../../src/application/scan-coordinator';
import { mayPublish } from '../../../src/application/run-state';
import { collectInventory } from '../../../src/application/inventory-collector';
import { defaultExclusionsFor } from '../../../src/host/scan-flow';
import { createRealNodePort } from '../../fixtures/real-node-port';
import { createFixedClock } from '../../fixtures/clock';
import { makeTempTree, hashTree } from '../../fixtures/temp-tree';
import {
  FIXTURE, approvalFor, harnessOf, listTree, makeScanHarness, runningIdentity, runningRunId, scopeFor,
} from '../scan-harness';
import { put, take } from '../world';
import type { StepTable } from '../feature-runner';
import type { World } from '../world';
import type { AnalysisScope, CodebaseSnapshot } from '../../../src/domain/model';
import type { RunIdentity } from '../../../src/application/run-state';
import type { FileFingerprint } from '../../fixtures/temp-tree';

export const sourceSteps: StepTable<World> = {
  // ---- Respect the approved source boundary ----------------------------------------
  'a source contains a link outside the approved root': async (world) => {
    const outside = await makeTempTree({ 'secret.ts': 'export const secret = 1;\n' });
    const inside = await makeTempTree(FIXTURE);
    world.trees.push(outside, inside);
    // A real junction (works on Windows without Developer Mode; a FILE symlink does
    // not -- see tests/integration/walker-symlinks.test.ts) pointing genuinely OUT of
    // the approved root.
    await symlink(outside.root, join(inside.root, 'escape'),
      process.platform === 'win32' ? 'junction' : undefined);
    put(world, 'root', inside.root);
    put(world, 'outside', outside.root);
  },

  'I run inventory with the default no-follow policy': async (world) => {
    const port = createRealNodePort();
    const scope = scopeFor(take<string>(world, 'root'));
    expect(scope.followSymlinks).toBe(false);
    const { token } = createCancellationToken();
    put(world, 'snapshot',
      await collectInventory(port, scope, approvalFor('profile-A', scope), token, createFixedClock()));
    put(world, 'log', port.readLog());
  },

  'the linked external content is not traversed': (world) => {
    const snapshot = take<CodebaseSnapshot>(world, 'snapshot');
    const outside = take<string>(world, 'outside');
    expect(snapshot.entities.some((e) => e.path.includes('secret.ts'))).toBe(false);
    const log = take<readonly string[]>(world, 'log');
    expect(log.length, 'the read log is vacuously empty').toBeGreaterThan(0);
    expect(log.some((p) => resolve(p).startsWith(resolve(outside)))).toBe(false);
    expect(log.some((p) => p.endsWith(`${sep}a.ts`))).toBe(true);        // positive control
  },

  'the applicable warning or exclusion is inspectable': (world) => {
    const snapshot = take<CodebaseSnapshot>(world, 'snapshot');
    const escaped = snapshot.entities.find((e) => e.path === 'escape');
    expect(escaped, 'the link vanished with no trace at all').toBeDefined();
    const reason = snapshot.observations.find((o) => o.entityId === escaped!.id)?.reason ?? '';
    expect(reason).toMatch(/symlink: not followed/i);
  },

  // ---- Report unreadable content without measured-zero substitution -----------------
  'some included file content cannot be read': async (world) => {
    const tree = await makeTempTree({ ...FIXTURE, 'locked.ts': { unreadable: 'export const x = 1;\n' } });
    world.trees.push(tree);
    put(world, 'root', tree.root);
  },

  'inventory completes with an explicit partial status': async (world) => {
    const port = createRealNodePort();
    const scope = scopeFor(take<string>(world, 'root'));
    const { token } = createCancellationToken();
    const snapshot = await collectInventory(port, scope, approvalFor('profile-A', scope), token, createFixedClock());
    put(world, 'snapshot', snapshot);
    expect(snapshot.completeness).toBe('partial');
  },

  'affected measurements are unavailable with a reason': (world) => {
    const snapshot = take<CodebaseSnapshot>(world, 'snapshot');
    const locked = snapshot.entities.find((e) => e.path === 'locked.ts');
    expect(locked, 'the unreadable file is missing from the snapshot entirely').toBeDefined();
    const observations = snapshot.observations.filter((o) => o.entityId === locked!.id);
    expect(observations.length).toBe(2);
    for (const observation of observations) {
      expect(observation.status).toBe('unavailable');
      expect(observation.reason).toBeTruthy();
    }
  },

  'unreadable content is not assigned a zero physical-line measurement': (world) => {
    const snapshot = take<CodebaseSnapshot>(world, 'snapshot');
    const locked = snapshot.entities.find((e) => e.path === 'locked.ts')!;
    const lines = snapshot.observations.find(
      (o) => o.entityId === locked.id && o.measurement.metricId === 'physical-lines',
    )!;
    expect(lines.value).toBeNull();
    // …and a file that genuinely IS readable still carries a real number, so "never
    // zero" is not being satisfied by measuring nothing at all.
    const readable = snapshot.entities.find((e) => e.path === 'README.md')!;
    const readableLines = snapshot.observations.find(
      (o) => o.entityId === readable.id && o.measurement.metricId === 'physical-lines',
    )!;
    expect(readableLines.status).toBe('measured');
    expect(readableLines.value).toBeGreaterThan(0);
  },

  // ---- Verify unchanged source after a real scan -----------------------------------
  'a controlled fixture repository with recorded file hashes': async (world) => {
    const tree = await makeTempTree({
      ...FIXTURE,
      'binary.dat': { binary: new Uint8Array([0x00, 0x01, 0x02, 0xff]) },
      'unreadable.ts': { unreadable: 'export const secret = 1;\n' },
      '.git/config': '[core]\n',
      'sub dir/ünïcode.ts': 'export const u = 1;\n',
    });
    world.trees.push(tree);
    put(world, 'root', tree.root);
    put(world, 'before', await hashTree(tree.root));
    put(world, 'paths-before', (await listTree(tree.root)).sort());
  },

  'I perform the approved read-only inventory': async (world) => {
    const port = createRealNodePort();
    const scope = scopeFor(take<string>(world, 'root'), ['.git']);
    const { token } = createCancellationToken();
    put(world, 'snapshot',
      await collectInventory(port, scope, approvalFor('profile-A', scope), token, createFixedClock()));
    put(world, 'log', port.readLog());
  },

  'source file contents remain unchanged': async (world) => {
    const root = take<string>(world, 'root');
    const before = take<Record<string, FileFingerprint>>(world, 'before');
    // The WHOLE tree: sha256, size AND mtimeMs for every file, directory and link.
    expect(await hashTree(root)).toEqual(before);
    expect((await listTree(root)).sort()).toEqual(take<string[]>(world, 'paths-before'));
    const snapshot = take<CodebaseSnapshot>(world, 'snapshot');
    expect(snapshot.entities.filter((e) => e.kind === 'file').length).toBeGreaterThan(0);
  },

  'no analyzer, Git command, project script, or package installation has been executed': async (world) => {
    // STRUCTURAL, and deliberately so: "no process was spawned" is not observable after
    // the fact, but "nothing in the shipped source CAN spawn one" is, and it is the
    // stronger statement. src/** is the whole of what ships.
    const srcRoot = resolve(process.cwd(), 'src');
    const files = (await listTree(srcRoot)).filter((p) => /\.(ts|vue)$/.test(p));
    expect(files.length).toBeGreaterThan(50);
    const offenders: string[] = [];
    for (const rel of files) {
      const text = await readFile(join(srcRoot, ...rel.split('/')), 'utf8');
      if (/child_process|execFile|spawnSync|\bspawn\(|\bexecSync\b|npm install/.test(text)) offenders.push(rel);
    }
    expect(offenders).toEqual([]);
    // And the scan itself read nothing outside the approved root.
    const root = resolve(take<string>(world, 'root'));
    for (const path of take<readonly string[]>(world, 'log')) {
      expect(relative(root, resolve(path)).startsWith('..'), path).toBe(false);
    }
  },

  // ---- REPAIR 1: vault is the codebase ---------------------------------------------
  'the vault itself is the approved source': async (world) => {
    const tree = await makeTempTree({
      'notes/note.md': '# note\n',
      'src/a.ts': 'export const a = 1;\n',
      '.git/config': '[core]\n',
      '.my-config/workspace.json': '{}',
      '.my-config/plugins/other-plugin/data.json': '{"token":"secret"}',
      '.my-config/plugins/codebase-inspector/data.json': '{"lastSnapshotId":"abc"}',
    });
    world.trees.push(tree);
    put(world, 'root', tree.root);
  },

  'the vault\'s configured config directory is ".my-config"': (world) => {
    // The ACTUAL vault.configDir, never a hardcoded '.obsidian' -- the caller decides
    // this name and passes it in, which is the whole point of defaultExclusionsFor.
    const exclusions = defaultExclusionsFor('.my-config');
    expect(exclusions).toContain('.my-config');
    put(world, 'exclusions', exclusions);
  },

  'a scan completes': async (world) => {
    const port = createRealNodePort();
    const scope = scopeFor(take<string>(world, 'root'), take<string[]>(world, 'exclusions'));
    const { token } = createCancellationToken();
    const snapshot = await collectInventory(port, scope, approvalFor('vault', scope), token, createFixedClock());
    expect(snapshot.completeness).toBe('complete');
    const log = port.readLog().map((p) => p.replace(/\\/g, '/'));
    put(world, 'log', log);
    // Positive control FIRST: an empty log would satisfy every absence below.
    expect(log.some((p) => p.endsWith('/notes/note.md'))).toBe(true);
  },

  'no path under ".my-config" appears in the filesystem port\'s read log': (world) => {
    expect(take<readonly string[]>(world, 'log').filter((p) => p.includes('/.my-config'))).toEqual([]);
  },

  'no other plugin\'s data.json appears in the read log': (world) => {
    expect(take<readonly string[]>(world, 'log').filter((p) => p.endsWith('/other-plugin/data.json'))).toEqual([]);
  },

  'no path under ".git" appears in the read log': (world) => {
    expect(take<readonly string[]>(world, 'log').filter((p) => p.includes('/.git/'))).toEqual([]);
  },

  'the plugin\'s own outputs are outside collection scope': (world) => {
    // Our OWN data.json lives under the same config directory as every other plugin's,
    // so excluding the DIRECTORY (never a per-plugin list src/adapters/** would have to
    // maintain) is what keeps a refresh from ever re-analysing its own prior output.
    expect(take<readonly string[]>(world, 'log').filter((p) => p.endsWith('/codebase-inspector/data.json')))
      .toEqual([]);
  },

  // ---- REPAIR 3: the cross-profile late result --------------------------------------
  'a scan is running for profile "A"': async (world) => {
    const harness = await makeScanHarness(world);
    const scope = scopeFor(harness.root);
    put(world, 'scope', scope);
    harness.gate.arm();
    put(world, 'promise-A', harness.coordinator.start(approvalFor('profile-A', scope), scope));
    await Promise.resolve();
    put(world, 'runA', runningRunId(harness));
  },

  'the user switches the active profile to "B"': async (world) => {
    const harness = harnessOf(world);
    const scope = take<AnalysisScope>(world, 'scope');
    // A switch while a scan is in flight is REFUSED outright, first: SCAN_STARTED is a
    // no-op while running, so profile B cannot begin behind profile A's back.
    await harness.coordinator.start(approvalFor('profile-B', scope), scope);
    expect(harness.coordinator.getLifecycle().approval?.profileId).toBe('profile-A');
    // So the switch does what the product does: it stops profile A's run, then starts
    // profile B's, which completes and becomes what the view shows.
    harness.coordinator.cancel(take<string>(world, 'runA'));
    harness.gate.open();
    await take<Promise<void>>(world, 'promise-A');
    await harness.coordinator.start(approvalFor('profile-B', scope), scope);
    expect(harness.coordinator.state.status).toBe('complete');
    put(world, 'snapshot-B', harness.displayedSnapshotId);
  },

  'profile "A"\'s scan completes': (world) => {
    const harness = harnessOf(world);
    const profileA = runningIdentity(harness, 'profile-A');
    // Deliberately given a HIGHER generation than anything profile B issued: a rule
    // that compared generations alone, or runIds alone, would publish this.
    put(world, 'late', { ...profileA.identity, generation: 99 });
  },

  'nothing is published': (world) => {
    const harness = harnessOf(world);
    const profileB = runningIdentity(harness, 'profile-B');
    const late = take<RunIdentity>(world, 'late');
    expect(late.profileId).toBe('profile-A');
    expect(profileB.identity.profileId).toBe('profile-B');
    // Judged against the state the coordinator ACTUALLY held while profile B was
    // running -- the moment a cross-profile late result would have to be refused.
    expect(mayPublish(late, profileB.identity, profileB.state.run)).toBe(false);
    expect(harness.completions).toBe(1);
  },

  'profile "B"\'s snapshot is unchanged': (world) => {
    const harness = harnessOf(world);
    const snapshotId = take<string>(world, 'snapshot-B');
    expect(harness.displayedSnapshotId).toBe(snapshotId);
    expect(harness.store.get(snapshotId)!.repositoryId).toBe('profile-B');
    expect(harness.coordinator.getLifecycle().publishedSnapshotId).toBe(snapshotId);
  },
};
