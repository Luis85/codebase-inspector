// Phase 2c, ruling M106 — THE GATE for making the scan concurrent, as executable tests.
//
// The scan is the user's single largest wait: the walk reads every file through two
// strictly sequential `await`s, measured at 1,342 ms on the user's own 1,087-file tree
// against 335 ms at a bounded concurrency of 8 — a 4.0x cut, where the whole post-scan
// build is ~65–80 ms. The user is perceiving SCAN time as build time.
//
// M106 gates that change on two proofs, because the walker carries more safety than any
// other part of this codebase: symlink handling, path containment, cancellation, and a
// STABLE TRAVERSAL ORDER that the FNV-1a fileSetDigest depends on (ruling M58) — a
// reordering silently changes a hash that decides whether a rescan is needed, and a
// rescan that does not happen is invisible.
//
// THE CONCURRENCY IS NOT LANDED. It was implemented and then reverted by plain copy,
// because the SECOND proof fails and cannot be made to pass at any window size — see
// "a cancel stops the reading DEAD" below. The FIRST proof holds, and these tests are it.
//
// They are landed anyway, and are worth more than the change would have been. Three of
// them pin properties nothing else in the suite asserts — the exact sequential emission
// order as a literal, read-log identity, and one lstat per entry — and the fourth states
// the precise obstacle in the form a future attempt has to satisfy. A gate that exists
// before the change is what this branch has repeatedly wished it had.
//
// The ordering technique: run the same real tree twice through the real Node adapter,
// once with the filesystem answering instantly and once with it answering in DELIBERATELY
// REVERSED order — the slowest response going to the path dispatched first. Today both
// runs are sequential so they agree trivially; under a windowed walk this is the
// assertion that would catch an append-as-completed implementation.
import { afterEach, describe, expect, it } from 'vitest';
import * as realFs from 'node:fs/promises';
import * as path from 'node:path';
import { createNodeSourceFileSystem } from '../../src/adapters/filesystem/node-source-filesystem';
import type { NodeSourceFileSystemDeps } from '../../src/adapters/filesystem/node-source-filesystem';
import { createRealNodePort } from '../fixtures/real-node-port';
import { createCancellationToken } from '../fixtures/cancellation-token';
import { makeTempTree } from '../fixtures/temp-tree';
import type { TempTree } from '../fixtures/temp-tree';
import type { SourceFileSystemPort, WalkEntry, WalkOptions } from '../../src/application/ports/source-filesystem-port';

const OPTS: WalkOptions = { exclusions: [], maxFileBytes: 1_000_000, followSymlinks: false };

// Bound once, as a plain value, exactly as src/adapters/filesystem/walker.ts does and for
// the same reason: this file runs under Vitest's 'node' project, which has no DOM at all,
// so `window.setTimeout` does not exist here. obsidianmd/prefer-window-timers matches a
// CALL to the identifier `setTimeout`, not a read of it, so aliasing sidesteps the rule on
// its own terms -- nothing is disabled, weakened or overridden.
const delayBy = (ms: number): Promise<void> =>
  new Promise((resolve) => { scheduleTimeout(resolve, ms); });
const scheduleTimeout = setTimeout;

const trees: TempTree[] = [];
afterEach(async () => {
  for (const tree of trees.splice(0, trees.length)) await tree.cleanup();
});

/** A tree deep and wide enough that a concurrency window genuinely spans several entries
 *  within a directory AND several directories — 24 files over four directories at three
 *  depths, with names whose sort order is not their creation order. */
async function makeTree(): Promise<TempTree> {
  const spec: Record<string, string> = {};
  for (const dir of ['', 'src/', 'src/deep/', 'zeta/']) {
    for (const n of [7, 3, 11, 1, 9, 5]) spec[`${dir}f${n}.ts`] = `export const n${n} = ${n};\n`;
  }
  const tree = await makeTempTree(spec);
  trees.push(tree);
  return tree;
}

const filesOf = (es: readonly WalkEntry[]): string[] =>
  es.filter((e) => e.kind === 'file').map((e) => e.relativePath);

async function walkAll(port: SourceFileSystemPort, root: string): Promise<WalkEntry[]> {
  const { token } = createCancellationToken();
  const out: WalkEntry[] = [];
  for await (const entry of port.walk(root, OPTS, token)) out.push(entry);
  return out;
}

describe('M106: the walk reads concurrently WITHOUT changing a byte of its output', () => {
  it('emits entries in path order even when the filesystem answers in REVERSE order', async () => {
    const tree = await makeTree();
    const instant = createRealNodePort();
    const expected = await walkAll(instant, tree.root);

    // Adversarial timing: every lstat/readFile is delayed, and the delay DECREASES with
    // each call, so whatever is dispatched first resolves last. An append-as-completed
    // walk inverts under this; an index-preserving one cannot notice it at all.
    let issued = 0;
    const reversing = {
      ...realFs,
      lstat: async (p: string) => {
        const waitMs = Math.max(0, 40 - issued++);
        await delayBy(waitMs);
        return realFs.lstat(p);
      },
      readFile: async (p: string) => {
        const waitMs = Math.max(0, 40 - issued++);
        await delayBy(waitMs);
        return realFs.readFile(p);
      },
    } as unknown as NodeSourceFileSystemDeps['fsPromises'];
    const shuffled = createNodeSourceFileSystem({ fsPromises: reversing, path });
    const actual = await walkAll(shuffled, tree.root);

    expect(actual).toEqual(expected);

    // ...and not merely "both runs agree": the order is pinned to a LITERAL, captured
    // from the sequential walk at 73675f7 before any concurrency existed. This is the
    // byte-identical-to-sequential proof ruling M106 gates the change on, and it is what
    // protects the FNV-1a fileSetDigest (ruling M58) from a silent reordering. Note it is
    // NOT globally sorted: the walk is depth-first over a LIFO stack, so `zeta` precedes
    // `src` and `src/deep` follows `src` — sorted WITHIN each directory, which is exactly
    // what `names.sort()` plus the stack gives.
    const SEQUENTIAL_ORDER = [
      'f1.ts', 'f11.ts', 'f3.ts', 'f5.ts', 'f7.ts', 'f9.ts',
      'zeta/f1.ts', 'zeta/f11.ts', 'zeta/f3.ts', 'zeta/f5.ts', 'zeta/f7.ts', 'zeta/f9.ts',
      'src/f1.ts', 'src/f11.ts', 'src/f3.ts', 'src/f5.ts', 'src/f7.ts', 'src/f9.ts',
      'src/deep/f1.ts', 'src/deep/f11.ts', 'src/deep/f3.ts', 'src/deep/f5.ts',
      'src/deep/f7.ts', 'src/deep/f9.ts',
    ];
    expect(filesOf(expected)).toEqual(SEQUENTIAL_ORDER);
    expect(filesOf(actual)).toEqual(SEQUENTIAL_ORDER);
  });

  it('keeps the READ LOG identical too, which is the G2 evidence surface', async () => {
    // The log is observable output (spec 6's read-log proof), so "identical output" has
    // to include it. It is also the thing a naive concurrency change breaks first,
    // because the opens genuinely do interleave.
    const tree = await makeTree();
    const a = createRealNodePort();
    await walkAll(a, tree.root);
    const b = createRealNodePort();
    await walkAll(b, tree.root);
    expect(b.readLog()).toEqual(a.readLog());
    expect(a.readLog().length).toBeGreaterThan(24);
  });

  it('performs exactly ONE lstat per entry — no duplicated stat on the read path', async () => {
    const tree = await makeTree();
    const lstatted: string[] = [];
    const counting = {
      ...realFs,
      lstat: (p: string) => { lstatted.push(String(p)); return realFs.lstat(p); },
    } as unknown as NodeSourceFileSystemDeps['fsPromises'];
    const port = createNodeSourceFileSystem({ fsPromises: counting, path });
    const entries = await walkAll(port, tree.root);

    const files = entries.filter((e) => e.kind === 'file');
    expect(files.length).toBe(24);
    // One per entry classified, and never two for the same path: the walk's own
    // `readAsText` reads bytes and does NOT re-stat (ruling M45 already carried the
    // measurements forward onto the WalkEntry so the collector never re-opens either).
    expect(lstatted.length).toBe(new Set(lstatted).size);
    expect(lstatted.length).toBe(entries.length);
  });

  // THE OBSTACLE, stated as an assertion rather than as prose. This is the property a
  // concurrent walk cannot keep, and the reason the change is not landed.
  //
  // A cancel is noticed between one entry and the next, so a SEQUENTIAL walk reads
  // exactly zero further files after it. A walk with a dispatch window of N has already
  // issued up to N-1 further reads by the time the consumer sees its first entry and
  // cancels — so up to N-1 files are OPENED that the sequential walk would never have
  // touched, and they land in the read log, which is the G2 evidence surface for "only
  // the approved scope was read". No window size avoids it: the point of a window is to
  // dispatch before knowing.
  //
  // tests/unit/inventory-collector.test.ts already pins the tight version of this
  // ("stops reading further files when cancelled during the walk", ruling M41 / fix wave
  // item 7, added specifically to distinguish "the walk HALTED" from "the walk ran to
  // completion and the result was discarded"). A window of 8 over its 4-file fixture
  // reads all four and takes its read log from 3 entries to 9. Relaxing that bound to
  // accommodate a window would be loosening a test to make a fix pass.
  it('a cancel stops the reading DEAD: not one further file is opened', async () => {
    const tree = await makeTree();
    const reads: string[] = [];
    const counting = {
      ...realFs,
      readFile: (p: string) => { reads.push(String(p)); return realFs.readFile(p); },
    } as unknown as NodeSourceFileSystemDeps['fsPromises'];
    const port = createNodeSourceFileSystem({ fsPromises: counting, path });
    const { token, cancel } = createCancellationToken();

    let seenFiles = 0;
    await expect(async () => {
      for await (const entry of port.walk(tree.root, OPTS, token)) {
        if (entry.kind !== 'file') continue;
        seenFiles += 1;
        if (seenFiles === 3) cancel();
      }
    }).rejects.toThrow();

    // Exactly the three files the consumer actually received, and nothing beyond them.
    expect(seenFiles).toBe(3);
    expect(reads).toHaveLength(3);
    // ...and nothing is still running behind the generator after it has thrown.
    await delayBy(60);
    expect(reads).toHaveLength(3);
  });
});
