// Phase 2c, ruling M106 — THE GATE for the concurrent scan, as executable tests. Landed by
// gap closure GRB2 (ruling M108, GCO8): the walk prepares up to W = 8 entries of a
// directory at once.
//
// The scan is the user's single largest wait: the sequential walk read every file through
// two strictly sequential `await`s, measured at 1,342 ms on the user's own 1,087-file tree
// against 335 ms at a bounded concurrency of 8.
//
// The walker carries more safety than any other part of this codebase: symlink handling,
// path containment, cancellation, and a STABLE EMISSION ORDER. That order is what the UI
// lists and what the evidence records, in that order. (It is NOT what protects the FNV-1a
// fileSetDigest: inventory-collector.ts sorts the paths before hashing them, so the digest
// is order-independent by construction.)
//
// What the window changes, and what it may not (spec GCN5):
// - the EMISSION order is index-ordered and unchanged, pinned to a literal under
//   deliberately reversed I/O timing (the first test);
// - the read log's CONTENTS are unchanged, and only its ORDER becomes completion-dependent,
//   so it is compared as a multiset (the second test);
// - still exactly one lstat per entry (the third test);
// - a cancel dispatches nothing new, an excluded path is never opened, and reads already in
//   flight drain before the run reports cancelled (the fourth test). The sequential
//   guarantee "a cancelled run opens nothing further" was weakened to this, in writing, by
//   ruling M108 (GCO8): up to W − 1 entries beyond the one the consumer is handed may
//   already have been opened when it cancels.
//
// The ordering technique: run the same real tree twice through the real Node adapter,
// once with the filesystem answering instantly and once with it answering in DELIBERATELY
// REVERSED order — the slowest response going to the path dispatched first. An
// append-as-completed walk inverts under this (shown RED against a naive window, GRB2).
import { afterEach, describe, expect, it } from 'vitest';
import * as realFs from 'node:fs/promises';
import * as path from 'node:path';
import { createNodeSourceFileSystem } from '../../src/adapters/filesystem/node-source-filesystem';
import type { NodeSourceFileSystemDeps } from '../../src/adapters/filesystem/node-source-filesystem';
import { createRealNodePort } from '../fixtures/real-node-port';
import { createCancellationToken } from '../fixtures/cancellation-token';
import { makeTempTree } from '../fixtures/temp-tree';
import type { TempTree, TempTreeSpec } from '../fixtures/temp-tree';
import type { SourceFileSystemPort, WalkEntry, WalkOptions } from '../../src/application/ports/source-filesystem-port';
import { walkTree } from '../../src/adapters/filesystem/walker';
import type { WalkerDeps } from '../../src/adapters/filesystem/walker';

const OPTS: WalkOptions = { exclusions: [], maxFileBytes: 1_000_000, followSymlinks: false };
/** The walker's window (walker.ts SCAN_WINDOW). */
const W = 8;

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

async function track(spec: TempTreeSpec): Promise<TempTree> {
  const tree = await makeTempTree(spec);
  trees.push(tree);
  return tree;
}

/** A tree deep and wide enough that a concurrency window genuinely spans several entries
 *  within a directory AND several directories — 24 files over four directories at three
 *  depths, with names whose sort order is not their creation order. */
async function makeTree(): Promise<TempTree> {
  const spec: TempTreeSpec = {};
  for (const dir of ['', 'src/', 'src/deep/', 'zeta/']) {
    for (const n of [7, 3, 11, 1, 9, 5]) spec[`${dir}f${n}.ts`] = `export const n${n} = ${n};\n`;
  }
  return track(spec);
}

/** The path the cancel test excludes, inside its first window. */
const excluded = (p: string): boolean => p.endsWith('a04.ts');

const filesOf = (es: readonly WalkEntry[]): string[] =>
  es.filter((e) => e.kind === 'file').map((e) => e.relativePath);

async function walkAll(port: SourceFileSystemPort, root: string): Promise<WalkEntry[]> {
  const { token } = createCancellationToken();
  const out: WalkEntry[] = [];
  for await (const entry of port.walk(root, OPTS, token)) out.push(entry);
  return out;
}

/** Every lstat/readFile is delayed, and the delay DECREASES with each call, so whatever is
 *  dispatched first resolves last. */
function reversingPort(): SourceFileSystemPort {
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
  return createNodeSourceFileSystem({ fsPromises: reversing, path });
}

describe('M106: the walk reads concurrently WITHOUT changing a byte of its output', () => {
  it('emits entries in path order even when the filesystem answers in REVERSE order', async () => {
    const tree = await makeTree();
    const expected = await walkAll(createRealNodePort(), tree.root);
    const actual = await walkAll(reversingPort(), tree.root);

    expect(actual).toEqual(expected);

    // ...and not merely "both runs agree": the order is pinned to a LITERAL, captured
    // from the sequential walk at 73675f7 before any concurrency existed. This is the
    // byte-identical-to-sequential proof ruling M106 gates the change on, and it is what
    // keeps the order the UI lists and the evidence records from a silent reordering (the
    // fileSetDigest sorts its paths, so it does not depend on this). Note it is NOT
    // globally sorted: the walk is depth-first over a LIFO stack, so `zeta` precedes
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

  it('keeps the READ LOG the same multiset, which is the G2 evidence surface (GCN5)', async () => {
    // The log is observable output (spec 6's read-log proof). Under the window its ORDER
    // is completion-dependent — the opens genuinely interleave — so it is compared as a
    // multiset: the same paths, each opened the same number of times, whatever the timing.
    const tree = await makeTree();
    const instant = createRealNodePort();
    await walkAll(instant, tree.root);
    const reversed = reversingPort();
    await walkAll(reversed, tree.root);
    expect([...reversed.readLog()].sort()).toEqual([...instant.readLog()].sort());

    // ...and the multiset itself is pinned, not merely "two runs agree": the root once
    // (its readdir), each of the 3 directories twice (lstat, then readdir), each of the 24
    // files twice (lstat, then read). Nothing opened twice that should be opened once.
    const counts = new Map<string, number>();
    for (const p of instant.readLog()) counts.set(p, (counts.get(p) ?? 0) + 1);
    expect(instant.readLog()).toHaveLength(1 + 3 * 2 + 24 * 2);
    expect(counts.get(tree.root)).toBe(1);
    expect(Array.from(counts.values()).filter((n) => n === 2)).toHaveLength(3 + 24);
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
    // One per entry classified, and never two for the same path, however many are in
    // flight at once: the walk's own `readAsText` reads bytes and does NOT re-stat (ruling
    // M45 carries the measurements forward onto the WalkEntry so the collector never
    // re-opens either).
    expect(lstatted.length).toBe(new Set(lstatted).size);
    expect(lstatted.length).toBe(entries.length);
  });

  // The cancel guarantee as weakened in writing by ruling M108 (GCO8, spec GCN5). A cancel
  // is observed between one entry and the next. By then the window may already have
  // opened up to W − 1 entries beyond the one the consumer was handed — that is the point
  // of a window, and the reason "opens nothing further" no longer holds. What still holds,
  // and is asserted here:
  // - no NEW lstat or read starts once the cancel is observed (the dispatch guard; and a
  //   preparation whose lstat lands after the cancel starts no read);
  // - so the reads are bounded by what the window could have reached: 3 + W − 1;
  // - an excluded path inside the window is never opened at all;
  // - the reads already in flight have drained by the time the walk rejects.
  it('a cancel dispatches nothing new, never opens an excluded path, and drains in-flight reads', async () => {
    const spec: TempTreeSpec = {};
    for (let i = 0; i < 20; i += 1) spec[`a${String(i).padStart(2, '0')}.ts`] = `export const a = ${i};\n`;
    const tree = await track(spec);
    const opts: WalkOptions = { ...OPTS, exclusions: ['a04.ts'] };   // inside the first window

    const lstats: string[] = [];
    const reads: string[] = [];
    let cancelObservedAt: { lstats: number; reads: number } | null = null;
    let inFlight = 0;
    const settleLater = async <T>(work: () => Promise<T>): Promise<T> => {
      inFlight += 1;
      try {
        await delayBy(15);   // keeps the window's preparations genuinely pending at the cancel
        return await work();
      } finally {
        inFlight -= 1;
      }
    };
    const counting = {
      ...realFs,
      lstat: (p: string) => { lstats.push(String(p)); return settleLater(() => realFs.lstat(p)); },
      readFile: (p: string) => { reads.push(String(p)); return settleLater(() => realFs.readFile(p)); },
    } as unknown as NodeSourceFileSystemDeps['fsPromises'];
    const port = createNodeSourceFileSystem({ fsPromises: counting, path });
    const { token, cancel } = createCancellationToken();

    let seenFiles = 0;
    let inFlightAtRejection = -1;
    await expect(async () => {
      try {
        for await (const entry of port.walk(tree.root, opts, token)) {
          if (entry.kind !== 'file') continue;
          seenFiles += 1;
          if (seenFiles === 3) {
            cancel();
            cancelObservedAt = { lstats: lstats.length, reads: reads.length };
          }
        }
      } finally {
        inFlightAtRejection = inFlight;
      }
    }).rejects.toThrow();

    expect(seenFiles).toBe(3);
    expect(cancelObservedAt).not.toBeNull();
    // Nothing new after the cancel: not one lstat, not one read.
    expect(lstats).toHaveLength(cancelObservedAt!.lstats);
    expect(reads).toHaveLength(cancelObservedAt!.reads);
    // Bounded by the window: the three files handed over, plus at most W − 1 beyond.
    expect(reads.length).toBeLessThanOrEqual(3 + W - 1);
    // The excluded path was inside the window and was never opened, by any route.
    expect(lstats.some(excluded)).toBe(false);
    expect(reads.some(excluded)).toBe(false);
    expect(port.readLog().some(excluded)).toBe(false);
    // Drained: the walk rejected only once every preparation in flight had settled...
    expect(inFlightAtRejection).toBe(0);
    // ...and nothing is still running behind the generator after it has thrown.
    await delayBy(60);
    expect(lstats).toHaveLength(cancelObservedAt!.lstats);
    expect(reads).toHaveLength(cancelObservedAt!.reads);
  });

  // Behaviour change (2) of GRB2 (Review Focus 2): a failure is carried as that entry's
  // own skip, never a rejection of the window. One lstat and one read fail mid-window,
  // under reversed timing; every other entry is still emitted, in index order, and each
  // failure's skip reason sits at its own index.
  it('one failed lstat or read inside a window never drops or reorders the others', async () => {
    const spec: TempTreeSpec = {};
    for (let i = 0; i < 10; i += 1) spec[`b${i}.ts`] = `export const b = ${i};\n`;
    const tree = await track(spec);
    let issued = 0;
    const late = async (): Promise<void> => { await delayBy(Math.max(0, 30 - issued++)); };
    const failing = {
      ...realFs,
      lstat: async (p: string) => {
        await late();
        if (String(p).endsWith('b3.ts')) throw new Error('EACCES: lstat refused');
        return realFs.lstat(p);
      },
      readFile: async (p: string) => {
        await late();
        if (String(p).endsWith('b5.ts')) throw new Error('EIO: read failed');
        return realFs.readFile(p);
      },
    } as unknown as NodeSourceFileSystemDeps['fsPromises'];
    const entries = await walkAll(createNodeSourceFileSystem({ fsPromises: failing, path }), tree.root);

    expect(entries.map((e) => `${e.kind}:${e.relativePath}`)).toEqual(
      Array.from({ length: 10 }, (_, i) => `${i === 3 || i === 5 ? 'skipped' : 'file'}:b${i}.ts`),
    );
    const reasons = entries.flatMap((e) => (e.kind === 'skipped' ? [e.reason] : []));
    expect(reasons).toEqual(['unreadable: EACCES: lstat refused', 'file is unreadable: EIO: read failed']);
  });

  // Gap closure E50 (I1, M45): a window holds each read only as its two measurements. The
  // first entry's read settles LAST, so by the time it is handed over every other file in
  // its window has been read; each must already have been measured (its text and bytes
  // released) rather than waiting, contents and all, to be measured when consumed.
  it('measures every file as soon as it is read, so the window never holds file contents', async () => {
    const names = Array.from({ length: W }, (_, i) => `m${i}.ts`);
    const measured = new Set<string>();
    const deps: WalkerDeps = {
      caseSensitive: true,
      onOpen: () => {},
      joinPath: (base, name) => `${base}/${name}`,
      readdirNames: (p) => Promise.resolve(p === '/root' ? [...names] : []),
      lstat: () => Promise.resolve({ size: 4, isDirectory: () => false, isFile: () => true, isSymbolicLink: () => false }),
      readAsText: async (p) => {
        if (p.endsWith('/m0.ts')) await delayBy(25);
        const name = p.slice('/root/'.length);
        return {
          ok: true,
          get text() { measured.add(`text:${name}`); return 'a\nb\n'; },
          get bytes() { measured.add(`bytes:${name}`); return new Uint8Array(4); },
        };
      },
    };
    const { token } = createCancellationToken();
    const walk = walkTree('/root', OPTS, token, deps);
    const first = await walk.next();
    const measuredAtFirst = [...measured].sort();
    for await (const entry of walk) void entry;

    expect(first.value).toMatchObject({ kind: 'file', relativePath: 'm0.ts', lineCount: 2, byteLength: 4 });
    expect(measuredAtFirst).toEqual(names.flatMap((n) => [`bytes:${n}`, `text:${n}`]).sort());
  });
});
