// The scan harness the safety/evidence step modules share: a real ScanCoordinator over
// a REAL temporary directory through the real Node adapter, with the real host reaction
// (`reactToLifecycleChange`) wired to it, plus a re-armable hold on the walk so a
// scenario can stand in the middle of a run.
//
// Lives outside steps/ so `evidence-steps.ts` and `source-steps.ts` share one harness
// rather than two that could drift -- and so neither file grows past the tests/**
// 450-line cap.
import { expect } from 'vitest';
import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { ScanCoordinator, createCancellationToken } from '../../src/application/scan-coordinator';
import { identityOf } from '../../src/application/run-state';
import { approve } from '../../src/application/approval';
import { InMemorySnapshotStore } from '../../src/adapters/storage/in-memory-snapshot-store';
import { reactToLifecycleChange } from '../../src/host/lifecycle-notices';
import { createRealNodePort } from '../fixtures/real-node-port';
import { createFixedClock } from '../fixtures/clock';
import { makeTempTree } from '../fixtures/temp-tree';
import { put, take } from './world';
import type { World } from './world';
import type { AnalysisScope, ApprovedInventoryRun } from '../../src/domain/model';
import type { RunIdentity, ScanLifecycleState } from '../../src/application/run-state';
import type { SourceFileSystemPort, WalkEntry } from '../../src/application/ports/source-filesystem-port';

/** A re-armable hold on the walk. Unarmed it resolves immediately, so the SAME
 *  coordinator can run one scan to completion and then hold the next one open. */
export interface Gate { arm(): void; open(): void; wait(): Promise<void> }

function noop(): void { /* the unarmed gate releases nothing */ }

export function makeGate(): Gate {
  let release: () => void = noop;
  let pending: Promise<void> = Promise.resolve();
  return {
    arm() { pending = new Promise<void>((resolve) => { release = resolve; }); },
    open() { release(); },
    wait() { return pending; },
  };
}

/** The real port, with its walk held at the first entry while the gate is armed.
 *  Nothing about WHAT is read changes -- only when the last of it arrives, which is
 *  what makes "the run is still in flight" a state a scenario can stand in. */
export function gatedPort(port: SourceFileSystemPort, gate: Gate): SourceFileSystemPort {
  return {
    readText: (p, max) => port.readText(p, max),
    stat: (p) => port.stat(p),
    readLog: () => port.readLog(),
    walk: (root, opts, token) => {
      async function* held(): AsyncGenerator<WalkEntry> {
        let first = true;
        for await (const entry of port.walk(root, opts, token)) {
          if (first) { first = false; await gate.wait(); }
          yield entry;
        }
      }
      return held();
    },
  };
}

export interface ScanHarness {
  coordinator: ScanCoordinator;
  store: InMemorySnapshotStore;
  port: SourceFileSystemPort;
  gate: Gate;
  root: string;
  notices: string[];
  lifecycles: ScanLifecycleState[];
  completions: number;
  displayedSnapshotId: string | null;
}

export const FIXTURE = {
  'src/a.ts': 'export const a = 1;\n',
  'src/nested/b.ts': 'export const b = 2;\n',
  'README.md': '# Fixture\n',
};

export function scopeFor(root: string, exclusions: readonly string[] = []): AnalysisScope {
  return { rootPath: root, exclusions: [...exclusions], maxFileBytes: 1_000_000, followSymlinks: false };
}

export function approvalFor(profileId: string, scope: AnalysisScope): ApprovedInventoryRun {
  return approve(profileId, scope.rootPath, scope, createFixedClock());
}

export async function makeScanHarness(world: World): Promise<ScanHarness> {
  const tree = await makeTempTree(FIXTURE);
  world.trees.push(tree);
  const gate = makeGate();
  const port = gatedPort(createRealNodePort(), gate);
  const store = new InMemorySnapshotStore(createFixedClock());
  const coordinator = new ScanCoordinator({
    port, store, clock: createFixedClock(), createCancellationToken,
  });
  const harness: ScanHarness = {
    coordinator, store, port, gate, root: tree.root,
    notices: [], lifecycles: [], completions: 0, displayedSnapshotId: null,
  };
  // The REAL host reaction, not a bespoke observer: the same function city-view.ts
  // calls on every transition, so what a user is told here is what a user is told in
  // the product.
  coordinator.subscribe((lifecycle) => {
    harness.lifecycles.push(lifecycle);
    if (lifecycle.run.status === 'complete') harness.completions += 1;
    const updated = reactToLifecycleChange(lifecycle, store, harness.displayedSnapshotId, null, {
      publishLayout: (snapshot) => { harness.displayedSnapshotId = snapshot.snapshotId; },
      showNotice: (message) => { harness.notices.push(message); },
    });
    if (updated) harness.displayedSnapshotId = updated.snapshotId;
  });
  put(world, 'scan', harness);
  return harness;
}

export function harnessOf(world: World): ScanHarness {
  return take<ScanHarness>(world, 'scan');
}

export function runningRunId(harness: ScanHarness): string {
  const run = harness.coordinator.state;
  expect(run.status, 'no run is in flight').toBe('running');
  return run.status === 'idle' ? '' : run.runId;
}

/** The identity the coordinator ACTUALLY held while `profileId`'s run was in flight,
 *  recovered from the recorded transitions -- never a hand-built tuple. `identityOf`
 *  is only defined while a run is running or cancelling, which is exactly the state a
 *  late result has to be judged against. */
export function runningIdentity(
  harness: ScanHarness, profileId: string,
): { identity: RunIdentity; state: ScanLifecycleState } {
  const state = harness.lifecycles.find(
    (l) => l.run.status === 'running' && l.approval?.profileId === profileId,
  );
  expect(state, `no running lifecycle was ever recorded for ${profileId}`).toBeDefined();
  return { identity: identityOf(state!), state: state! };
}

/** Recursively lists every path under `dir`, relative and POSIX-spelled. */
export async function listTree(dir: string, prefix = ''): Promise<string[]> {
  const out: string[] = [];
  for (const name of await readdir(dir, { withFileTypes: true })) {
    const rel = prefix ? `${prefix}/${name.name}` : name.name;
    out.push(rel);
    if (name.isDirectory()) out.push(...await listTree(join(dir, name.name), rel));
  }
  return out;
}
