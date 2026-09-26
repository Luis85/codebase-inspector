// Part 7 Z40/Z41 extended by WP-03 Part 1 N36: the real, pinned fallow 3.27.0 — fetched by
// `npm run test:fallow` into the git-ignored `.fallow-bin/`, or the binary named by
// `FALLOW_BIN` — run through the production runner on a temporary copy of the relations
// fixture project (`RELATIONS_PROJECT_DIR`, tests/fixtures/fallow/README.md's "Relations
// project"), then through the SAME parse-and-normalise pipeline the plugin uses
// (`classifyFallowExit`'s own `parseFallowReportText`, then `buildEvidenceReport`).
// Asserts the exact facts that section records: two import cycles (the core three files
// and the barrel pair — not "one import cycle" in total), the barrel pair's re-export
// cycle, the one boundary violation and the one unresolved import — and that the run
// writes nothing under the analysed folder. A sibling of fallow-real.test.ts (J16),
// sharing its temp-copy/fs-snapshot/FALLOW_BIN helpers (JF20, tests/fixtures/fallow-real-
// harness.ts). Collected only by vitest.fallow.config.ts; skipped, never downloaded, when
// no binary is there.
import { afterEach, describe, expect, it } from 'vitest';
import { createFallowRunner } from '../../src/adapters/fallow/fallow-runner';
import {
  FALLOW_RUN_ARGS, FALLOW_STDERR_TAIL_BYTES, FALLOW_STDOUT_MAX_BYTES, classifyFallowExit,
} from '../../src/application/analysis/fallow-invocation';
import { buildEvidenceReport } from '../../src/application/evidence/normalize-fallow';
import type { ProcessOutcome, ProcessRequest } from '../../src/application/ports/analyzer-process';
import { createCancellationToken } from '../fixtures/cancellation-token';
import { RELATIONS_PROJECT_DIR } from '../fixtures/fallow-fixture';
import { createProjectCopier, fallowRealTitle, hashTree, resolveFallowBin } from '../fixtures/fallow-real-harness';
import { killTree, realKill, realSpawn } from '../fixtures/real-spawn';

const BIN = resolveFallowBin();
const TITLE = `${fallowRealTitle(BIN)} (relations project)`;

describe.skipIf(BIN === null)(TITLE, () => {
  const bin = BIN ?? '';
  const pids: number[] = [];
  const copier = createProjectCopier(RELATIONS_PROJECT_DIR);
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

  const request = (root: string): ProcessRequest => ({
    executablePath: bin, args: FALLOW_RUN_ARGS(root), cwd: root, timeoutMs: 60_000,
    maxStdoutBytes: FALLOW_STDOUT_MAX_BYTES, maxStderrBytes: FALLOW_STDERR_TAIL_BYTES,
  });
  const go = (r: ProcessRequest): Promise<ProcessOutcome> => runner.run(r, createCancellationToken().token);

  it('reports the recorded cycle, re-export cycle, violation and unresolved import, and writes nothing under the root', async () => {
    const root = await copier.copy();
    const before = await hashTree(root);

    const result = classifyFallowExit(await go(request(root)), 60);
    expect(result.kind).toBe('completed');
    if (result.kind !== 'completed') return;

    const report = buildEvidenceReport({
      raw: result.report, fileName: 'relations.json', importedAt: '2026-09-24T10:00:00.000Z',
      snapshotId: 'snapshot-relations-real', stripPrefix: null,
    });
    const { relations } = report.normalized;

    // Two import cycles: the core three files, and the barrel pair (also reported as the
    // re-export cycle below — fallow reports the same pair both ways).
    expect(relations.importCycles).toHaveLength(2);
    expect(relations.importCycles.map((c) => [...c.files]).sort((a, b) => a.length - b.length)).toEqual([
      ['src/barrel/index.ts', 'src/barrel/x.ts'],
      ['src/core/a.ts', 'src/core/b.ts', 'src/core/c.ts'],
    ]);

    expect(relations.reExportCycles).toHaveLength(1);
    expect(relations.reExportCycles[0]).toMatchObject({ files: ['src/barrel/index.ts', 'src/barrel/x.ts'] });

    expect(relations.boundaryViolations).toHaveLength(1);
    expect(relations.boundaryViolations[0]).toMatchObject({
      from: 'src/ui/view.ts', to: 'src/data/db.ts', fromZone: 'ui', toZone: 'data', line: 3,
    });

    expect(relations.unresolvedImports).toHaveLength(1);
    expect(relations.unresolvedImports[0]).toMatchObject({ path: 'src/index.ts', specifier: './does-not-exist', line: 4 });

    // No .fallow/ cache, no report, no log: --no-cache leaves the analysed folder untouched.
    expect(await hashTree(root)).toEqual(before);
  }, 60_000);
});
