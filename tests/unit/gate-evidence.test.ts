// G8's own numbers, machine-checked.
//
// FIX ROUND 1, review Important 2. The G8 table was written by hand and was wrong in
// two ways at once: it omitted the `tests/host/**` layer entirely (which the same
// document then cited nine times as evidence), and its totals predated three tests added
// in the very commit that wrote it. The reviewer's point is the general one -- a
// transcribed total is one commit away from being wrong again, and this branch has
// already been bitten by a test that transcribed values it claimed to derive (ruling
// M109).
//
// So the two errors that actually happened are now impossible to make silently:
//
//   1. **A missing or phantom layer.** Every directory under `tests/` that holds test
//      files must have a row, and every row must name a real directory. Exact, static,
//      no judgement.
//   2. **An internally inconsistent total.** The per-layer test counts in the table must
//      SUM to the total the G8 heading states. "Rows sum to 842, heading says 936" is
//      precisely what slipped through, and it cannot now.
//
// Plus the FILE counts, which are exactly derivable from disk and so are derived here
// rather than believed.
//
// WHAT THIS DELIBERATELY DOES NOT CHECK, so nobody reads more into it than it says: the
// per-layer TEST counts themselves. Vitest exposes no whole-suite tally to a test inside
// that suite, and counting `it(` statically is wrong here by construction -- the
// acceptance runner generates 24 tests from one loop and `describe.each` multiplies the
// benchmark's. Those figures stay transcribed, which is why the document now records the
// exact command and the commit they were taken at, and why this test pins their sum.
//
// Markdown, not CSS, so the comment-truncation hazard that bit the stylesheet contract
// tests does not apply -- but the same lesson does, which is why the table is delimited
// by explicit markers rather than found by guessing at heading text.
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

const EVIDENCE = resolve(process.cwd(), 'docs', 'superpowers', 'notes', '2026-09-17-wp01-gate-evidence.md');
const TESTS_ROOT = resolve(process.cwd(), 'tests');

/** Directories that hold no tests of their own and are therefore not layers: shared
 *  fixtures, mocks, and the global setup file's home. */
const NOT_A_LAYER = new Set(['fixtures', 'mocks']);

interface TableRow { layer: string; directory: string; files: number; tests: number }

function readEvidence(): string {
  return readFileSync(EVIDENCE, 'utf8');
}

/** The G8 table, delimited by explicit markers in the document. */
function parseG8Table(source: string): TableRow[] {
  const start = source.indexOf('<!-- g8:table:start -->');
  const end = source.indexOf('<!-- g8:table:end -->');
  expect(start, 'the G8 table markers are missing from the evidence document').toBeGreaterThan(-1);
  expect(end).toBeGreaterThan(start);
  const rows: TableRow[] = [];
  for (const line of source.slice(start, end).split('\n')) {
    // | Layer | Directory | Files | Ran | Tests | Notes |
    const cells = line.split('|').map((c) => c.trim());
    if (cells.length < 8) continue;
    const [, layer, directory, files, , tests] = cells;
    if (!directory?.startsWith('`tests/')) continue;
    rows.push({
      layer: layer ?? '',
      directory: directory.replace(/`/g, '').replace(/^tests\//, '').replace(/\/\*\*$/, ''),
      files: Number(files),
      tests: Number(tests),
    });
  }
  return rows;
}

/** Every directory directly under `tests/` that actually holds test files. */
function realLayers(): Map<string, number> {
  const layers = new Map<string, number>();
  for (const name of readdirSync(TESTS_ROOT)) {
    const full = join(TESTS_ROOT, name);
    if (!statSync(full).isDirectory() || NOT_A_LAYER.has(name)) continue;
    const files = readdirSync(full).filter((f) => /\.(test|steps)\.ts$/.test(f)).length;
    if (files > 0) layers.set(name, files);
  }
  return layers;
}

function statedTotal(source: string): number {
  const match = /\*\*(\d+) files, (\d+) tests, (\d+) passed,\s*\n?(\d+) skipped\.\*\*/.exec(source.replace(/\n/g, '\n'));
  expect(match, 'the G8 heading does not state "<n> files, <n> tests, <n> passed, <n> skipped"').not.toBeNull();
  return Number(match![2]);
}

function statedFiles(source: string): number {
  const match = /\*\*(\d+) files,/.exec(source);
  return Number(match![1]);
}

describe('G8 evidence — the record matches the suite', () => {
  it('names every layer that exists, and no layer that does not', () => {
    const rows = parseG8Table(readEvidence());
    const recorded = rows.map((r) => r.directory).sort();
    const real = [...realLayers().keys()].sort();
    // This is the error that actually happened: `host` was missing while the same
    // document cited it nine times as evidence.
    expect(recorded).toEqual(real);
  });

  it('records each layer\'s FILE count as it is on disk', () => {
    const rows = parseG8Table(readEvidence());
    const real = realLayers();
    for (const row of rows) {
      expect(row.files, `${row.directory} file count`).toBe(real.get(row.directory));
    }
  });

  it('states a total that its own rows add up to', () => {
    const source = readEvidence();
    const rows = parseG8Table(source);
    const sum = rows.reduce((total, row) => total + row.tests, 0);
    // "Rows sum to 842, heading says 936" is what slipped through last time.
    expect(sum, 'the per-layer test counts do not sum to the stated total').toBe(statedTotal(source));
    expect(rows.reduce((total, row) => total + row.files, 0)).toBe(statedFiles(source));
  });

  it('is the document the shipped claims cite', () => {
    // The two factual claims name this file at both their sites; if it is ever renamed,
    // those citations become dangling and this fails first.
    const source = readEvidence();
    expect(source).toContain('## G2 — Source safety and scope');
    for (const site of ['src/host/modals/scope-modal.ts', 'src/ui/components/SnapshotStatus.vue']) {
      expect(readFileSync(resolve(process.cwd(), site), 'utf8'))
        .toContain('docs/superpowers/notes/2026-09-17-wp01-gate-evidence.md');
    }
  });
});
