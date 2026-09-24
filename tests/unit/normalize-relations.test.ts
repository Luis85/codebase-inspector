// WP-03 N3/N4/N9/N10/N11: the relation normaliser — cycles, re-export cycles, boundary
// violations, unresolved imports and fan, plus the CY-/BV-/UR- findings drawn from them.
// Every expected value is taken from the recorded relation fixtures
// (tests/fixtures/fallow/README.md, "Relations project"), never restated from memory.
import { describe, expect, it } from 'vitest';
import { normalizeFallow } from '../../src/application/evidence/normalize-fallow';
import { fallowDoc, rawReport, type FallowDoc, type FallowFixture } from '../fixtures/fallow-fixture';
import { bvId, cyId, urId } from '../fixtures/fallow-expected';

const normalized = (source: FallowFixture | FallowDoc, stripPrefix: string | null = null) => normalizeFallow(rawReport(source), { stripPrefix });

const BARREL_INDEX = 'src/barrel/index.ts';
const BARREL_X = 'src/barrel/x.ts';
const CORE_A = 'src/core/a.ts';
const CORE_B = 'src/core/b.ts';
const CORE_C = 'src/core/c.ts';
const VIEW = 'src/ui/view.ts';
const DB = 'src/data/db.ts';
const ENTRY = 'src/index.ts';

type Cycle = { files: string[]; edges?: { path: string; line: number; col: number }[]; line: number; col: number };
const cyclesOf = (d: FallowDoc): Cycle[] => (d.check as unknown as { circular_dependencies: Cycle[] }).circular_dependencies;
const coreCycle = (d: FallowDoc): Cycle => cyclesOf(d)[1]!;

describe('normalize-relations: import cycles (N3, N9, N10)', () => {
  it('reports the core 3-file cycle, files in fallow\'s order, hops[i] = files[i] -> files[(i+1)%n] with the recorded line', () => {
    const relations = normalized('relations-combined-3.27.0').relations;
    const core = relations.importCycles.find((c) => c.files.includes(CORE_A))!;
    expect(core.files).toEqual([CORE_A, CORE_B, CORE_C]);
    expect(core.hops).toEqual([
      { from: CORE_A, to: CORE_B, line: 1 },
      { from: CORE_B, to: CORE_C, line: 1 },
      { from: CORE_C, to: CORE_A, line: 1 },
    ]);
  });

  it('reports the barrel pair (also a cycle, as well as a re-export cycle)', () => {
    const relations = normalized('relations-combined-3.27.0').relations;
    const barrel = relations.importCycles.find((c) => c.files.includes(BARREL_INDEX))!;
    expect(barrel.files).toEqual([BARREL_INDEX, BARREL_X]);
    expect(barrel.hops).toEqual([
      { from: BARREL_INDEX, to: BARREL_X, line: 1 },
      { from: BARREL_X, to: BARREL_INDEX, line: 1 },
    ]);
  });

  it('has exactly two import cycles', () => {
    expect(normalized('relations-combined-3.27.0').relations.importCycles).toHaveLength(2);
  });
});

describe('normalize-relations: re-export cycles (N3, N9, N10)', () => {
  it('has one multi-node entry, with its sorted files', () => {
    const relations = normalized('relations-combined-3.27.0').relations;
    expect(relations.reExportCycles).toEqual([{
      findingId: cyId('re-export', [BARREL_INDEX, BARREL_X]),
      files: [BARREL_INDEX, BARREL_X],
      kind: 'multi-node',
    }]);
  });
});

describe('normalize-relations: boundary violations and unresolved imports (N3, N9, N10)', () => {
  it('reports the one boundary violation, anchored on the importing file', () => {
    const relations = normalized('relations-combined-3.27.0').relations;
    expect(relations.boundaryViolations).toEqual([{
      findingId: bvId(VIEW, DB, DB), from: VIEW, to: DB, fromZone: 'ui', toZone: 'data', specifier: DB, line: 3,
    }]);
  });

  it('reports the one unresolved import', () => {
    const relations = normalized('relations-combined-3.27.0').relations;
    expect(relations.unresolvedImports).toEqual([{
      findingId: urId(ENTRY, './does-not-exist'), path: ENTRY, specifier: './does-not-exist', line: 4,
    }]);
  });
});

describe('normalize-relations: fan (N3, N8)', () => {
  it('lists a scored file\'s recorded fan-in and fan-out', () => {
    const relations = normalized('relations-combined-3.27.0').relations;
    expect(relations.fan).toContainEqual({ path: CORE_A, fanIn: 3, fanOut: 1 });
  });
});

describe('normalize-relations: boundaries state (N4, JF2)', () => {
  it('is configured in both relation recordings (a violation was reported)', () => {
    expect(normalized('relations-combined-3.27.0').relations.boundaries).toBe('configured');
    expect(normalized('relations-combined-3.21.0').relations.boundaries).toBe('configured');
  });

  it('is not-configured in the no-boundaries recording, with notConfigured: [\'boundary\']', () => {
    const result = normalized('relations-no-boundaries-3.27.0');
    expect(result.relations.boundaries).toBe('not-configured');
    expect(result.notConfigured).toEqual(['boundary']);
  });

  it('is not-reported when the check section carries no boundary_violations key at all', () => {
    const doc = fallowDoc('relations-combined-3.27.0', (d) => { delete d.check!.boundary_violations; });
    expect(normalized(doc).relations.boundaries).toBe('not-reported');
  });
});

describe('normalize-relations: categories (N11)', () => {
  it('reads cycle, boundary and unresolved-import as analysed in the full recording', () => {
    const categories = normalized('relations-combined-3.27.0').categories;
    expect(categories.cycle).toBe('analysed');
    expect(categories.boundary).toBe('analysed');
    expect(categories['unresolved-import']).toBe('analysed');
  });

  it('reads boundary as not-analysed when boundaries are not configured', () => {
    expect(normalized('relations-no-boundaries-3.27.0').categories.boundary).toBe('not-analysed');
  });
});

describe('normalize-relations: findings (N9, N10)', () => {
  it('gives one CY- finding per import cycle, anchored on the first member, with the others in `related`', () => {
    const findings = normalized('relations-combined-3.27.0').findings;
    const core = findings.find((f) => f.id === cyId('import', [CORE_A, CORE_B, CORE_C]))!;
    expect(core).toMatchObject({
      category: 'cycle', rule: 'circular-dependencies', severity: null, path: CORE_A, line: 1, endLine: null, symbol: null,
      related: [CORE_B, CORE_C],
    });
    expect(core.detail).toEqual({
      kind: 'cycle', cycleKind: 'import', members: [CORE_A, CORE_B, CORE_C],
      hops: [
        { from: CORE_A, to: CORE_B, line: 1 }, { from: CORE_B, to: CORE_C, line: 1 }, { from: CORE_C, to: CORE_A, line: 1 },
      ],
    });

    const barrel = findings.find((f) => f.id === cyId('import', [BARREL_INDEX, BARREL_X]))!;
    expect(barrel).toMatchObject({ category: 'cycle', rule: 'circular-dependencies', path: BARREL_INDEX, related: [BARREL_X] });
  });

  it('gives one CY- finding for the re-export cycle', () => {
    const findings = normalized('relations-combined-3.27.0').findings;
    const reExport = findings.find((f) => f.id === cyId('re-export', [BARREL_INDEX, BARREL_X]))!;
    expect(reExport).toMatchObject({
      category: 'cycle', rule: 're-export-cycle', severity: null, path: BARREL_INDEX, line: null, endLine: null, symbol: null,
      related: [BARREL_X],
    });
    expect(reExport.detail).toEqual({ kind: 'cycle', cycleKind: 're-export', members: [BARREL_INDEX, BARREL_X], hops: [] });
  });

  it('gives a BV- finding anchored on the importing file, at the recorded line, with related: [to]', () => {
    const findings = normalized('relations-combined-3.27.0').findings;
    const violation = findings.find((f) => f.id === bvId(VIEW, DB, DB))!;
    expect(violation).toMatchObject({
      category: 'boundary', rule: 'boundary-violation', severity: null, path: VIEW, line: 3, endLine: null, symbol: null, related: [DB],
    });
    expect(violation.detail).toEqual({ kind: 'boundary', toPath: DB, fromZone: 'ui', toZone: 'data', specifier: DB });
  });

  it('gives a UR- finding on the importing file, with no related key', () => {
    const findings = normalized('relations-combined-3.27.0').findings;
    const unresolved = findings.find((f) => f.id === urId(ENTRY, './does-not-exist'))!;
    expect(unresolved).toMatchObject({
      category: 'unresolved-import', rule: 'unresolved-imports', severity: null, path: ENTRY, line: 4, endLine: null, symbol: null,
    });
    expect(unresolved.detail).toEqual({ kind: 'unresolved-import', specifier: './does-not-exist' });
    expect('related' in unresolved).toBe(false);
  });

  it('every relation\'s findingId equals its finding\'s id', () => {
    const result = normalized('relations-combined-3.27.0');
    const ids = new Set(result.findings.map((f) => f.id));
    for (const c of result.relations.importCycles) expect(ids.has(c.findingId)).toBe(true);
    for (const c of result.relations.reExportCycles) expect(ids.has(c.findingId)).toBe(true);
    for (const v of result.relations.boundaryViolations) expect(ids.has(v.findingId)).toBe(true);
    for (const u of result.relations.unresolvedImports) expect(ids.has(u.findingId)).toBe(true);
  });

  it('keeps every CY-/BV-/UR- id when every line in the recording changes', () => {
    const before = normalized('relations-combined-3.27.0').findings.filter((f) => /^(CY|BV|UR)-/.test(f.id)).map((f) => f.id).sort();
    expect(before.length).toBe(5);   // 2 import cycles, 1 re-export cycle, 1 violation, 1 unresolved import
    const doc = fallowDoc('relations-combined-3.27.0', (d) => {
      for (const c of cyclesOf(d)) {
        c.line = 99;
        c.col = 99;
        for (const e of c.edges ?? []) e.line = 99;
      }
      const bv = (d.check! as unknown as { boundary_violations: { line: number }[] }).boundary_violations;
      for (const v of bv) v.line = 99;
      const ui = (d.check! as unknown as { unresolved_imports: { line: number }[] }).unresolved_imports;
      for (const u of ui) u.line = 99;
    });
    const after = normalized(doc).findings.filter((f) => /^(CY|BV|UR)-/.test(f.id)).map((f) => f.id).sort();
    expect(after).toEqual(before);
  });
});

describe('normalize-relations: misaligned edges (Review Focus 1)', () => {
  it('gives hop 0 a null line when edges[0].path is not files[0]; the other hops keep theirs', () => {
    const doc = fallowDoc('relations-combined-3.27.0', (d) => { coreCycle(d).edges![0]!.path = CORE_C; });
    const relations = normalized(doc).relations;
    const core = relations.importCycles.find((c) => c.files.includes(CORE_A))!;
    expect(core.hops).toEqual([
      { from: CORE_A, to: CORE_B, line: null },
      { from: CORE_B, to: CORE_C, line: 1 },
      { from: CORE_C, to: CORE_A, line: 1 },
    ]);
  });

  it('gives every hop a null line when edges is missing entirely, and does not throw', () => {
    const doc = fallowDoc('relations-combined-3.27.0', (d) => { delete coreCycle(d).edges; });
    expect(() => normalized(doc)).not.toThrow();
    const relations = normalized(doc).relations;
    const core = relations.importCycles.find((c) => c.files.includes(CORE_A))!;
    for (const hop of core.hops) expect(hop.line).toBeNull();
  });
});

describe('normalize-relations: refused paths', () => {
  it('drops a cycle whole when one member is outside the analysed folder, and records that path', () => {
    const doc = fallowDoc('relations-combined-3.27.0', (d) => { coreCycle(d).files[0] = '../outside.ts'; });
    const result = normalized(doc);
    expect(result.relations.importCycles.some((c) => c.files.includes(CORE_B))).toBe(false);
    expect(result.rejectedPaths).toContain('../outside.ts');
  });

  it('drops a boundary violation whole when to_path is absolute, and records that path', () => {
    const doc = fallowDoc('relations-combined-3.27.0', (d) => {
      (d.check! as unknown as { boundary_violations: { to_path: string }[] }).boundary_violations[0]!.to_path = 'C:/x.ts';
    });
    const result = normalized(doc);
    expect(result.relations.boundaryViolations).toEqual([]);
    expect(result.rejectedPaths).toContain('C:/x.ts');
  });
});

describe('normalize-relations: strip prefix (Review Focus 3)', () => {
  it('strips a chosen folder from every relation path the same way it strips finding paths', () => {
    const prefixed = fallowDoc('relations-combined-3.27.0', (d) => {
      for (const c of cyclesOf(d)) {
        c.files = c.files.map((p) => `pkg/${p}`);
        for (const e of c.edges ?? []) e.path = `pkg/${e.path}`;
      }
      const rec = (d.check! as unknown as { re_export_cycles: { files: string[] }[] }).re_export_cycles;
      for (const r of rec) r.files = r.files.map((p) => `pkg/${p}`);
      const bv = (d.check! as unknown as { boundary_violations: { from_path: string; to_path: string }[] }).boundary_violations;
      for (const v of bv) { v.from_path = `pkg/${v.from_path}`; v.to_path = `pkg/${v.to_path}`; }
      const ui = (d.check! as unknown as { unresolved_imports: { path: string }[] }).unresolved_imports;
      for (const u of ui) u.path = `pkg/${u.path}`;
      const fs = (d.health! as unknown as { file_scores: { path: string }[] }).file_scores;
      for (const f of fs) f.path = `pkg/${f.path}`;
    });
    const unprefixed = normalized('relations-combined-3.27.0').relations;
    const stripped = normalized(prefixed, 'pkg/').relations;
    expect(stripped.importCycles.map((c) => c.files)).toEqual(unprefixed.importCycles.map((c) => c.files));
    expect(stripped.reExportCycles.map((c) => c.files)).toEqual(unprefixed.reExportCycles.map((c) => c.files));
    expect(stripped.boundaryViolations.map((v) => [v.from, v.to])).toEqual(unprefixed.boundaryViolations.map((v) => [v.from, v.to]));
    expect(stripped.unresolvedImports.map((u) => u.path)).toEqual(unprefixed.unresolvedImports.map((u) => u.path));
    expect(stripped.fan?.map((f) => f.path)).toEqual(unprefixed.fan?.map((f) => f.path));
  });
});

describe('normalize-relations: not shown (N26)', () => {
  it('no longer lists the four relation summary keys, but still lists another non-zero count', () => {
    const doc = fallowDoc('relations-combined-3.27.0', (d) => { d.check!.summary.boundary_coverage_violations = 2; });
    const notShown = normalized(doc).notShown;
    const keys = notShown.map((n) => n.key);
    expect(keys).not.toContain('circular_dependencies');
    expect(keys).not.toContain('re_export_cycles');
    expect(keys).not.toContain('boundary_violations');
    expect(keys).not.toContain('unresolved_imports');
    expect(notShown).toContainEqual({ key: 'boundary_coverage_violations', count: 2 });
  });
});
