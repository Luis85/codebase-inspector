// Part 6 Y26: matching findings to the snapshot's files, and the folder mapping the
// review step may offer (never apply) when a report was made from a different root.
import { describe, expect, it } from 'vitest';
import { normalizeFallow } from '../../src/application/evidence/normalize-fallow';
import { resolveFindings, suggestStripPrefix } from '../../src/application/evidence/resolve-findings';
import { rawReport } from '../fixtures/fallow-fixture';
import { FIXTURE_PROJECT_FILES, LABEL_OPTIONS, PARTITION, SUM_A, SUM_B, UNUSED_HELPER } from '../fixtures/fallow-expected';

const findings = normalizeFallow(rawReport('combined-3.27.0'), { stripPrefix: null }).findings;
const snapshot = (...paths: string[]): ReadonlySet<string> => new Set(paths);

describe('resolveFindings (Part 6 Y26)', () => {
  it('matches every finding when the snapshot is the fixture project itself', () => {
    expect(resolveFindings(findings, snapshot(...FIXTURE_PROJECT_FILES))).toEqual({
      matched: [PARTITION, SUM_A, SUM_B, UNUSED_HELPER, LABEL_OPTIONS], unmatchedPaths: [],
    });
  });

  it('drops a finding whose file is not in the snapshot and lists its path once, sorted', () => {
    const result = resolveFindings(findings, snapshot('src/text/format.ts', 'src/text/sum-a.ts', 'src/index.ts'));
    expect(result.matched).toEqual([SUM_A, UNUSED_HELPER, LABEL_OPTIONS]);
    expect(result.unmatchedPaths).toEqual(['src/layout/partition.ts', 'src/text/sum-b.ts']);
  });

  it('matches nothing against an empty snapshot, and needs no findings to answer', () => {
    expect(resolveFindings(findings, snapshot()).matched).toEqual([]);
    expect(resolveFindings(findings, snapshot()).unmatchedPaths).toEqual([
      'src/layout/partition.ts', 'src/text/format.ts', 'src/text/sum-a.ts', 'src/text/sum-b.ts',
    ]);
    expect(resolveFindings([], snapshot('src/index.ts'))).toEqual({ matched: [], unmatchedPaths: [] });
  });

  it('matches paths exactly: case and a leading folder both count', () => {
    const result = resolveFindings(findings, snapshot('SRC/text/format.ts', 'project/src/text/sum-a.ts'));
    expect(result.matched).toEqual([]);
  });
});

describe('suggestStripPrefix (Part 6 Y26)', () => {
  it('offers the folder a report made one level up adds to every path', () => {
    // The snapshot was scanned at the fixture project's src/; the report at the project root.
    const inner = snapshot('index.ts', 'layout/partition.ts', 'text/format.ts', 'text/sum-a.ts', 'text/sum-b.ts');
    const { unmatchedPaths } = resolveFindings(findings, inner);
    expect(suggestStripPrefix(unmatchedPaths, inner)).toBe('src/');
    const mapped = normalizeFallow(rawReport('combined-3.27.0'), { stripPrefix: 'src/' }).findings;
    expect(resolveFindings(mapped, inner).matched).toHaveLength(5);
  });

  it('offers the shortest folder that works', () => {
    expect(suggestStripPrefix(['a/b/src/x.ts'], snapshot('src/x.ts', 'b/src/x.ts'))).toBe('a/');
  });

  it('offers a folder when every path under it matches, even if paths elsewhere still do not', () => {
    expect(suggestStripPrefix(['pkg/src/a.ts', 'other.ts'], snapshot('src/a.ts'))).toBe('pkg/');
  });

  it.each<[string, string[], string[]]>([
    ['one path under the folder still does not match', ['pkg/src/a.ts', 'pkg/src/gone.ts'], ['src/a.ts']],
    ['no path has a folder', ['a.ts', 'b.ts'], ['a.ts']],
    ['nothing is unmatched', [], ['src/a.ts']],
    ['removing the folder matches nothing', ['pkg/x.ts'], ['src/a.ts']],
    ['the snapshot itself has files under the folder, so stripping could break a match', ['pkg/src/a.ts'], ['src/a.ts', 'pkg/readme.md']],
  ])('offers nothing when %s', (_name, paths, snapshotPaths) => {
    expect(suggestStripPrefix(paths, snapshot(...snapshotPaths))).toBeNull();
  });

  it('offers nothing when two different folders of the same length would each work (ambiguous)', () => {
    expect(suggestStripPrefix(['a/x.ts', 'b/y.ts'], snapshot('x.ts', 'y.ts'))).toBeNull();
  });

  it('runs quickly for 8 000 unmatched paths in distinct folders against a 20 000-file snapshot (Fix round 1, Important 2)', () => {
    const unmatchedPaths = Array.from({ length: 8_000 }, (_, i) => `folder${i}/src/a.ts`);
    const snapshotPaths: ReadonlySet<string> = new Set(Array.from({ length: 20_000 }, (_, i) => `unrelated/file${i}.ts`));
    const start = Date.now();
    const result = suggestStripPrefix(unmatchedPaths, snapshotPaths);
    expect(Date.now() - start).toBeLessThan(1000);
    expect(result).toBeNull();
  });
});
