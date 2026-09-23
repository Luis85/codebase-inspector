// Part 6 Y23, Y25, Y27: normalising a validated fallow report. The mapping rules for each
// kind, categories analysed or not, the counts reported but not shown, no source text
// kept, and the provenance of an attached report.
import { describe, expect, it } from 'vitest';
import { FINDING_CATEGORIES } from '../../src/application/evidence/model';
import { buildEvidenceReport, normalizeFallow } from '../../src/application/evidence/normalize-fallow';
import {
  DROPPED_KEYS, FALLOW_FIXTURES, deepKeys, deepStrings, fallowDoc, fallowText, fixtureSourceLines, rawReport, rows, type FallowDoc, type FallowFixture,
} from '../fixtures/fallow-fixture';
import { LABEL_OPTIONS, PARTITION, SUM_A, SUM_B, UNUSED_HELPER, where } from '../fixtures/fallow-expected';

const NO_STRIP = { stripPrefix: null };
const normalized = (source: FallowFixture | FallowDoc) => normalizeFallow(rawReport(source), NO_STRIP);
const notDuplication = (f: { category: string }): boolean => f.category !== 'duplication';

describe('normalizeFallow: mapping (Part 6 Y23)', () => {
  it('maps the combined 3.27.0 report: one complexity, two duplication and two unused findings', () => {
    expect(normalized('combined-3.27.0').findings).toEqual([PARTITION, SUM_A, SUM_B, UNUSED_HELPER, LABEL_OPTIONS]);
  });

  it.each<[FallowFixture, readonly unknown[]]>([
    ['dead-code-3.27.0', [UNUSED_HELPER, LABEL_OPTIONS]],
    ['health-3.27.0', [PARTITION]],
    ['dupes-3.27.0', [SUM_A, SUM_B]],
  ])('maps the single-command report %s the same way', (name, expected) => {
    expect(normalized(name).findings).toEqual(expected);
  });

  it('maps fallow 3.21.0 (combined schema 11) to the same findings at the same places', () => {
    const older = normalized('combined-3.21.0').findings;
    const current = normalized('combined-3.27.0').findings;
    expect(older.map(where)).toEqual(current.map(where));
    // Complexity and unused keys hold no fallow-assigned value, so their ids survive an upgrade.
    // Clone fingerprints are fallow's own and may change between versions.
    expect(older.filter(notDuplication).map((f) => f.id)).toEqual(current.filter(notDuplication).map((f) => f.id));
  });

  it('keeps the tool\'s severity verbatim, including one a later fallow may add', () => {
    const doc = fallowDoc('health-3.27.0', (d) => { rows(d, 'findings')[0]!.severity = 'severe'; });
    expect(normalized(doc).findings.map((f) => f.severity)).toEqual(['severe']);
  });

  it('keeps an HTML-looking symbol as plain text: it is data, never markup', () => {
    const symbol = '<img src=x onerror=alert(1)>';
    const doc = fallowDoc('dead-code-3.27.0', (d) => { rows(d, 'unused_exports')[0]!.export_name = symbol; });
    expect(normalized(doc).findings[0]!.symbol).toBe(symbol);
  });

  it('keeps every workspace diagnostic message as a warning, verbatim', () => {
    const messages = (fallowDoc('combined-3.27.0').workspace_diagnostics ?? []).map((d) => d.message);
    expect(messages.length).toBeGreaterThan(0);
    expect(normalized('combined-3.27.0').warnings).toEqual(messages);
    expect(normalized(fallowDoc('combined-3.27.0', (d) => { delete d.workspace_diagnostics; })).warnings).toEqual([]);
  });

  it('reports no refused path for the recorded fixtures', () => {
    for (const name of FALLOW_FIXTURES) expect({ name, rejected: normalized(name).rejectedPaths }).toEqual({ name, rejected: [] });
  });
});

describe('normalizeFallow: categories (Part 6 Y25)', () => {
  const A = 'analysed';
  const N = 'not-analysed';

  it.each<[FallowFixture, string, string, string]>([
    ['combined-3.27.0', A, A, A],
    ['combined-3.21.0', A, A, A],
    ['dead-code-3.27.0', N, N, A],
    ['health-3.27.0', A, N, N],
    ['dupes-3.27.0', N, A, N],
  ])('%s: complexity %s, duplication %s, unused exports %s', (name, complexity, duplication, unused) => {
    expect(normalized(name).categories).toEqual({ complexity, duplication, 'unused-exports': unused });
  });

  it('has exactly the three categories', () => {
    expect(Object.keys(normalized('combined-3.27.0').categories).sort()).toEqual([...FINDING_CATEGORIES].sort());
  });

  it('marks a combined report without a section Not analysed, never zero, and a present but empty section analysed', () => {
    const doc = fallowDoc('combined-3.27.0', (d) => {
      delete d.health;
      delete d.dupes;
      d.check!.unused_exports = [];
      d.check!.unused_types = [];
    });
    const result = normalized(doc);
    expect(result.categories).toEqual({ complexity: N, duplication: N, 'unused-exports': A });
    expect(result.findings).toEqual([]);
  });
});

describe('normalizeFallow: reported, not shown (Part 6 Y25)', () => {
  it('lists nothing when every other count is zero', () => {
    expect(normalized('combined-3.27.0').notShown).toEqual([]);
    expect(normalized('dead-code-3.27.0').notShown).toEqual([]);
  });

  it('lists every non-zero count Part 6 does not show, in the report\'s order, never the shown ones or the total', () => {
    const doc = fallowDoc('combined-3.27.0', (d) => {
      Object.assign(d.check!.summary, { total_issues: 9, unused_exports: 4, unused_types: 2, circular_dependencies: 2, unused_files: 3 });
    });
    expect(normalized(doc).notShown).toEqual([{ key: 'unused_files', count: 3 }, { key: 'circular_dependencies', count: 2 }]);
  });

  it('reads a dead-code report\'s top-level summary, including a count this version has no label for', () => {
    const doc = fallowDoc('dead-code-3.27.0', (d) => {
      Object.assign(d.summary as Record<string, unknown>, { unused_class_members: 14, unused_widgets: 1 });
    });
    expect(normalized(doc).notShown).toEqual([{ key: 'unused_class_members', count: 14 }, { key: 'unused_widgets', count: 1 }]);
  });

  it('lists the clone groups a dupes report left out', () => {
    const doc = fallowDoc('dupes-3.27.0', (d) => { d.clone_groups_omitted = 4; });
    expect(normalized(doc).notShown).toEqual([{ key: 'clone_groups_omitted', count: 4 }]);
    expect(normalized(fallowDoc('dupes-3.27.0', (d) => { d.clone_groups_omitted = 0; })).notShown).toEqual([]);
  });
});

describe('normalizeFallow: no source text is kept (Part 6 Y23)', () => {
  const lines = fixtureSourceLines();

  it('the fixtures really do carry source text, so the checks below can fail', () => {
    expect(lines.length).toBeGreaterThan(10);
    expect(lines.some((line) => fallowText('combined-3.27.0').includes(line))).toBe(true);
  });

  it.each(FALLOW_FIXTURES)('%s: no dropped key and no fixture source line in the normalised evidence', (name) => {
    const result = normalized(name);
    const keys = deepKeys(result);
    expect(keys.size).toBeGreaterThan(0);
    for (const dropped of DROPPED_KEYS) expect({ name, dropped, kept: keys.has(dropped) }).toEqual({ name, dropped, kept: false });
    // Fix round 1 (Important 3): deepStrings, not a single JSON.stringify scan, so a
    // fixture line containing a quote or backslash is not missed by JSON escaping.
    const strings = deepStrings(result);
    expect(lines.filter((line) => strings.some((s) => s.includes(line)))).toEqual([]);
  });

  it('the attached report keeps none either', () => {
    const report = buildEvidenceReport({
      raw: rawReport('combined-3.27.0'), fileName: 'combined.json', importedAt: '2026-09-23T10:00:00.000Z', snapshotId: 'snap-1', stripPrefix: null,
    });
    const strings = deepStrings(report);
    expect(lines.filter((line) => strings.some((s) => s.includes(line)))).toEqual([]);
    for (const dropped of DROPPED_KEYS) expect(deepKeys(report).has(dropped)).toBe(false);
  });

  it('a raw report carrying source text the parser never actually produces (fragment, injected by hand on a health finding, a clone group, a clone instance and an unused entry) still yields none', () => {
    const raw = rawReport('combined-3.27.0');
    const mutable = raw as unknown as {
      health: { findings: Record<string, unknown>[] };
      dupes: { clone_groups: (Record<string, unknown> & { instances: Record<string, unknown>[] })[] };
      check: { unused_exports: Record<string, unknown>[] };
    };
    const line = lines[0]!;
    mutable.health.findings[0]!.fragment = line;
    mutable.dupes.clone_groups[0]!.fragment = line;
    mutable.dupes.clone_groups[0]!.instances[0]!.fragment = line;
    mutable.check.unused_exports[0]!.fragment = line;
    const result = normalizeFallow(raw, NO_STRIP);
    expect(deepStrings(result)).not.toContain(line);
  });
});

describe('buildEvidenceReport: provenance (Part 6 Y27)', () => {
  const input = {
    raw: rawReport('combined-3.27.0'), fileName: 'combined-3.27.0.json', importedAt: '2026-09-23T10:00:00.000Z', snapshotId: 'snap-1', stripPrefix: null,
  };

  it('records the provider, version, kind, schema, file name, time, snapshot and mapping', () => {
    const report = buildEvidenceReport(input);
    expect({ ...report, normalized: null }).toEqual({
      provider: 'fallow', providerVersion: '3.27.0', reportKind: 'combined', schemaVersion: 12, fileName: 'combined-3.27.0.json',
      importedAt: '2026-09-23T10:00:00.000Z', snapshotId: 'snap-1', stripPrefix: null, normalized: null,
    });
    expect(report.normalized).toEqual(normalizeFallow(input.raw, NO_STRIP));
  });

  it('records a single-command report\'s own kind and schema', () => {
    const report = buildEvidenceReport({ ...input, raw: rawReport('dupes-3.27.0') });
    expect([report.reportKind, report.schemaVersion, report.providerVersion]).toEqual(['dupes', 10, '3.27.0']);
  });

  it.each<[string, string]>([
    ['C:\\Users\\dev\\reports\\fallow.json', 'fallow.json'],
    ['/home/dev/reports/fallow.json', 'fallow.json'],
    ['fallow.json', 'fallow.json'],
    [`${'f'.repeat(300)}.json`, 'f'.repeat(255)],
  ])('keeps only the file name of %j, at most 255 characters', (fileName, expected) => {
    expect(buildEvidenceReport({ ...input, fileName }).fileName).toBe(expected);
  });

  it('applies and records the chosen strip prefix', () => {
    const report = buildEvidenceReport({ ...input, stripPrefix: 'src/' });
    expect(report.stripPrefix).toBe('src/');
    expect(report.normalized.findings.map((f) => f.path)).toEqual([
      'layout/partition.ts', 'text/sum-a.ts', 'text/sum-b.ts', 'text/format.ts', 'text/format.ts',
    ]);
  });
});
