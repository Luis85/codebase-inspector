// GRB12 / GCQ4: an exclusion saved before M62 may still contain `*` or `?`. The walker matches
// exclusions as literal paths (walker.ts), so such an entry matches nothing. The scan names it
// in the snapshot's `warnings` instead of staying silent. It is a settings problem, not missing
// data, so it never makes the snapshot `partial`.
import { describe, expect, it } from 'vitest';
import { collectInventory } from '../../src/application/inventory-collector';
import { createFakeSourceFileSystem } from '../fixtures/fake-source-filesystem';
import type { FakeTree } from '../fixtures/fake-source-filesystem';
import { createCancellationToken } from '../fixtures/cancellation-token';
import { createFixedClock } from '../fixtures/clock';
import type { AnalysisScope, ApprovedInventoryRun } from '../../src/domain/model';

const APPROVAL: ApprovedInventoryRun = {
  profileId: 'repo-1',
  sourceFingerprint: 'fp-source',
  scopeFingerprint: 'fp-scope',
  approvedAt: '2026-01-01T00:00:00.000Z',
  operation: 'read-only-inventory',
};

const TREE: FakeTree = { 'src/a.ts': 'export const a = 1;\n', 'src/b.ts': 'export const b = 2;\n' };

const warning = (x: string): string => `The exclusion "${x}" contains * or ? and matches nothing. Edit it in Settings.`;

async function scanWith(exclusions: string[], tree: FakeTree = TREE) {
  const scope: AnalysisScope = { rootPath: '/fake-root', exclusions, maxFileBytes: 100, followSymlinks: false };
  const { port } = createFakeSourceFileSystem(tree);
  const { token } = createCancellationToken();
  return collectInventory(port, scope, APPROVAL, token, createFixedClock('2026-02-01T00:00:00.000Z'));
}

describe('a saved exclusion containing * or ?', () => {
  it('is named once in the warnings, and the snapshot stays complete', async () => {
    const snapshot = await scanWith(['dist/*', 'node_modules']);
    expect(snapshot.warnings).toEqual([warning('dist/*')]);
    expect(snapshot.completeness).toBe('complete');
  });

  it('control: exclusions without a wildcard add no warning', async () => {
    const snapshot = await scanWith(['dist', 'node_modules']);
    expect(snapshot.warnings).toEqual([]);
    expect(snapshot.completeness).toBe('complete');
  });

  it('names two wildcards as two warnings, in exclusion order', async () => {
    const snapshot = await scanWith(['a?', 'keep', '*.log']);
    expect(snapshot.warnings).toEqual([warning('a?'), warning('*.log')]);
  });

  it('warns once per exclusion per scan, however many entries the walk meets', async () => {
    const snapshot = await scanWith(['src/*']);
    expect(snapshot.entities.filter((e) => e.kind === 'file')).toHaveLength(2);
    expect(snapshot.warnings).toEqual([warning('src/*')]);
  });

  it('GCQ4: completeness still comes from skips only, and a skip reason is kept beside the warning', async () => {
    const snapshot = await scanWith(['dist/*'], { ...TREE, 'big.ts': 'x'.repeat(200) });
    expect(snapshot.completeness).toBe('partial');
    expect(snapshot.warnings).toHaveLength(2);
    expect(snapshot.warnings.at(-1)).toBe(warning('dist/*'));
  });
});
