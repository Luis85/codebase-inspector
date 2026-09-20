// EVERY NUMBER IN THE TWO EVIDENCE DOCUMENTS THAT DUPLICATES A DERIVABLE FACT.
//
// Why this file exists, stated plainly because it is the third time: a wrong count has
// now been found in these documents three separate times — first the stale G8 totals and
// the missing `tests/host` layer, then "ten of the fourteen" in two places, then
// "10 of the 14" in a third, seven lines below the corrected one. Each fix corrected the
// instances somebody had looked at and left the ones nobody had. That is not three
// unlucky typos. It is a document with the same fact transcribed in more places than
// anyone had enumerated, guarded by tests that read only the places already known about.
//
// So this file does not guard SITES. It guards VALUES, two ways round:
//
//   * POSITIVELY — every place either document states one of these facts must state the
//     derived value; and
//   * NEGATIVELY — for the counts that have actually gone stale, EVERY OTHER value is
//     searched for across the whole of both documents. Enumerating the wrong answers
//     rather than the right locations is what makes a site nobody has thought of fail
//     too. That is the specific lesson of the `## Summary` instance: it was a live
//     contradiction in a section the previous guard simply did not read.
//
// THE NEGATIVE SWEEP'S OWN HISTORY, because it is the point of this file: it shipped
// inert. Its probe was built as `` new RegExp(`\b…\b`) ``, and inside a template literal
// `\b` is a backspace character, not a word boundary — so it searched for phrases wrapped
// in control codes, matched nothing, could not fail, and was reported and believed as
// working for a whole round. `wordBounded()` below now makes every probe prove it can
// match before it is trusted. A guard that cannot fail is worse than no guard: it spends
// the confidence of one without doing the work.
//
// AND ITS BOUNDARY, stated because the last version of this comment did not have one.
// The negative sweep reads two shapes: "N of the 14" (family 1, which the positive sweep
// already reaches — kept for its failure message) and the open count sitting IMMEDIATELY
// beside an openness word (family 2: "N outstanding rows", "N remain open" and near
// neighbours, which the positive sweep cannot reach and which the documents really use).
// Adjacency is deliberate. The gate-evidence document contains the true sentence "Four
// questions remain open" about something else; a windowed or sentence-scoped sweep
// reddens on it, and a sweep that cries wolf gets deleted. What still escapes both
// sweeps is a restatement in neither shape — the same fact reordered so the numeral sits
// beside nothing the sweep anchors on. That residual is real, is named in both documents'
// "Numbers in this document" blocks, and is answered by the stated convention rather than
// by more phrases.
//
// `tests/unit/gate-evidence.test.ts` is the sibling of this file and guards the
// STRUCTURE (the G8 layer table, the accessibility enumeration, the yield-point
// tripwire). This one guards the ARITHMETIC. Both read documents rather than code, which
// is the `host-cascade.test.ts` / `layout-budget.test.ts` precedent on this branch.
//
// A number that genuinely cannot be derived inside the suite is NOT guarded here — it is
// declared in the documents' own "Numbers in this document" block, and the last test
// below fails if that declaration goes missing. A reader must be able to tell which
// figures are load-bearing and which are prose.
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

const DOCS = resolve(process.cwd(), 'docs', 'superpowers', 'notes');
const MATRIX = join(DOCS, '2026-09-17-wp01-accessibility-matrix.md');
const EVIDENCE = join(DOCS, '2026-09-17-wp01-gate-evidence.md');
// Task 13's two release documents. They restate the matrix's counts, and a release
// record is the worst place for a stale one, so they are swept exactly as the other two
// are — positively at every site, and negatively against every value the count is not.
const REPORT = join(DOCS, '2026-09-17-wp01-implementation-report.md');
const LIMITATIONS = join(DOCS, '2026-09-17-wp01-limitations.md');
const FEATURE = resolve(process.cwd(), 'tests', 'acceptance', 'wp01.feature');

/** Every document that states one of these counts, each with markdown emphasis and code
 *  ticks removed, so a claim reads the same to this sweep whether or not somebody bolded
 *  it. "**13** of the matrix's **14** rows" and "13 of the 14 rows" must be the same
 *  string to a guard whose whole job is to find a stale value wherever it is written.
 *  The matrix stays FIRST: the fully-passed/half-passed breakdown is the matrix's own
 *  sentence and is read from this list's head. */
function documents(): { name: string; text: string }[] {
  return [
    { name: 'the accessibility matrix', text: readFileSync(MATRIX, 'utf8') },
    { name: 'the gate evidence document', text: readFileSync(EVIDENCE, 'utf8') },
    { name: 'the implementation report', text: readFileSync(REPORT, 'utf8') },
    { name: 'the limitations document', text: readFileSync(LIMITATIONS, 'utf8') },
  ].map(({ name, text }) => ({ name, text: text.replace(/[*`]/g, '') }));
}

const WORDS: Record<string, number> = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7,
  eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14,
  fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20,
};

function asNumber(token: string): number {
  return WORDS[token.toLowerCase()] ?? Number(token);
}

/** A word-bounded probe for one literal phrase, WHICH PROVES ITSELF LIVE BEFORE IT IS
 *  TRUSTED. Round 3 built this pattern as `` new RegExp(`\b${phrase}\b`) `` — inside a
 *  template literal `\b` is the BACKSPACE escape (U+0008), not the word-boundary
 *  metacharacter — so every probe searched for the phrase wrapped in control characters,
 *  matched nothing, and passed whatever the documents said. A guard that cannot match
 *  cannot fail, and it was reported as working for a whole round.
 *
 *  So the construction is not merely corrected: the probe must demonstrate, on a control
 *  string built from the phrase itself, that it FINDS the phrase and REFUSES it when it is
 *  glued inside a longer word. Any future escaping mistake fails here, loudly, at the
 *  first phrase, instead of going quiet. */
function wordBounded(phrase: string): RegExp {
  const literal = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const probe = new RegExp(String.raw`\b` + literal + String.raw`\b`, 'i');
  expect(probe.test(`the document says ${phrase} somewhere`),
    `the probe for "${phrase}" matches nothing at all — it cannot fail, so it is not a guard`)
    .toBe(true);
  expect(probe.test(`x${phrase}x`),
    `the probe for "${phrase}" is not word-bounded, and will report correct text as stale`)
    .toBe(false);
  return probe;
}

interface MatrixCounts { total: number; open: number; closed: number; partial: number }

/** The one source of truth for every row claim either document makes. A row is CLOSED
 *  only if its Result cell begins `**PASSED`; a row with a passed jsdom half and an
 *  unperformed manual half is OPEN, because half a row is not a gate. */
function matrixCounts(): MatrixCounts {
  const source = readFileSync(MATRIX, 'utf8');
  const start = source.indexOf('<!-- a11y:table:start -->');
  const end = source.indexOf('<!-- a11y:table:end -->');
  expect(start, 'the accessibility matrix table markers are missing').toBeGreaterThan(-1);
  const counts: MatrixCounts = { total: 0, open: 0, closed: 0, partial: 0 };
  for (const line of source.slice(start, end).split('\n')) {
    const cells = line.split('|').map((c) => c.trim());
    if (cells.length < 5) continue;
    const check = cells[1] ?? '';
    const result = cells[3] ?? '';
    if (check === 'Check' || /^-+$/.test(check)) continue;
    counts.total += 1;
    if (result.startsWith('**PASSED')) counts.closed += 1;
    else {
      counts.open += 1;
      if (result.includes('PASSED')) counts.partial += 1;
    }
  }
  return counts;
}

/** `it(` occurrences in a test file. REFUSES to count a file containing `.each(`, rather
 *  than quietly returning a number that is not the test count — `describe.each` and
 *  `it.each` multiply, and a guard that silently mis-derives is worse than no guard. */
function itCount(relativePath: string): number {
  const source = readFileSync(resolve(process.cwd(), relativePath), 'utf8');
  expect(source.includes('.each('),
    `${relativePath} uses .each(), so counting it( blocks would under-report it — this `
    + 'guard must be taught to run the file instead of reading it').toBe(false);
  return (source.match(/\bit\(/g) ?? []).length;
}

function countSourceFiles(dir: string): number {
  let total = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) total += countSourceFiles(join(dir, entry.name));
    else if (/\.(ts|vue)$/.test(entry.name) && !entry.name.endsWith('.d.ts')) total += 1;
  }
  return total;
}

describe('the evidence documents state the matrix row counts consistently, everywhere', () => {
  it('agrees with the matrix at every site that states the figure', () => {
    const { total, open } = matrixCounts();
    // The "N of the <total>" shape is RESERVED for claims about OPEN rows — the matrix's
    // own Numbers block states that convention. The first group is a number or a
    // number-word and never a bare word, so "row of the 14" is not read as a count.
    const numeral = `\\d{1,2}|${Object.keys(WORDS).join('|')}`;
    const pattern = new RegExp(`(${numeral})\\s+of\\s+(?:the\\s+)?(?:matrix's\\s+)?(\\d{1,2}|fourteen)\\b`, 'gi');
    let sites = 0;
    for (const { name, text } of documents()) {
      for (const match of text.matchAll(pattern)) {
        if (asNumber(match[2]!) !== total) continue;        // not a claim about the matrix
        sites += 1;
        expect(asNumber(match[1]!), `${name}: "${match[0]}" contradicts the matrix`).toBe(open);
      }
    }
    // The sweep must actually have found the claims — an expression that matches nothing
    // passes every assertion it never makes.
    expect(sites, 'the row-count sweep matched nothing at all').toBeGreaterThanOrEqual(2);
  });

  it('contains no stale spelling of the figure anywhere, in either document', () => {
    // THE DEVICE THAT CATCHES A SITE NOBODY ENUMERATED: search for every value the count
    // is NOT. "10 of the 14" lived seven lines below the corrected "13 of 14" for a whole
    // fix round because the guard read only the two places we already knew about.
    const { total, open } = matrixCounts();
    const wrong = Array.from({ length: total + 1 }, (_, n) => n).filter((n) => n !== open);
    for (const { name, text } of documents()) {
      const flat = text.replace(/\s+/g, ' ');
      for (const value of wrong) {
        for (const spelling of [String(value), Object.keys(WORDS).find((w) => WORDS[w] === value)]) {
          if (!spelling) continue;
          for (const phrase of [
            // FAMILY 1 — the "N of the 14" shape. Every one of these is ALSO reachable by
            // the positive sweep above, so on its own this family adds nothing; it is kept
            // because it names the wrong answer in the failure message.
            `${spelling} of the ${total}`, `${spelling} of ${total}`,
            `${spelling} of the matrix's ${total}`,
            `${spelling} of the fourteen`, `${spelling} of fourteen`,
            // FAMILY 2 — the open count stated WITHOUT the "of the total" shape, which is
            // the only part of this test the positive sweep cannot reach. The document
            // already does this once ("the thirteen outstanding rows", G4), and a
            // re-review demonstrated the gap with "…fourteen rows, ten remain open" — the
            // same fact in the same words, merely reordered, seen by neither sweep.
            // The phrases are ADJACENT, not windowed: "Four questions remain open" is a
            // true sentence in this document about something else, and a sweep that
            // reddens on it gets deleted.
            `${spelling} outstanding rows`, `${spelling} open rows`,
            `${spelling} rows remain open`, `${spelling} rows are still open`,
            `${spelling} remain open`, `${spelling} remains open`,
            `${spelling} are still open`, `${spelling} rows outstanding`,
          ]) {
            // WORD-BOUNDED, not a substring: "13 of the 14" contains "3 of the 14", so a
            // plain `toContain` would report the CORRECT text as a stale 3. A sweep that
            // cries wolf gets deleted, which is worse than one that never existed.
            const probe = wordBounded(phrase.toLowerCase());
            expect(probe.test(flat.toLowerCase()),
              `${name} states "${phrase}" — the matrix has ${open} open rows of ${total}`)
              .toBe(false);
          }
        }
      }
    }
  });

  it('states the fully-passed and half-passed breakdown as the matrix reads', () => {
    const { closed, partial } = matrixCounts();
    const matrix = documents()[0]!.text.replace(/\s+/g, ' ');
    expect(matrix, 'the matrix does not state how many rows are fully PASSED')
      .toContain(`Exactly ${closed} row is fully PASSED`);
    expect(matrix, 'the matrix does not state how many rows have a passed jsdom half')
      .toContain(`${partial} more rows have a PASSED jsdom half`);
  });
});

describe('the evidence documents state derivable test counts truthfully', () => {
  it('cites each test file with the number of tests it actually has', () => {
    // Generic, not a list of the three sites that happen to exist today: any backticked
    // test path followed closely by "(N tests)" or "(N `it` blocks)" is checked.
    const pattern = /`(tests\/[^`]+\.test\.ts)`[^.\n]{0,60}?\((\d+)\s+(?:tests|`it` blocks)[,)]/g;
    let sites = 0;
    for (const { name, text } of [
      { name: 'the accessibility matrix', text: readFileSync(MATRIX, 'utf8') },
      { name: 'the gate evidence document', text: readFileSync(EVIDENCE, 'utf8') },
    ]) {
      for (const match of text.matchAll(pattern)) {
        sites += 1;
        const [, path, stated] = match;
        expect(Number(stated), `${name} says ${path} has ${stated} tests`).toBe(itCount(path!));
      }
    }
    expect(sites, 'the per-file test-count sweep matched nothing').toBeGreaterThanOrEqual(3);
  });

  it('states the acceptance scenario counts as wp01.feature actually carries them', () => {
    const scenarios = (readFileSync(FEATURE, 'utf8').match(/^ {2}Scenario: /gm) ?? []).length;
    const evidence = readFileSync(EVIDENCE, 'utf8').replace(/\s+/g, ' ');
    expect(scenarios, 'the ported 21 plus the three §6 repairs').toBe(24);
    expect(evidence).toContain(`${scenarios} scenarios plus 2 structural guards`);
    expect(evidence).toContain(`the acceptance runner generates ${scenarios} tests from one loop`);
    expect(evidence).toContain(`all ${scenarios - 3} ported scenarios and the three repairs`);
  });

  it('states the src/ file count as a floor that is actually true', () => {
    const real = countSourceFiles(resolve(process.cwd(), 'src'));
    const match = /\((\d+)\+ files, count asserted/.exec(readFileSync(EVIDENCE, 'utf8'));
    expect(match, 'the G2 structural sweep no longer states its file floor').not.toBeNull();
    const stated = Number(match![1]);
    expect(stated, `src/ holds ${real} files; the document claims a floor of ${stated}`)
      .toBeLessThanOrEqual(real);
    // …and the floor must not drift so far below the truth that it stops meaning
    // anything. Ten files of slack, not eighty.
    expect(real - stated).toBeLessThanOrEqual(10);
  });
});

describe('the evidence documents keep their own arithmetic', () => {
  it('breaks the analyze baseline down into parts that add up', () => {
    const evidence = readFileSync(EVIDENCE, 'utf8').replace(/\s+/g, ' ');
    // Read from the emphasis-stripped text, so the assertion does not depend on where
    // the bold markers happen to sit -- the first attempt at this pinned the markdown
    // rather than the arithmetic, and produced a malformed nested-bold sentence.
    const match = /Accepted baseline at this commit: (\d+) findings — (.+?)\. The count is/
      .exec(evidence.replace(/[*`]/g, ''));
    expect(match, 'the analyze baseline is no longer stated in a checkable form').not.toBeNull();
    const parts = [...match![2]!.matchAll(/(\d+) [a-z]/g)].map((m) => Number(m[1]));
    expect(parts.length, 'the baseline breakdown lists no parts').toBeGreaterThan(2);
    expect(parts.reduce((a, b) => a + b, 0), 'the baseline breakdown does not add up')
      .toBe(Number(match![1]));
  });

  it('states a G8 passed/skipped split that adds up to its own test total', () => {
    // The G8 heading states FOUR numbers. `gate-evidence.test.ts` checks the files count
    // against disk and the tests count against the table's own sum; the passed/skipped
    // pair was checked by nothing and classified nowhere — a load-bearing-looking figure
    // in the document whose whole subject is which figures are load-bearing.
    // WHICH test is skipped is a runner fact no in-suite test can read, and is declared
    // TRANSCRIBED. The arithmetic is derivable, so it is derived here.
    const evidence = readFileSync(EVIDENCE, 'utf8').replace(/[*`]/g, '').replace(/\s+/g, ' ');
    const match = /(\d+) files, (\d+) tests, (\d+) passed, (\d+) skipped\./.exec(evidence);
    expect(match, 'the G8 heading no longer states files/tests/passed/skipped').not.toBeNull();
    const [tests, passed, skipped] = [Number(match![2]), Number(match![3]), Number(match![4])];
    expect(passed + skipped, `${passed} passed + ${skipped} skipped is not ${tests} tests`)
      .toBe(tests);
  });

  it('states the contract suite as twenty obligations, which is what it has', () => {
    // "the same twenty-obligation suite against BOTH the fake and the real port" is a
    // number written as a word, in prose, in G2. It is derivable: the contract file's own
    // `it(` blocks, and the contracts LAYER must be exactly twice them because one suite
    // runs against two implementations. Found by reading the document end to end rather
    // than by a finding — which is the whole point of this round.
    const obligations = itCount('tests/contracts/source-filesystem-port.contract.ts');
    const evidence = readFileSync(EVIDENCE, 'utf8').replace(/\s+/g, ' ');
    const word = Object.keys(WORDS).find((w) => WORDS[w] === obligations);
    expect(word, `no word for ${obligations} obligations`).toBeDefined();
    expect(evidence, `the contract suite has ${obligations} obligations`)
      .toContain(`${word}-obligation suite`);
    const table = /\| Contract \| `tests\/contracts\/\*\*` \| \d+ \| yes \| (\d+) \|/.exec(readFileSync(EVIDENCE, 'utf8'));
    expect(table, 'the G8 contract row is no longer parseable').not.toBeNull();
    expect(Number(table![1]), 'one suite, two implementations').toBe(obligations * 2);
  });

  it('sweeps the RELEASE documents too, and each one gives the sweep something to bite', () => {
    // Task 13 adds two documents that restate the matrix's counts — the implementation
    // report and the limitations document — and a release record is the worst possible
    // place for the stale count this file exists to prevent. They are swept exactly as
    // the other two are, which is only worth anything if each document actually states
    // the figure in a shape the sweep reads: a file the sweep cannot find a claim in is
    // a file the sweep is not guarding, and it would pass in silence.
    const { total, open } = matrixCounts();
    const names = documents().map((d) => d.name);
    expect(names).toContain('the implementation report');
    expect(names).toContain('the limitations document');
    for (const { name, text } of documents()) {
      const sites = [...text.replace(/\s+/g, ' ')
        .matchAll(new RegExp(`(\\d{1,2})\\s+of\\s+(?:the\\s+)?(?:matrix's\\s+)?${total}\\b`, 'g'))];
      expect(sites.length, `${name} states the open-row count nowhere the sweep can read it`)
        .toBeGreaterThanOrEqual(1);
      for (const site of sites) expect(Number(site[1]), `${name}: "${site[0]}"`).toBe(open);
    }
  });

  it('declares, in both documents, which of its numbers are NOT derived', () => {
    // The counterpart to everything above: a reader must be able to tell a load-bearing
    // figure from prose without reading this test file.
    for (const { name, text } of documents()) {
      expect(text, `${name} has no "Numbers in this document" declaration`)
        .toContain('Numbers in this document');
      expect(text, `${name} does not say which numbers are machine-checked`)
        .toContain('tests/unit/evidence-numbers.test.ts');
    }
  });
});
