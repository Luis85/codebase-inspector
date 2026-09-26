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

/** Counts test files anywhere beneath `dir`, at any depth. RECURSIVE since fix round 2
 *  (re-review minor 3): the flat version counted only files sitting DIRECTLY in
 *  `tests/<layer>/`, so a test added at `tests/unit/domain/x.test.ts` would have run in
 *  the suite while being invisible to both checks below -- a hole in the very guard
 *  whose job is to stop the record drifting from the suite. Latent rather than live
 *  (every test file is at depth 2 today), and cheap enough that leaving it latent was
 *  not worth the argument. */
function countTestFiles(dir: string): number {
  let total = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) total += countTestFiles(join(dir, entry.name));
    else if (/\.(test|steps)\.ts$/.test(entry.name)) total += 1;
  }
  return total;
}

/** Every directory under `tests/` that actually holds test files, at any depth. */
function realLayers(): Map<string, number> {
  const layers = new Map<string, number>();
  for (const name of readdirSync(TESTS_ROOT)) {
    const full = join(TESTS_ROOT, name);
    if (!statSync(full).isDirectory() || NOT_A_LAYER.has(name)) continue;
    const files = countTestFiles(full);
    if (files > 0) layers.set(name, files);
  }
  return layers;
}

function statedTotal(source: string): number {
  // A measured run may carry failures (WP-04 Part 2's Z38 under load), so "<n> failed," is optional.
  const match = /\*\*(\d+) files, (\d+) tests, (\d+) passed,\s*(?:(\d+) failed,\s*)?(\d+) skipped\.\*\*/.exec(source);
  expect(match, 'the G8 heading does not state "<n> files, <n> tests, <n> passed, [<n> failed,] <n> skipped"').not.toBeNull();
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

// ---------------------------------------------------------------------------------
// THE INVARIANT PIN (fix round 2, re-review recommendation; ruling M118's other half)
// ---------------------------------------------------------------------------------
//
// This document, `tests/acceptance/wp01.feature`'s header and
// `tests/acceptance/steps/source-steps.ts`'s comment all state that
// `ScanCoordinator`'s `mayPublish` guard is UNREACHABLE BY CONSTRUCTION, and that no
// test can therefore kill it. Those three sites stop a reader mistaking the guard's
// presence for coverage. They do nothing about the opposite risk, which is the one
// M118 was actually ruled on: the day the invariant stops holding, the guard becomes
// reachable, the suite stays green, and all three sites become ACTIVELY FALSE while
// still asserting that the hazard cannot occur. A stale comment claiming a hazard is
// impossible is worse than no comment.
//
// The unreachability argument has exactly TWO load-bearing legs (the re-review
// corrected an earlier, larger claim -- "one coordinator per CityView" is NOT one of
// them, because a second coordinator describes its own run and so publishes correctly):
//
//   (a) SCAN_STARTED no-ops while a run is running or cancelling, so no second run can
//       become current while this one is in flight. ALREADY PINNED behaviourally by
//       tests/unit/run-state.test.ts's "treats a duplicate start during a run as a
//       no-op" -- break it and a test reddens.
//   (b) There is NO YIELD POINT between the second `wasCancelled` check and the guard,
//       so nothing can advance the lifecycle in between. PINNED BY NOTHING -- until
//       this. Inserting an `await` there (an async validator, an async store.put, a
//       telemetry hook) is an utterly ordinary edit and is completely silent.
//
// THIS IS A TRIPWIRE, NOT COVERAGE. It does not test that publication is refused; it
// tests that the reason we say publication cannot need refusing is still true. The
// moment it fails, one of two things must happen: a test that kills the guard, or a
// correction to all three documentation sites.
//
// Comments are STRIPPED before scanning, and that is not fussiness: the branch already
// shipped a stylesheet-as-contract test that passed with its own defect reinstated
// because a CSS comment quoting braces truncated the parsed rule (rulings M113's
// round). The comment block inside this very slice runs to fifteen lines and a future
// one could easily contain the word `await` in prose.
const COORDINATOR = resolve(process.cwd(), 'src', 'application', 'scan-coordinator.ts');

/** Removes `//` line comments, so prose inside the slice can never be mistaken for
 *  code. Block comments are not used in this region; a `/*` here would be caught by
 *  the marker assertions below rather than silently swallowed. */
function stripLineComments(source: string): string {
  return source.split('\n').map((line) => {
    const marker = line.indexOf('//');
    return marker === -1 ? line : line.slice(0, marker);
  }).join('\n');
}

/** The slice the argument depends on: from the SECOND `wasCancelled` check (the one
 *  after `emitFinal`) to the guard itself. */
function guardSlice(source: string): string {
  const check = 'if (this.wasCancelled(runId))';
  const first = source.indexOf(check);
  expect(first, 'scan-coordinator.ts no longer contains a wasCancelled check').toBeGreaterThan(-1);
  const second = source.indexOf(check, first + check.length);
  expect(second, 'scan-coordinator.ts no longer has a SECOND wasCancelled check — the '
    + 're-entrant-cancel-during-emitFinal guard the unreachability argument relies on').toBeGreaterThan(-1);
  const guard = source.indexOf('if (!mayPublish(', second);
  expect(guard, 'scan-coordinator.ts no longer contains the mayPublish guard').toBeGreaterThan(-1);
  return source.slice(second, guard);
}

describe('the mayPublish guard\'s unreachability — leg (b), the yield-point invariant', () => {
  const CONSEQUENCE = 'A yield point now sits inside the mayPublish guard\'s unreachability '
    + 'argument (scan-coordinator.ts, between the second wasCancelled check and `if (!mayPublish(`). '
    + 'EITHER the guard is now reachable and needs an acceptance test that kills it, OR the G8 '
    + 'honesty note in docs/superpowers/notes/2026-09-17-wp01-gate-evidence.md, the header of '
    + 'tests/acceptance/wp01.feature and the comment in tests/acceptance/steps/source-steps.ts '
    + 'are now wrong and must be corrected. Do not simply delete this test.';

  it('has no await between the second cancellation check and the guard', () => {
    const slice = stripLineComments(readFileSync(COORDINATOR, 'utf8'));
    expect(guardSlice(slice), CONSEQUENCE).not.toMatch(/\bawait\b/);
  });

  it('has no yield there either', () => {
    // A generator delegation would hand control back just as an await does.
    const slice = stripLineComments(readFileSync(COORDINATOR, 'utf8'));
    expect(guardSlice(slice), CONSEQUENCE).not.toMatch(/\byield\b/);
  });

  it('is scanning real code, not an empty slice', () => {
    // Without this the two assertions above would pass just as well against a slice
    // that found nothing — the vacuous-pass shape every absence check on this branch
    // is required to rule out.
    const slice = guardSlice(stripLineComments(readFileSync(COORDINATOR, 'utf8')));
    expect(slice).toContain('validateSnapshot');
    expect(slice).toContain('identityOf');
    expect(slice.length).toBeGreaterThan(120);
  });

  it('leg (a) is pinned behaviourally, and this test does not duplicate it', () => {
    // The other leg is covered by real behaviour rather than by source text; named here
    // so a reader of this file knows both legs are held, and by what.
    const runState = readFileSync(resolve(process.cwd(), 'tests', 'unit', 'run-state.test.ts'), 'utf8');
    expect(runState, 'leg (a) lost its behavioural pin').toContain('duplicate start during a run');
  });
});

// ---------------------------------------------------------------------------------
// THE ACCESSIBILITY OPEN-ROW COUNT, DERIVED (fix round 2, controller item 2)
// ---------------------------------------------------------------------------------
//
// The GATE STATUS block said "Ten of the matrix's fourteen rows" immediately above a
// THIRTEEN-item enumeration. A wrong number in the one block whose entire purpose is to
// state authoritatively what is open, in the document whose previous finding was also a
// wrong number, and it is the number task 13's release gate will read. It had already
// been transcribed three times -- my report, the controller's message to the user, the
// document -- so it is derived here instead of transcribed a fourth.
//
// The rule is deliberately crude enough to be unarguable: a row is CLOSED only if its
// Result cell begins `**PASSED`. "**jsdom half PASSED, manual half NOT PERFORMED**" is
// OPEN, because half a row is not a gate.
const MATRIX = resolve(process.cwd(), 'docs', 'superpowers', 'notes', '2026-09-17-wp01-accessibility-matrix.md');

interface MatrixCount { total: number; open: number }

function countMatrixRows(): MatrixCount {
  const source = readFileSync(MATRIX, 'utf8');
  const start = source.indexOf('<!-- a11y:table:start -->');
  const end = source.indexOf('<!-- a11y:table:end -->');
  expect(start, 'the accessibility matrix table markers are missing').toBeGreaterThan(-1);
  expect(end).toBeGreaterThan(start);
  let total = 0;
  let open = 0;
  for (const line of source.slice(start, end).split('\n')) {
    const cells = line.split('|').map((c) => c.trim());
    if (cells.length < 5) continue;                       // not a row
    const [, check, , result] = cells;
    if (check === 'Check' || /^-+$/.test(check ?? '')) continue;   // header or rule
    total += 1;
    if (!result?.startsWith('**PASSED')) open += 1;
  }
  return { total, open };
}

/** "…**13** of the matrix's **14** rows…", wherever a document states it. */
function statedRowCounts(source: string, label: string): MatrixCount {
  const match = /\*\*(\d+)\*\* of the matrix's \*\*(\d+)\*\* rows/.exec(source);
  expect(match, `${label} does not state "**<n>** of the matrix's **<n>** rows"`).not.toBeNull();
  return { open: Number(match![1]), total: Number(match![2]) };
}

describe('the accessibility gate\'s open-row count is derived, not retyped', () => {
  it('matches what the matrix itself says, row by row', () => {
    const real = countMatrixRows();
    // Sanity: the matrix is the fourteen-row table both documents describe, and it is
    // not vacuously empty or wholly unstarted.
    expect(real.total).toBeGreaterThan(5);
    expect(real.open).toBeLessThan(real.total);
    expect(statedRowCounts(readEvidence(), 'the GATE STATUS block')).toEqual(real);
    expect(statedRowCounts(readFileSync(MATRIX, 'utf8'), 'the matrix\'s own warning')).toEqual(real);
  });

  it('enumerates exactly as many outstanding rows as it claims', () => {
    // The specific contradiction that shipped: a stated count above a list of a
    // different length. Counting the list is what makes the two agree by force.
    const source = readEvidence();
    const start = source.indexOf('<!-- a11y:open:start -->');
    const end = source.indexOf('<!-- a11y:open:end -->');
    expect(start, 'the GATE STATUS enumeration markers are missing').toBeGreaterThan(-1);
    const items = source.slice(start, end).split('\n').filter((l) => /^\d+\. /.test(l)).length;
    expect(items, 'the enumeration and the stated count disagree').toBe(countMatrixRows().open);
  });

  it('still says, in terms, that the gate is not passed', () => {
    // The count being right is worth nothing if the prohibition goes missing.
    const source = readEvidence();
    expect(source).toContain('as evidence that accessibility is gated');
    expect(source).toContain('checkpoint #4');
    expect(readFileSync(MATRIX, 'utf8')).toContain('NOT a passing gate');
  });
});

describe('G6 credits the real-process ENOENT to the test that actually spawns (Part 7 final review)', () => {
  it('the "Missing native binary" row cites a test file that really spawns and really gets ENOENT', () => {
    const row = readEvidence().split('\n').find((line) => line.startsWith('| Missing native binary |'));
    expect(row, 'the G6 "Missing native binary" row is missing').toBeDefined();
    const cited = /`(tests\/[^`]+\.test\.ts)`: a real spawn `ENOENT`/.exec(row ?? '');
    expect(cited, 'the row no longer names the file behind "a real spawn ENOENT"').not.toBeNull();
    const source = readFileSync(resolve(process.cwd(), cited?.[1] ?? ''), 'utf8');
    expect(source, `${cited?.[1] ?? ''} does not spawn a real process`).toContain('realSpawn');
    expect(source).toContain("errorCode: 'ENOENT'");
  });
});
