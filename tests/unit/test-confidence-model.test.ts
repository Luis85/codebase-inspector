import { describe, expect, it } from 'vitest';
import { buildSnapshotFixture } from '../fixtures/snapshot-builder';
import { fileSummariesFor } from '../../src/ui/read-models/file-summaries';
import { buildTestConfidenceModel, coverageTiles, gapsCsv, GAP_THRESHOLD, MAX_TILES } from '../../src/ui/read-models/test-confidence';
import { sampleTestRun } from '../../src/ui/fixtures/sample-test-runs';

describe('test confidence model (Part 3 Q12, Q13)', () => {
  it('weights module coverage by instrumented branches, not by file', () => {
    const snap = buildSnapshotFixture({ files: 30, directories: 3 });
    const files = fileSummariesFor(snap);
    const mod = buildTestConfidenceModel(snap, files).modules.find((x) => x.module === 'dir-0')!;
    const inMod = files.filter((f) => f.module === 'dir-0');
    const covered = inMod.reduce((n, f) => n + f.branchesCovered.value!, 0);
    const total = inMod.reduce((n, f) => n + f.branchesTotal.value!, 0);
    expect(mod.coverage.value).toBe(Math.round((covered / total) * 100));
    expect(mod.coverage.state).toBe('sample');
  });

  it('mutation is always unknown, never 0 and never passing', () => {
    const snap = buildSnapshotFixture({ files: 5 });
    const card = buildTestConfidenceModel(snap, fileSummariesFor(snap)).cards.find((c) => c.id === 'mutation')!;
    expect(card.value.state).toBe('unknown');
    expect(card.value.value).toBeUndefined();
  });

  it('gaps are known coverage below 60 %, most-changed first', () => {
    const snap = buildSnapshotFixture({ files: 80, directories: 2 });
    const m = buildTestConfidenceModel(snap, fileSummariesFor(snap));
    expect(m.gaps.length).toBeGreaterThan(0);
    expect(m.gaps.every((f) => f.branchCoverage.value! < GAP_THRESHOLD)).toBe(true);
    const commits = m.gaps.map((f) => f.commits90d.value!);
    expect(commits).toEqual([...commits].sort((a, b) => b - a));
  });

  it('test runs come only from real test files; none means unknown, not 0 of 0', () => {
    const none = buildSnapshotFixture({ files: 6 });
    const noRuns = buildTestConfidenceModel(none, fileSummariesFor(none));
    expect(noRuns.runs).toHaveLength(0);
    expect(noRuns.cards.find((c) => c.id === 'results')!.value.state).toBe('unknown');
    const some = buildSnapshotFixture({ files: 10, testFiles: 4 });
    const m = buildTestConfidenceModel(some, fileSummariesFor(some));
    expect(m.runs).toHaveLength(4);
    expect(m.runs.every((r) => r.file.name.endsWith('.test.ts'))).toBe(true);
    const total = m.runs.reduce((n, r) => n + r.tests.value!, 0);
    const failing = m.runs.reduce((n, r) => n + r.failing.value!, 0);
    expect(m.cards.find((c) => c.id === 'results')!.value.value).toBe(total - failing);
  });

  it('sample test runs are deterministic per entity', () => {
    expect(sampleTestRun('x')).toEqual(sampleTestRun('x'));
  });

  it('caps tiles at 400 in priority order, filtered by module', () => {
    const snap = buildSnapshotFixture({ files: 450, directories: 3 });
    const files = fileSummariesFor(snap);
    expect(coverageTiles(files, null).tiles).toHaveLength(MAX_TILES);
    expect(coverageTiles(files, null).total).toBe(450);
    const dir1Tiles = coverageTiles(files, 'dir-1').tiles;
    expect(dir1Tiles.length).toBeGreaterThan(0);
    expect(dir1Tiles.every((t) => t.file.module === 'dir-1')).toBe(true);
  });

  it('exports gaps with a state column per metric', () => {
    const snap = buildSnapshotFixture({ files: 40 });
    const m = buildTestConfidenceModel(snap, fileSummariesFor(snap));
    expect(gapsCsv(m.gaps).split('\r\n')[0]).toBe('\uFEFFpath,module,branch_coverage_pct,branch_coverage_pct_state,branches_covered,branches_covered_state,branches_total,branches_total_state,commits_90d,commits_90d_state');
  });
});
