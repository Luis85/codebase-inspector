// Step definitions for the SOURCE-SAFETY scenarios: the approved boundary, unreadable
// content, the whole-tree no-write proof, the vault-is-the-codebase repair and the
// cross-profile late-result repair.
//
// Every filesystem assertion here runs against a REAL temporary directory through the
// real Node adapter and the real walker -- never a fake tree. The cross-profile repair
// is the one exception and says why in its own comment: it needs two real CityViews and
// a walk it can hold open mid-flight, so it uses the fake port through the same
// `gatedPort` wrapper, which drives the SAME `walkTree` generator the real adapter does.
// Split from evidence-steps.ts for the tests/** 450-line cap; the two share
// scan-harness.ts.
import { expect } from 'vitest';
import { readFile, symlink } from 'node:fs/promises';
import { join, relative, resolve, sep } from 'node:path';
import { nextTick } from 'vue';
import { createCancellationToken } from '../../../src/application/scan-coordinator';
import { collectInventory } from '../../../src/application/inventory-collector';
import { defaultExclusionsFor } from '../../../src/host/scan-flow';
import { createRealNodePort } from '../../fixtures/real-node-port';
import { createFakeSourceFileSystem } from '../../fixtures/fake-source-filesystem';
import { createFixedClock } from '../../fixtures/clock';
import { makeTempTree, hashTree } from '../../fixtures/temp-tree';
import {
  FIXTURE, approvalFor, gatedPort, listTree, makeGate, scopeFor,
} from '../scan-harness';
import { makeViewHarness, rows } from '../view-harness';
import { put, take } from '../world';
import type { StepTable } from '../feature-runner';
import type { World } from '../world';
import type { Gate } from '../scan-harness';
import type { ViewHarness } from '../view-harness';
import type { CityView } from '../../../src/host/city-view';
import type { CodebaseProfile, CodebaseSnapshot } from '../../../src/domain/model';
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
  //
  // REWRITTEN IN FIX ROUND 1. The first version of these steps evaluated `mayPublish(...)`
  // directly and asserted its answer. That proved the PREDICATE, not the product: the
  // reviewer disabled the production guard outright (`scan-coordinator.ts` ->
  // `if (false && !mayPublish(...))`) and the whole acceptance suite stayed green,
  // because nothing in the scenario ever delivered a result to anything. That is this
  // branch's own defect class arriving inside the artefact meant to be immune to it, and
  // the fix is to deliver a REAL late result and assert it is not published.
  //
  // WHAT "CROSS-PROFILE" MEANS IN THIS ARCHITECTURE, and why the delivery happens where
  // it does. `ScanCoordinator` is ONE PER CityView (city-view.ts), and `SCAN_STARTED`
  // no-ops while a run is running or cancelling -- so within a single coordinator a
  // second profile cannot begin behind the first's back, and the PROFILE component of
  // `mayPublish`'s identity tuple is unreachable by construction (scan-coordinator.ts
  // says so itself, at length; the reviewer confirmed it independently). The place a
  // profile-A result really can reach a profile-B surface is the MULTI-LEAF delivery
  // path: `city-view.ts`'s own `onLifecycleChange` calls `reconcileEveryView`, which
  // offers every open leaf the completed snapshot, and `view-reconciliation.ts` is what
  // refuses it for a leaf on a different profile. That refusal is production code, with
  // a production caller, reachable by any user with two leaves open -- and it is what
  // these steps now exercise end to end, from `view.startScan()` through the real
  // modal-free refresh path, the real coordinator, the real collector and the real
  // reconciliation fan-out.
  'a scan is running for profile "A"': async (world) => {
    const gate = makeGate();
    // NOT `exclusions: []`: `resolveOrCreateProfile` treats an empty list as ruling
    // M44's migration trigger and fills it with the defaults, which would then diverge
    // from the snapshot's recorded scope and send `runRefresh` into the scope modal.
    const scope = { exclusions: ['.git'], maxFileBytes: 5_000_000 };
    const profile = (profileId: string): CodebaseProfile => (
      { profileId, name: profileId, bindingId: null, ...scope }
    );
    const { port: fake, root } = createFakeSourceFileSystem({
      'src/a.ts': 'export const a = 1;\n',
      'src/b.ts': 'export const b = 2;\n',
      'README.md': '# fixture\n',
    });
    const harness = makeViewHarness(world, {
      port: gatedPort(fake, gate),
      profiles: [profile('profile-A'), profile('profile-B')],
      // The retained snapshot's recorded scope is what a REFRESH re-approves against, so
      // it has to name a root this port can actually walk -- and it has to fingerprint
      // identically to the profile's own scope, or `runRefresh` diverges into the scope
      // modal instead of scanning (ruling M57).
      patchSnapshot: (snapshot) => ({ ...snapshot, scope: { ...snapshot.scope, rootPath: root, ...scope } }),
    });
    put(world, 'view', harness);
    put(world, 'gate', gate);
    const viewA = await harness.open('profile-A', 3);
    put(world, 'leafA', viewA);

    gate.arm();
    // The REAL entry point, the one the scan-codebase command reaches. With a retained
    // snapshot whose scope has not diverged, `runRefresh` opens no modal at all: it
    // self-mints an approval against the stored scope and starts the coordinator.
    put(world, 'scan-A', viewA.startScan());
    for (let i = 0; i < 500 && !viewA.isScanRunning(); i += 1) await Promise.resolve();
    expect(viewA.isScanRunning(), 'profile A never actually started scanning').toBe(true);
  },

  'the user switches the active profile to "B"': async (world) => {
    const harness = take<ViewHarness>(world, 'view');
    const viewA = take<CityView>(world, 'leafA');
    // A switch INSIDE the running leaf is refused outright -- `withScanGuard` returns
    // while a run is in flight, so profile B cannot begin behind profile A's back. The
    // first of the two production guards this scenario covers.
    await viewA.selectCodebase();
    expect(viewA.isScanRunning(), 'a second scan started behind the first').toBe(true);
    expect(document.querySelector('.modal-container'), 'a consent modal opened mid-scan').toBeNull();

    // So the switch is what it is in a per-leaf design: the leaf the user is now working
    // in is a DIFFERENT leaf, on profile B, with its own retained snapshot and its own
    // selection.
    const viewB = await harness.open('profile-B', 4);
    put(world, 'leafB', viewB);
    rows(viewB)[1]!.click();
    await nextTick();
    expect(viewB.contentEl.querySelector('.ci-file-list__row--selected'), 'nothing selected in leaf B')
      .not.toBeNull();
    put(world, 'B-before', {
      state: viewB.getState(),
      paths: rows(viewB).map((r) => r.textContent.trim()),
      notices: harness.notices().length,
    });
  },

  'profile "A"\'s scan completes': async (world) => {
    const harness = take<ViewHarness>(world, 'view');
    take<Gate>(world, 'gate').open();
    await take<Promise<void>>(world, 'scan-A');
    const viewA = take<CityView>(world, 'leafA');
    // LIVENESS, asserted before any absence: profile A's run really did complete and
    // really did publish into ITS OWN leaf. Without this, the two "unchanged" assertions
    // below would pass just as well against a scan that never ran at all.
    expect(viewA.isScanRunning()).toBe(false);
    const publishedId = viewA.getState().snapshotId as string | null;
    expect(publishedId, 'profile A published nothing at all').not.toBe('snap-profile-A');
    expect(publishedId).not.toBeNull();
    expect(harness.store.get(publishedId!)!.repositoryId).toBe('profile-A');
    put(world, 'published-A', publishedId);
  },

  'nothing is published': (world) => {
    const harness = take<ViewHarness>(world, 'view');
    const viewB = take<CityView>(world, 'leafB');
    const before = take<{ state: Record<string, unknown>; paths: string[]; notices: number }>(world, 'B-before');
    // A real snapshot for profile A was offered to EVERY open leaf (reconcileEveryView).
    // Leaf B is on profile B, so view-reconciliation.ts refuses it: nothing published
    // there, nothing deselected, nothing said.
    expect(viewB.getState().snapshotId).toBe(before.state.snapshotId);
    expect(viewB.getState().selectedEntityId).toBe(before.state.selectedEntityId);
    expect(rows(viewB).map((r) => r.textContent.trim())).toEqual(before.paths);
    expect(viewB.contentEl.querySelector('.ci-file-list__row--selected')).not.toBeNull();
    expect(harness.notices().length, 'leaf B was told something about another profile scan')
      .toBe(before.notices);
    // …and leaf B never ran anything of its own.
    expect(viewB.isScanRunning()).toBe(false);
  },

  'profile "B"\'s snapshot is unchanged': (world) => {
    const harness = take<ViewHarness>(world, 'view');
    const retained = harness.store.get('snap-profile-B');
    expect(retained, 'profile B snapshot left the store').not.toBeNull();
    expect(retained!.repositoryId).toBe('profile-B');
    // Distinct objects, distinct ids: profile A's published snapshot did not become
    // profile B's, and profile B's did not become profile A's.
    expect(take<string>(world, 'published-A')).not.toBe('snap-profile-B');
    expect(harness.store.get(take<string>(world, 'published-A'))!.repositoryId).toBe('profile-A');
  },
};
