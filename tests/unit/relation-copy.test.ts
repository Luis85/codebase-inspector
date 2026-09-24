// WP-03 N9/N13: the title and the review dialog's rule row for the three relation finding
// kinds. JF23: no bare `RULE_TEXT('circular-dependencies')` assertion here — it passes
// without this task's code (an unknown rule already reads verbatim), so it is not a RED
// proof; `Record<FindingRule, string>` is the type-level guard for the label itself.
import { describe, expect, it } from 'vitest';
import type { FindingDetail } from '../../src/application/evidence/model';
import { FINDING_DIALOG_RULE_VALUE, FINDING_TITLE_FOR } from '../../src/ui/inspector-copy';

const CYCLE: FindingDetail = {
  kind: 'cycle', cycleKind: 'import', members: ['src/core/a.ts', 'src/core/b.ts', 'src/core/c.ts'],
  hops: [
    { from: 'src/core/a.ts', to: 'src/core/b.ts', line: 1 },
    { from: 'src/core/b.ts', to: 'src/core/c.ts', line: 1 },
    { from: 'src/core/c.ts', to: 'src/core/a.ts', line: 1 },
  ],
};
const RE_EXPORT_CYCLE: FindingDetail = {
  kind: 'cycle', cycleKind: 're-export', members: ['src/barrel/index.ts', 'src/barrel/x.ts'], hops: [],
};
const BOUNDARY: FindingDetail = {
  kind: 'boundary', toPath: 'src/data/db.ts', fromZone: 'ui', toZone: 'data', specifier: 'src/data/db.ts',
};
const UNRESOLVED: FindingDetail = { kind: 'unresolved-import', specifier: './does-not-exist' };

describe('relation finding copy (WP-03 N9, N13)', () => {
  it('titles a cycle, a boundary violation and an unresolved import', () => {
    expect(FINDING_TITLE_FOR('cycle', 'circular-dependencies', null, CYCLE)).toBe('Import cycle · 3 files');
    expect(FINDING_TITLE_FOR('cycle', 're-export-cycle', null, RE_EXPORT_CYCLE)).toBe('Re-export cycle · 2 files');
    expect(FINDING_TITLE_FOR('boundary', 'boundary-violation', null, BOUNDARY)).toBe('Boundary violation · ui → data');
    expect(FINDING_TITLE_FOR('unresolved-import', 'unresolved-imports', null, UNRESOLVED)).toBe('Unresolved import · ./does-not-exist');
  });

  it('the dialog rule row names fallow\'s own rule id and, for a cycle, the member count', () => {
    const cycleValue = FINDING_DIALOG_RULE_VALUE('circular-dependencies', CYCLE);
    expect(cycleValue).toContain('circular-dependencies');
    expect(cycleValue).toContain('3 files');

    const boundaryValue = FINDING_DIALOG_RULE_VALUE('boundary-violation', BOUNDARY);
    expect(boundaryValue).toContain('boundary-violation');
    expect(boundaryValue).toContain('src/data/db.ts');
    expect(boundaryValue).toContain('ui → data');

    const unresolvedValue = FINDING_DIALOG_RULE_VALUE('unresolved-imports', UNRESOLVED);
    expect(unresolvedValue).toContain('unresolved-imports');
    expect(unresolvedValue).toContain('./does-not-exist');
  });
});
