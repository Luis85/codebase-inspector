// WP-03 Part 1 N1, N2: the report reader reads cycles, re-export cycles, boundary
// violations, unresolved imports and file scores from the relation recordings
// (tests/fixtures/fallow/README.md's "Relations project" section). Each element is
// walked by hand, first failure wins, the same E31 pattern as fallow-report-reader.test.ts.
import { describe, expect, it } from 'vitest';
import { deepKeys, fallowDoc, fallowOutcome, rawReport } from '../fixtures/fallow-fixture';

const checkOf = (r: ReturnType<typeof rawReport>) => (r.kind === 'combined' ? r.check : undefined);
const healthOf = (r: ReturnType<typeof rawReport>) => (r.kind === 'combined' ? r.health : undefined);

describe('relation sections (N1)', () => {
  it.each(['relations-combined-3.27.0', 'relations-combined-3.21.0'] as const)('%s: reads the four check arrays and file_scores', (name) => {
    const r = rawReport(name);
    expect(checkOf(r)?.circular_dependencies?.length).toBeGreaterThan(0);
    expect(checkOf(r)?.re_export_cycles).toHaveLength(1);
    expect(checkOf(r)?.boundary_violations).toHaveLength(1);
    expect(checkOf(r)?.unresolved_imports).toHaveLength(1);
    expect(healthOf(r)?.file_scores?.length).toBeGreaterThan(0);
  });
  it('keeps only the read fields', () => {
    const keys = deepKeys(rawReport('relations-combined-3.27.0'));
    for (const dropped of ['actions', 'introduced', 'is_cross_package', 'specifier_col', 'maintainability_index', 'dead_code_ratio']) {
      expect(keys.has(dropped)).toBe(false);
    }
    expect(keys.has('fan_in')).toBe(true);
  });
  it('an absent section stays absent (N2)', () => {
    const doc = fallowDoc('relations-combined-3.27.0', (d) => { delete d.check!.circular_dependencies; delete (d.health as Record<string, unknown>).file_scores; });
    const r = rawReport(doc);
    expect(checkOf(r)?.circular_dependencies).toBeUndefined();
    expect(healthOf(r)?.file_scores).toBeUndefined();
  });
});

const cycles = (d: { check?: unknown }) => (d.check as { circular_dependencies: Record<string, unknown>[] }).circular_dependencies;

describe('each element is walked by hand, first failure wins (E31)', () => {
  it('a bad cycle file', () => {
    expect(fallowOutcome(fallowDoc('relations-combined-3.27.0', (d) => { cycles(d)[0]!.files = [1]; })))
      .toBe('invalid check.circular_dependencies.0.files.0');
  });
  it('an import cycle with no files is refused, never normalised into a finding with no path', () => {
    expect(fallowOutcome(fallowDoc('relations-combined-3.27.0', (d) => { cycles(d)[0]!.files = []; })))
      .toBe('invalid check.circular_dependencies.0.files');
  });
  it('a re-export cycle with no files is refused too', () => {
    expect(fallowOutcome(fallowDoc('relations-combined-3.27.0', (d) => {
      (d.check! as unknown as { re_export_cycles: Record<string, unknown>[] }).re_export_cycles[0]!.files = [];
    }))).toBe('invalid check.re_export_cycles.0.files');
  });
  it('a bad cycle edge', () => {
    expect(fallowOutcome(fallowDoc('relations-combined-3.27.0', (d) => { cycles(d)[0]!.edges = [{ path: 'a', line: -1, col: 0 }]; })))
      .toBe('invalid check.circular_dependencies.0.edges.0.line');
  });
  it('a bad violation', () => {
    expect(fallowOutcome(fallowDoc('relations-combined-3.27.0', (d) => {
      (d.check! as unknown as { boundary_violations: Record<string, unknown>[] }).boundary_violations[0]!.to_zone = 7;
    }))).toBe('invalid check.boundary_violations.0.to_zone');
  });
  it('a bad re-export kind', () => {
    expect(fallowOutcome(fallowDoc('relations-combined-3.27.0', (d) => {
      (d.check! as unknown as { re_export_cycles: Record<string, unknown>[] }).re_export_cycles[0]!.kind = 'triangle';
    }))).toBe('invalid check.re_export_cycles.0.kind');
  });
  it('a bad file score', () => {
    expect(fallowOutcome(fallowDoc('relations-combined-3.27.0', (d) => {
      (d.health! as unknown as { file_scores: Record<string, unknown>[] }).file_scores[0]!.fan_in = 1.5;
    }))).toBe('invalid health.file_scores.0.fan_in');
  });
  it('a tool string over 1,024 characters (N1)', () => {
    expect(fallowOutcome(fallowDoc('relations-combined-3.27.0', (d) => {
      (d.check! as unknown as { unresolved_imports: Record<string, unknown>[] }).unresolved_imports[0]!.specifier = 'x'.repeat(1025);
    }))).toBe('invalid check.unresolved_imports.0.specifier');
  });
  it('a huge array of bad elements fails at the first one', () => {
    const bad = Array.from({ length: 50_000 }, () => ({}));
    expect(fallowOutcome(fallowDoc('relations-combined-3.27.0', (d) => { (d.check! as unknown as Record<string, unknown>).unresolved_imports = bad; })))
      .toBe('invalid check.unresolved_imports.0.path');
  });
  it('dead-code reports carry the same arrays at the top level', () => {
    const doc = fallowDoc('dead-code-3.27.0');
    expect(fallowOutcome(doc)).toBe('accepted');
    const r = rawReport(doc);
    expect(r.kind === 'dead-code' ? r.circular_dependencies : null).toEqual([]);
  });
});
