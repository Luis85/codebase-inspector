// Part 6 Y23, Y24, Y26: finding ids that survive a re-import, and report paths that are
// normalised, refused or stripped of a chosen folder before anything uses them.
import { describe, expect, it } from 'vitest';
import { fnv1a32Hex } from '../../src/domain/hash';
import { fnv1a } from '../../src/ui/fixtures/seeded-random';
import type { EvidenceFinding } from '../../src/application/evidence/model';
import { normalizeFallow } from '../../src/application/evidence/normalize-fallow';
import { FINDING_ID_PATTERN } from '../../src/ui/read-models/review-state';
import { FALLOW_FIXTURES, fallowDoc, rawReport, rows, type FallowDoc, type FallowFixture } from '../fixtures/fallow-fixture';
import { FIXTURE_FINGERPRINT, LABEL_OPTIONS, PARTITION, SUM_A, SUM_B, UNUSED_HELPER, cxId, duId } from '../fixtures/fallow-expected';

const normalized = (source: FallowFixture | FallowDoc, stripPrefix: string | null = null) =>
  normalizeFallow(rawReport(source), { stripPrefix });
const ids = (source: FallowFixture | FallowDoc): string[] => normalized(source).findings.map((f) => f.id).sort();
const byLine = (found: readonly EvidenceFinding[]): Map<string, string> => new Map(found.map((f) => [`${f.path}:${f.line ?? 0}`, f.id]));

/** The combined report with a second unused export, optionally with its lists reversed. */
function withTwoExports(reverse: boolean): FallowDoc {
  return fallowDoc('combined-3.27.0', (d) => {
    d.check!.unused_exports.push({ ...d.check!.unused_exports[0]!, export_name: 'otherHelper', line: 12 });
    if (reverse) {
      d.check!.unused_exports.reverse();
      d.dupes!.clone_groups[0]!.instances.reverse();
    }
  });
}

/** Every path in a combined report, rewritten. */
function withPaths(change: (path: string) => string): FallowDoc {
  return fallowDoc('combined-3.27.0', (d) => {
    for (const f of d.health!.findings) f.path = change(f.path as string);
    for (const g of d.dupes!.clone_groups) for (const i of g.instances) i.file = change(i.file as string);
    for (const e of [...d.check!.unused_exports, ...d.check!.unused_types]) e.path = change(e.path as string);
  });
}

describe('fnv1a32Hex (Part 6 Y24)', () => {
  it('matches the FNV-1a 32-bit test vectors', () => {
    expect(fnv1a32Hex('')).toBe('811c9dc5');
    expect(fnv1a32Hex('a')).toBe('e40c292c');
    expect(fnv1a32Hex('foobar')).toBe('bf9cf968');
  });

  it('is the same function as the sample fixtures\' fnv1a, as eight hex digits', () => {
    for (const text of ['', 'src/a.ts|draw|0', 'dup:6f87acd9|src/text/sum-a.ts', 'ünïcode']) {
      expect(fnv1a32Hex(text)).toBe(fnv1a(text).toString(16).padStart(8, '0'));
    }
  });
});

describe('finding ids (Part 6 Y24)', () => {
  it.each(FALLOW_FIXTURES)('%s: every id is distinct and matches FINDING_ID_PATTERN', (name) => {
    const all = normalized(name).findings.map((f) => f.id);
    expect(all.length).toBeGreaterThan(0);
    expect(new Set(all).size).toBe(all.length);
    for (const id of all) expect({ id, ok: FINDING_ID_PATTERN.test(id) && /^(CX|DU|UN)-[0-9a-f]{8}$/.test(id) }).toEqual({ id, ok: true });
  });

  it('gives the same ids on a second, separate normalisation', () => {
    expect(normalized('combined-3.27.0')).toEqual(normalized('combined-3.27.0'));
    expect(ids('combined-3.27.0')).toEqual([PARTITION, SUM_A, SUM_B, UNUSED_HELPER, LABEL_OPTIONS].map((f) => f.id).sort());
  });

  it('never puts the line in the key: moved code keeps its id', () => {
    const moved = fallowDoc('combined-3.27.0', (d) => {
      d.health!.findings[0]!.line = 40;
      d.check!.unused_exports[0]!.line = 99;
      for (const i of d.dupes!.clone_groups[0]!.instances) { i.start_line = 20; i.end_line = 34; }
    });
    expect(ids(moved)).toEqual(ids('combined-3.27.0'));
  });

  it('does not depend on the report\'s order', () => {
    expect(ids(withTwoExports(true))).toEqual(ids(withTwoExports(false)));
    expect(ids(withTwoExports(false))).toHaveLength(6);
  });

  it('numbers same-named functions in a file by their position in the source, not by report order', () => {
    const base = rows(fallowDoc('health-3.27.0'), 'findings')[0]!;
    const arrow = (line: number, path = 'src/text/format.ts') => ({ ...base, path, name: '<arrow>', line, col: 3 });
    const inOrder = [arrow(30), arrow(10), arrow(5, 'src/index.ts')];
    const inReverse = [arrow(5, 'src/index.ts'), arrow(10), arrow(30)];
    const forward = normalized(fallowDoc('health-3.27.0', (d) => { d.findings = inOrder; })).findings;
    const backward = normalized(fallowDoc('health-3.27.0', (d) => { d.findings = inReverse; })).findings;
    expect(byLine(forward)).toEqual(byLine(backward));
    expect(byLine(forward)).toEqual(new Map([
      ['src/text/format.ts:30', cxId('src/text/format.ts', '<arrow>', 1)],
      ['src/text/format.ts:10', cxId('src/text/format.ts', '<arrow>', 0)],
      ['src/index.ts:5', cxId('src/index.ts', '<arrow>', 0)],
    ]));
  });

  it('keeps one duplication finding per file of a group, with that file\'s earliest instance', () => {
    const doc = fallowDoc('dupes-3.27.0', (d) => {
      const group = rows(d, 'clone_groups')[0] as { instances: Record<string, unknown>[] };
      group.instances.push({ file: 'src/text/sum-a.ts', start_line: 20, end_line: 34 }, { file: 'src/index.ts', start_line: 2, end_line: 9 });
      group.instances.reverse();
    });
    const found = normalized(doc).findings;
    expect(found).toHaveLength(3);
    expect(new Map(found.map((f) => [f.path, [f.line, f.endLine]]))).toEqual(new Map([
      ['src/index.ts', [2, 9]], ['src/text/sum-a.ts', [1, 15]], ['src/text/sum-b.ts', [1, 15]],
    ]));
    for (const f of found) expect(f.detail).toEqual({ kind: 'duplication', tokenCount: 93, lineCount: 15, partnerFiles: 2 });
    expect(found.map((f) => f.id).sort()).toEqual(['src/index.ts', 'src/text/sum-a.ts', 'src/text/sum-b.ts'].map((p) => duId(FIXTURE_FINGERPRINT, p)).sort());
  });
});

describe('report paths (Part 6 Y23, Y26)', () => {
  it('refuses absolute, climbing and drive paths: their findings are dropped and the paths listed once, sorted', () => {
    const doc = fallowDoc('combined-3.27.0', (d) => {
      d.check!.unused_exports[0]!.path = '../outside.ts';
      d.health!.findings[0]!.path = '/abs/partition.ts';
      d.dupes!.clone_groups[0]!.instances[0]!.file = 'C:/x/sum-a.ts';
      d.check!.unused_types[0]!.path = '../outside.ts';
    });
    const result = normalized(doc);
    expect(result.findings.map((f) => f.id)).toEqual([SUM_B.id]);
    expect(result.findings[0]!.detail).toEqual(SUM_B.detail);
    expect(result.rejectedPaths).toEqual(['../outside.ts', '/abs/partition.ts', 'C:/x/sum-a.ts']);
  });

  it('accepts a Windows-style relative path as the same file', () => {
    const doc = fallowDoc('dead-code-3.27.0', (d) => { rows(d, 'unused_exports')[0]!.path = 'src\\text\\format.ts'; });
    expect(normalized(doc).findings[0]).toEqual(UNUSED_HELPER);
  });

  it('strips a chosen folder from every path under it, and the ids match an unprefixed report\'s', () => {
    const prefixed = withPaths((p) => `fixture/${p}`);
    expect(normalized(prefixed, 'fixture/').findings).toEqual(normalized('combined-3.27.0').findings);
    expect(normalized(prefixed).findings.map((f) => f.path)).toContain('fixture/src/text/format.ts');
  });

  it('leaves a path outside the chosen folder as it is', () => {
    const result = normalized('combined-3.27.0', 'lib/');
    expect(result.findings).toEqual(normalized('combined-3.27.0').findings);
  });

  it.each(['src', '../', '/abs/', 'src//', '', 'a\\b/', './'])('refuses the strip prefix %j (a programming error, never user input)', (prefix) => {
    expect(() => normalized('combined-3.27.0', prefix)).toThrow('A strip prefix is a relative folder ending in "/".');
  });
});
