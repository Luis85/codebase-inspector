// WP-03 Part 1 N34: the relations fixture project's three recordings (see
// tests/fixtures/fallow/README.md's "Relations project" section). This task has no
// production code — the recordings themselves are the deliverable, and every later
// task's expected values come from what fallow actually wrote here, never a guess.
import { describe, expect, it } from 'vitest';
import { RELATION_FIXTURES, fallowDoc, rawReport, type FallowDoc } from '../fixtures/fallow-fixture';

const CHECK_ARRAY_KEYS = ['circular_dependencies', 're_export_cycles', 'boundary_violations', 'unresolved_imports'] as const;

const hasBoundariesNotConfigured = (doc: FallowDoc): boolean =>
  (doc.workspace_diagnostics ?? []).some((d) => d.kind === 'boundaries-not-configured');

describe('fallow relations fixtures: the recorded relations project (WP-03 Part 1 N34)', () => {
  it.each<[(typeof RELATION_FIXTURES)[number], number, string]>([
    ['relations-combined-3.27.0', 12, '3.27.0'],
    ['relations-combined-3.21.0', 11, '3.21.0'],
    ['relations-no-boundaries-3.27.0', 12, '3.27.0'],
  ])('accepts %s as kind combined, schema %i, version %s', (name, schema, version) => {
    const report = rawReport(name);
    expect([report.kind, report.schema_version, report.version]).toEqual(['combined', schema, version]);
  });

  it.each(RELATION_FIXTURES)('has the four relation check fields as arrays in %s', (name) => {
    const doc = fallowDoc(name);
    expect(CHECK_ARRAY_KEYS.length).toBeGreaterThan(0);
    for (const key of CHECK_ARRAY_KEYS) expect({ key, isArray: Array.isArray(doc.check?.[key]) }).toEqual({ key, isArray: true });
  });

  it.each(RELATION_FIXTURES)('has health.file_scores as an array in %s', (name) => {
    const doc = fallowDoc(name);
    expect(Array.isArray(doc.health?.file_scores)).toBe(true);
  });

  it('the no-boundaries recording has a boundaries-not-configured diagnostic, and the 3.27.0 recording with boundaries does not', () => {
    expect(hasBoundariesNotConfigured(fallowDoc('relations-no-boundaries-3.27.0'))).toBe(true);
    expect(hasBoundariesNotConfigured(fallowDoc('relations-combined-3.27.0'))).toBe(false);
  });
});
