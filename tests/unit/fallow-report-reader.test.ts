// Part 6 Y20-Y22, Y31: reading a fallow report. The recorded fixtures, the supported
// (kind, schema) set, the size limit, JSON, the schema's first issue path, and the
// fields that must never survive the parse.
import { describe, expect, it, vi } from 'vitest';
import { parseFallowReportText, readFallowReportFile } from '../../src/application/evidence/read-fallow-report';
import { HEALTH_FINDING, SUMMARY_VALUE, firstArrayFailure, firstRecordFailure } from '../../src/application/evidence/fallow-report-schema';
import { FALLOW_REPORT_MAX_BYTES, FALLOW_SUPPORTED } from '../../src/application/evidence/raw-fallow';
import {
  DROPPED_KEYS, FALLOW_FIXTURES, deepKeys, deepStrings, fallowDoc, fallowOutcome, fallowText, fixtureSourceLines, rawReport, rows,
  type FallowDoc, type FallowFixture,
} from '../fixtures/fallow-fixture';

const BOM = String.fromCharCode(0xfeff);
type Change = (d: FallowDoc) => void;

describe('fallow reader: the recorded fixtures (Part 6 Y20, Y21)', () => {
  it.each<[FallowFixture, string, number, string]>([
    ['combined-3.27.0', 'combined', 12, '3.27.0'],
    ['dead-code-3.27.0', 'dead-code', 9, '3.27.0'],
    ['health-3.27.0', 'health', 11, '3.27.0'],
    ['dupes-3.27.0', 'dupes', 10, '3.27.0'],
    ['combined-3.21.0', 'combined', 11, '3.21.0'],
  ])('accepts %s', (name, kind, schema, version) => {
    const report = rawReport(name);
    expect([report.kind, report.schema_version, report.version]).toEqual([kind, schema, version]);
  });

  it('supports exactly the recorded (kind, schema) pairs', () => {
    expect(FALLOW_SUPPORTED.map((s) => `${s.kind}@${s.schema}`).sort()).toEqual(['combined@11', 'combined@12', 'dead-code@9', 'dupes@10', 'health@11']);
    expect(FALLOW_FIXTURES).toHaveLength(5);
  });

  it('reads the fields it uses from the combined 3.27.0 report', () => {
    const report = rawReport('combined-3.27.0');
    if (report.kind !== 'combined') throw new Error('expected a combined report');
    expect(report.check?.unused_exports).toEqual([{ path: 'src/text/format.ts', export_name: 'unusedHelper', is_type_only: false, line: 7, col: 16 }]);
    expect(report.check?.unused_types).toEqual([{ path: 'src/text/format.ts', export_name: 'LabelOptions', is_type_only: true, line: 1, col: 17 }]);
    expect(report.dupes?.clone_groups).toEqual([{
      fingerprint: fallowDoc('combined-3.27.0').dupes!.clone_groups[0]!.fingerprint, token_count: 93, line_count: 15,
      instances: [{ file: 'src/text/sum-a.ts', start_line: 1, end_line: 15 }, { file: 'src/text/sum-b.ts', start_line: 1, end_line: 15 }],
    }]);
    expect(report.health?.findings).toEqual([{
      path: 'src/layout/partition.ts', name: 'partitionDistrict', line: 1, col: 7,
      cyclomatic: 18, cognitive: 32, line_count: 37, exceeded: 'cognitive_crap', severity: 'critical',
    }]);
    expect(report.health?.summary).toEqual({ max_cyclomatic_threshold: 20, max_cognitive_threshold: 15 });
    expect(report.check?.summary.unused_exports).toBe(1);
  });

  it.each(FALLOW_FIXTURES)('drops every field it does not read from %s: no fragment, action or telemetry survives', (name) => {
    expect(deepKeys(JSON.parse(fallowText(name))).has('actions')).toBe(true);
    const keys = deepKeys(rawReport(name));
    expect(keys.size).toBeGreaterThan(0);
    for (const dropped of DROPPED_KEYS) expect({ name, dropped, kept: keys.has(dropped) }).toEqual({ name, dropped, kept: false });
  });

  // Fix round 1 (E31, minor 4): the drop test above only proves the KEY `fragment` is
  // gone. This proves the source TEXT it once carried is gone too, by scanning every
  // string value of the parsed report for any fixture source line.
  it('has fragment in the raw recordings this scan depends on (precondition)', () => {
    for (const name of ['combined-3.27.0', 'dupes-3.27.0', 'combined-3.21.0'] as const satisfies readonly FallowFixture[]) {
      expect(deepKeys(JSON.parse(fallowText(name))).has('fragment')).toBe(true);
    }
  });

  it.each(FALLOW_FIXTURES)('keeps no fixture source line anywhere in the parsed report from %s', (name) => {
    const sourceLines = fixtureSourceLines();
    expect(sourceLines.length).toBeGreaterThan(0);
    const reportStrings = deepStrings(rawReport(name));
    expect(reportStrings.length).toBeGreaterThan(0);
    for (const line of sourceLines) {
      for (const value of reportStrings) expect({ name, line, contains: value.includes(line) }).toEqual({ name, line, contains: false });
    }
  });
});

describe('fallow reader: refusals (Part 6 Y20, Y31)', () => {
  it('refuses text over 16 MB, and text that is not JSON', () => {
    expect(parseFallowReportText(' '.repeat(FALLOW_REPORT_MAX_BYTES + 1))).toEqual({ ok: false, code: 'too-large', detail: '' });
    for (const text of ['{', '', 'undefined', 'NaN', fallowText('combined-3.27.0').slice(0, 200)]) {
      expect(parseFallowReportText(text), text.slice(0, 20)).toEqual({ ok: false, code: 'not-json', detail: '' });
    }
  });

  it('accepts a report saved with a byte order mark', () => {
    expect(parseFallowReportText(BOM + fallowText('dead-code-3.27.0')).ok).toBe(true);
  });

  it.each<[string, unknown, string]>([
    ['a newer combined schema', { kind: 'combined', schema_version: 13, version: '3.30.0' }, 'unsupported combined@13'],
    ['an older combined schema', { kind: 'combined', schema_version: 10, version: '3.10.0' }, 'unsupported combined@10'],
    ['dead-code at the combined schema', { kind: 'dead-code', schema_version: 12, version: '3.27.0' }, 'unsupported dead-code@12'],
    ['an unknown kind', { kind: 'audit', schema_version: 1 }, 'unsupported audit@1'],
    ['a long kind, clipped', { kind: 'k'.repeat(100), schema_version: 1 }, `unsupported ${'k'.repeat(40)}@1`],
    ['a schema given as text', { kind: 'combined', schema_version: '12' }, 'unsupported'],
    ['no kind at all', { schema_version: 12 }, 'unsupported'],
    ['an empty object', {}, 'unsupported'],
    ['an array', [], 'unsupported'],
    ['null', null, 'unsupported'],
    ['a string', 'combined', 'unsupported'],
  ])('refuses %s as unsupported, naming what it found', (_name, doc, expected) => {
    expect(fallowOutcome(doc)).toBe(expected);
  });

  it.each<[string, Change, string]>([
    ['a version that is not major.minor.patch', (d) => { d.version = 'v3'; }, 'invalid version'],
    ['a version over 64 characters', (d) => { d.version = `3.27.0-${'x'.repeat(60)}`; }, 'invalid version'],
    ['a missing cognitive count', (d) => { delete d.health!.findings[0]!.cognitive; }, 'invalid health.findings.0.cognitive'],
    ['a line given as text', (d) => { d.check!.unused_exports[0]!.line = '7'; }, 'invalid check.unused_exports.0.line'],
    ['a negative line', (d) => { d.check!.unused_types[0]!.line = -1; }, 'invalid check.unused_types.0.line'],
    ['a clone instance whose file is a number', (d) => { d.dupes!.clone_groups[0]!.instances[1]!.file = 3; }, 'invalid dupes.clone_groups.0.instances.1.file'],
    ['a summary count given as text', (d) => { d.check!.summary.unused_files = 'none'; }, 'invalid check.summary.unused_files'],
    ['a missing threshold', (d) => { d.health!.summary.max_cognitive_threshold = null; }, 'invalid health.summary.max_cognitive_threshold'],
    ['a null section', (d) => { d.check = null; }, 'invalid check'],
    ['a diagnostic without a message', (d) => { d.workspace_diagnostics = [{ path: '.', kind: 'x' }]; }, 'invalid workspace_diagnostics.0.message'],
  ])('refuses a combined report with %s, naming the first issue', (_name, change, expected) => {
    expect(fallowOutcome(fallowDoc('combined-3.27.0', change))).toBe(expected);
  });

  it.each<[FallowFixture, Change, string]>([
    ['dead-code-3.27.0', (d) => { rows(d, 'unused_types')[0]!.is_type_only = 'yes'; }, 'invalid unused_types.0.is_type_only'],
    ['health-3.27.0', (d) => { rows(d, 'findings')[0]!.severity = 3; }, 'invalid findings.0.severity'],
    ['dupes-3.27.0', (d) => { rows(d, 'clone_groups')[0]!.token_count = 1.5; }, 'invalid clone_groups.0.token_count'],
  ])('refuses a broken single-command report (%s) at its top-level path', (name, change, expected) => {
    expect(fallowOutcome(fallowDoc(name, change))).toBe(expected);
  });
});

describe('fallow reader: stops at the first bad array element (Fix round 1, E31 Important 1)', () => {
  it('refuses a huge array of bad findings without validating the rest of it', () => {
    const doc = fallowDoc('combined-3.27.0', (d) => { d.health!.findings = Array.from({ length: 300000 }, () => ({})); });
    expect(fallowOutcome(doc)).toBe('invalid health.findings.0.path');
  });

  it('names a bad element that is not first, after two valid ones', () => {
    const doc = fallowDoc('combined-3.27.0', (d) => {
      const good = d.health!.findings[0]!;
      d.health!.findings = [good, good, {}];
    });
    expect(fallowOutcome(doc)).toBe('invalid health.findings.2.path');
  });

  // Fix round 3 (E31, Important 1): a wall-clock budget does not actually prove the walk
  // stops early — the OLD, unbounded z.array(itemSchema)/z.record(z.string(), z.number())
  // validation of 300,000 bad elements/values was still fast enough (well under a
  // generous budget) to pass it, in this environment, even without either fix. These two
  // tests instead count element/value READS with getters: if the walk kept going past the
  // first failure, `reads` would include every index/key up to 300,000, not just the ones
  // up to and including the bad one. GOOD_FINDING is a valid element, so every read before
  // the bad index succeeds and the walk only stops because of the bad one.
  const GOOD_FINDING = { path: 'a', name: 'b', line: 1, col: 1, cyclomatic: 1, cognitive: 1, line_count: 1, exceeded: 'x', severity: 'y' };

  it('reads no array element after the first bad one (structural proof)', () => {
    const reads: number[] = [];
    const badIndex = 5;
    const items: unknown[] = Array.from({ length: 300000 });
    for (let i = 0; i < items.length; i += 1) {
      Object.defineProperty(items, i, { enumerable: true, configurable: true, get: () => { reads.push(i); return i === badIndex ? {} : GOOD_FINDING; } });
    }
    const result = firstArrayFailure(items, HEALTH_FINDING, ['findings']);
    expect(result).toEqual({ ok: false, path: ['findings', badIndex, 'path'] });
    expect(reads).toEqual([0, 1, 2, 3, 4, 5]);
  });

  // Fix round 2 (E31, Important 1 continued): the same attack works through a record,
  // not only an array — `check.summary`/the flattened `summary` is an object with as
  // many keys as the report writer wants.
  it('refuses a huge summary record of bad values without validating the rest of it', () => {
    const doc = fallowDoc('dead-code-3.27.0', (d) => {
      const summary: Record<string, string> = {};
      for (let i = 0; i < 300000; i += 1) summary[`k${i}`] = '';
      d.summary = summary;
    });
    expect(fallowOutcome(doc)).toBe('invalid summary.k0');
  });

  it('reads no summary value after the first bad one (structural proof)', () => {
    const reads: string[] = [];
    const badIndex = 5;
    const record: Record<string, unknown> = {};
    for (let i = 0; i < 300000; i += 1) {
      const key = `k${i}`;
      Object.defineProperty(record, key, { enumerable: true, configurable: true, get: () => { reads.push(key); return i === badIndex ? '' : 1; } });
    }
    const result = firstRecordFailure(record, SUMMARY_VALUE, ['summary']);
    expect(result).toEqual({ ok: false, path: ['summary', `k${badIndex}`] });
    expect(reads).toEqual(['k0', 'k1', 'k2', 'k3', 'k4', 'k5']);
  });

  it('never lets __proto__ in a summary record become an inherited key', () => {
    const doc = fallowDoc('dead-code-3.27.0', (d) => {
      d.summary = JSON.parse('{"__proto__": {"polluted": true}, "unused_exports": 1}');
    });
    const report = rawReport(doc);
    if (report.kind !== 'dead-code') throw new Error('expected a dead-code report');
    expect(Object.prototype.hasOwnProperty.call(report.summary, '__proto__')).toBe(false);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    expect(report.summary.unused_exports).toBe(1);
  });
});

describe('fallow reader: what it tolerates (Part 6 Y22)', () => {
  it.each<[string, Change]>([
    ['a new top-level section', (d) => { d.coverage = { files: [] }; }],
    ['a new field on a finding', (d) => { d.health!.findings[0]!.halstead = 12; }],
    ['a new summary count', (d) => { d.check!.summary.unused_widgets = 4; }],
    ['a pre-release version', (d) => { d.version = '3.27.0-beta.1'; }],
    ['no workspace diagnostics (fallow 3.21.0 writes none)', (d) => { delete d.workspace_diagnostics; }],
    ['no health, dupes or check section', (d) => { delete d.health; delete d.dupes; delete d.check; }],
    ['a finding without its fragment and actions', (d) => { delete d.health!.findings[0]!.actions; delete d.dupes!.clone_groups[0]!.instances[0]!.fragment; }],
  ])('accepts a combined report with %s', (_name, change) => {
    expect(fallowOutcome(fallowDoc('combined-3.27.0', change))).toBe('accepted');
  });

  it('drops a new field instead of keeping it', () => {
    const report = rawReport(fallowDoc('combined-3.27.0', (d) => { d.coverage = { files: [] }; d.health!.findings[0]!.halstead = 12; }));
    expect(deepKeys(report).has('coverage')).toBe(false);
    expect(deepKeys(report).has('halstead')).toBe(false);
  });
});

describe('fallow reader: the picked file (Part 6 Y20, Y31)', () => {
  it('refuses a file over 16 MB without reading it', async () => {
    const text = vi.fn(() => Promise.resolve('{}'));
    expect(await readFallowReportFile({ size: FALLOW_REPORT_MAX_BYTES + 1, text } as unknown as File)).toEqual({ ok: false, code: 'too-large', detail: '' });
    expect(text).not.toHaveBeenCalled();
  });

  it('checks the text length again after reading', async () => {
    const long = { size: 10, text: () => Promise.resolve(' '.repeat(FALLOW_REPORT_MAX_BYTES + 1)) } as unknown as File;
    expect(await readFallowReportFile(long)).toMatchObject({ ok: false, code: 'too-large' });
  });

  it('reports a failed read', async () => {
    const failing = { size: 10, text: () => Promise.reject(new Error('gone')) } as unknown as File;
    expect(await readFallowReportFile(failing)).toEqual({ ok: false, code: 'read-failed', detail: '' });
  });

  it('reads a real picked file', async () => {
    const result = await readFallowReportFile(new File([fallowText('health-3.27.0')], 'health.json', { type: 'application/json' }));
    expect(result.ok && result.report.kind).toBe('health');
  });
});
