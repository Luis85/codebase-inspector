// Gap closure GRB9: the real, pinned fallow (FALLOW_BIN, or .fallow-bin/ from `npm run test:fallow`)
// driven through the REAL service, coordinator, inspector, runner and filesystem adapter on a
// temporary copy of the fixture project. A collected run records which fallow config files were
// in the root; the run itself is the exact production one. Collected only by
// vitest.fallow.config.ts; skipped, never downloaded, when no binary is there.
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import * as fsPromises from 'node:fs/promises';
import { createExecutableInspector } from '../../src/adapters/fallow/executable-inspector';
import { createFallowRunner } from '../../src/adapters/fallow/fallow-runner';
import type { NodeFsPromisesLike } from '../../src/adapters/filesystem/node-globals';
import { InMemoryEvidenceStore } from '../../src/adapters/storage/in-memory-evidence-store';
import { InMemorySnapshotStore } from '../../src/adapters/storage/in-memory-snapshot-store';
import { AnalysisCoordinator } from '../../src/application/analysis/analysis-coordinator';
import { isActive } from '../../src/application/analysis/analysis-state';
import { createFallowAnalysisService } from '../../src/application/analysis/fallow-analysis-service';
import { approve } from '../../src/application/approval';
import { ScanCoordinator, createCancellationToken } from '../../src/application/scan-coordinator';
import type { AnalysisScope } from '../../src/domain/model';
import { createFixedClock } from '../fixtures/clock';
import { createInMemoryAnalyzerStore } from '../fixtures/in-memory-analyzer-store';
import { createProjectCopier, fallowRealTitle, resolveFallowBin } from '../fixtures/fallow-real-harness';
import { createRealNodePort } from '../fixtures/real-node-port';
import { killTree, realKill, realSpawn } from '../fixtures/real-spawn';

const BIN = resolveFallowBin();
const PROJECT = fileURLToPath(new URL('../fixtures/fallow/project', import.meta.url));

describe.skipIf(BIN === null)(`${fallowRealTitle(BIN)} (collected run records config files)`, () => {
  const bin = BIN ?? '';
  const pids: number[] = [];
  const copier = createProjectCopier(PROJECT);
  const runner = createFallowRunner({
    spawn: (command, args, options) => {
      const child = realSpawn(command, args, options);
      if (child.pid !== undefined) pids.push(child.pid);
      return child;
    },
    env: process.env, platform: process.platform, killProcess: realKill,
  });

  afterEach(async () => {
    runner.killAll();
    for (const pid of pids.splice(0)) killTree(pid);
    await copier.cleanupAll();
  });

  /** A collected run of the real binary on a fresh copy; `prepare` may add files to the copy first. */
  async function collectedConfigFiles(prepare: (root: string) => Promise<void>): Promise<readonly string[] | undefined> {
    const root = await copier.copy();
    await prepare(root);
    const clock = createFixedClock('2026-10-05T10:00:00.000Z');
    const snapshots = new InMemorySnapshotStore(clock);
    const scope: AnalysisScope = { rootPath: root, exclusions: [], maxFileBytes: 5_000_000, followSymlinks: false };
    await new ScanCoordinator({ port: createRealNodePort(), store: snapshots, clock, createCancellationToken }).start(approve('p1', root, scope, clock), scope);
    const snapshot = snapshots.latestFor('p1')!;
    const evidence = new InMemoryEvidenceStore();
    const coordinator = new AnalysisCoordinator({ process: runner, evidence, snapshots, clock, createCancellationToken });
    const service = createFallowAnalysisService({
      store: createInMemoryAnalyzerStore('m'), inspector: createExecutableInspector({ fsPromises: fsPromises as unknown as NodeFsPromisesLike, platform: process.platform }),
      coordinator, snapshots, getFilesystem: () => createRealNodePort(), machineId: 'm', clock,
    });
    const reviewed = await service.review('p1', snapshot, bin);
    if (!reviewed.ok) throw new Error(`test setup: review refused (${reviewed.code})`);
    expect(await service.trustAndRun('p1', snapshot, reviewed.review)).toEqual({ kind: 'started' });
    const deadline = Date.now() + 50_000;
    while (isActive(service.stateOf('p1'))) {
      if (Date.now() > deadline) throw new Error('timed out waiting for the real run');
      await sleep(50);
    }
    expect(service.stateOf('p1')).toMatchObject({ status: 'completed' });
    return evidence.get('p1')?.collected?.configFiles;
  }

  it('records .fallowrc.json when the root has one', async () => {
    expect(await collectedConfigFiles((root) => writeFile(join(root, '.fallowrc.json'), '{}\n'))).toEqual(['.fallowrc.json']);
  }, 90_000);

  it('control: records an empty list when the root has none', async () => {
    expect(await collectedConfigFiles(() => Promise.resolve())).toEqual([]);
  }, 90_000);
});
