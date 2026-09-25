import { describe, expect, it } from 'vitest';
import { createSourcePreview } from '../../src/application/investigation/source-preview';
import type { PreviewRequest, PreviewResult } from '../../src/application/investigation/source-preview';
import { createFakeSourceFileSystem } from '../fixtures/fake-source-filesystem';
import type { FakeTree } from '../fixtures/fake-source-filesystem';
import { createFixedClock } from '../fixtures/clock';
import type { SourceFileSystemPort, WalkEntry, WalkOptions, StatResult } from '../../src/application/ports/source-filesystem-port';
import type { CancellationToken } from '../../src/application/ports/cancellation-token';

const HUNDRED_LINES = Array.from({ length: 100 }, (_, i) => `l${i + 1}`).join('\n');

function makePreview(tree: FakeTree) {
  const { port, root } = createFakeSourceFileSystem(tree);
  const clock = createFixedClock('2026-09-25T12:00:00.000Z');
  const preview = createSourcePreview({
    getFilesystem: () => port,
    resolveRoot: () => Promise.resolve(root),
    clock,
  });
  return { preview, port, root, clock };
}

function requestFor(relativePath: string, line: number | null, overrides: Partial<PreviewRequest> = {}): PreviewRequest {
  return {
    codebaseId: 'cb1', expectedRoot: '/fake-root', relativePath,
    maxFileBytes: 10_000_000, line, ...overrides,
  };
}

async function readWith(tree: FakeTree, relativePath: string, line: number | null, overrides: Partial<PreviewRequest> = {}): Promise<PreviewResult> {
  const { preview } = makePreview(tree);
  return preview.read(requestFor(relativePath, line, overrides));
}

describe('createSourcePreview — the window (IN8, IP16)', () => {
  const tree: FakeTree = { 'a.ts': HUNDRED_LINES };

  it('centres 20 lines either side, lineCount 100, readAt the clock time', async () => {
    const { preview } = makePreview(tree);
    const result = await preview.read(requestFor('a.ts', 50));
    if (result.status !== 'ok') throw new Error('expected ok');
    expect(result.text.lineCount).toBe(100);
    expect(result.text.lines).toHaveLength(41);
    expect(result.text.lines[0]).toEqual({ number: 30, text: 'l30', cut: false });
    expect(result.text.lines.at(-1)).toEqual({ number: 70, text: 'l70', cut: false });
    expect(result.text.readAt).toBe('2026-09-25T12:00:00.000Z');
  });

  it('clips at the start edge instead of shifting to fill 41', async () => {
    const result = await readWith(tree, 'a.ts', 3);
    if (result.status !== 'ok') throw new Error('expected ok');
    expect(result.text.lines).toHaveLength(23);
    expect(result.text.lines[0]!.number).toBe(1);
    expect(result.text.lines.at(-1)!.number).toBe(23);
  });

  it('shows the first 41 lines for no line', async () => {
    const result = await readWith(tree, 'a.ts', null);
    if (result.status !== 'ok') throw new Error('expected ok');
    expect(result.text.lines).toHaveLength(41);
    expect(result.text.lines[0]!.number).toBe(1);
    expect(result.text.lines.at(-1)!.number).toBe(41);
  });

  it('shows the last 41 lines for a line past the end', async () => {
    const result = await readWith(tree, 'a.ts', 500);
    if (result.status !== 'ok') throw new Error('expected ok');
    expect(result.text.lines).toHaveLength(41);
    expect(result.text.lines[0]!.number).toBe(60);
    expect(result.text.lines.at(-1)!.number).toBe(100);
  });

  // Fix round 1, review minor 5: a non-positive line is not "past the end" — it names no
  // real line at all, same as `null`.
  it('shows the first 41 lines for a non-positive line', async () => {
    const zero = await readWith(tree, 'a.ts', 0);
    const negative = await readWith(tree, 'a.ts', -5);
    if (zero.status !== 'ok' || negative.status !== 'ok') throw new Error('expected ok');
    expect(zero.text.lines[0]!.number).toBe(1);
    expect(zero.text.lines.at(-1)!.number).toBe(41);
    expect(negative.text.lines).toEqual(zero.text.lines);
  });

  it('cuts a 450-character line to 400 code points and marks it cut', async () => {
    const result = await readWith({ 'a.ts': 'x'.repeat(450) }, 'a.ts', null);
    if (result.status !== 'ok') throw new Error('expected ok');
    expect(result.text.lines).toHaveLength(1);
    expect(Array.from(result.text.lines[0]!.text)).toHaveLength(400);
    expect(result.text.lines[0]!.cut).toBe(true);
  });

  // Fix round 1, review coverage 6a: an astral character is TWO UTF-16 code units but ONE
  // code point — cutting on code points (not `.slice`) must never chop a surrogate pair.
  it('cuts 450 astral characters to 400 code points, not 400 UTF-16 units', async () => {
    const astral = String.fromCodePoint(0x1F600).repeat(450);
    const result = await readWith({ 'a.ts': astral }, 'a.ts', null);
    if (result.status !== 'ok') throw new Error('expected ok');
    const kept = result.text.lines[0]!.text;
    expect(Array.from(kept)).toHaveLength(400);
    expect(kept.length).toBe(800); // 400 code points * 2 UTF-16 units each, no lone surrogate
    expect(result.text.lines[0]!.cut).toBe(true);
  });

  it('shows C0 and bidi controls as \\uXXXX text, and keeps the tab', async () => {
    const line = `${String.fromCharCode(0x01)}${String.fromCharCode(0x202E)}\t`;
    const result = await readWith({ 'a.ts': line }, 'a.ts', null);
    if (result.status !== 'ok') throw new Error('expected ok');
    expect(result.text.lines[0]!.text).toBe('\\u0001\\u202E\t');
  });

  // Fix round 1, review coverage 6b: a lone CR (not part of a CRLF pair) is not a line
  // separator — it stays as literal content and is itself a C0 control, so it is escaped.
  it('shows a lone CR as \\u000D rather than treating it as a line break', async () => {
    const result = await readWith({ 'a.ts': 'a\rb\nc' }, 'a.ts', null);
    if (result.status !== 'ok') throw new Error('expected ok');
    expect(result.text.lineCount).toBe(2);
    expect(result.text.lines).toEqual([
      { number: 1, text: 'a\\u000Db', cut: false },
      { number: 2, text: 'c', cut: false },
    ]);
  });

  // Fix round 1, review coverage 6c: a trailing CRLF drops exactly the ONE trailing line
  // ending, matching countPhysicalLines — never a stray final empty line, never a stray CR.
  it('drops exactly one trailing CRLF, matching lineCount', async () => {
    const result = await readWith({ 'a.ts': 'a\r\nb\r\n' }, 'a.ts', null);
    if (result.status !== 'ok') throw new Error('expected ok');
    expect(result.text.lineCount).toBe(2);
    expect(result.text.lines).toEqual([
      { number: 1, text: 'a', cut: false },
      { number: 2, text: 'b', cut: false },
    ]);
  });

  it('CRLF and LF endings give the same lines and lineCount', async () => {
    const crlf = await readWith({ 'a.ts': 'a\r\nb\nc' }, 'a.ts', null);
    const lf = await readWith({ 'a.ts': 'a\nb\nc' }, 'a.ts', null);
    if (crlf.status !== 'ok' || lf.status !== 'ok') throw new Error('expected ok');
    expect(crlf.text.lineCount).toBe(3);
    expect(crlf.text.lines).toEqual(lf.text.lines);
    expect(crlf.text.lines).toEqual([
      { number: 1, text: 'a', cut: false },
      { number: 2, text: 'b', cut: false },
      { number: 3, text: 'c', cut: false },
    ]);
  });
});

describe('createSourcePreview — unavailable states (IN9)', () => {
  it('no filesystem adapter (defensive) is no-filesystem', async () => {
    const clock = createFixedClock();
    const preview = createSourcePreview({ getFilesystem: () => null, resolveRoot: () => Promise.resolve('/fake-root'), clock });
    const result = await preview.read(requestFor('a.ts', null));
    expect(result).toEqual({ status: 'unavailable', reason: 'no-filesystem' });
  });

  it('an unresolved binding is no-binding', async () => {
    const { port } = createFakeSourceFileSystem({ 'a.ts': 'x' });
    const clock = createFixedClock();
    const preview = createSourcePreview({ getFilesystem: () => port, resolveRoot: () => Promise.resolve(null), clock });
    const result = await preview.read(requestFor('a.ts', null));
    expect(result).toEqual({ status: 'unavailable', reason: 'no-binding' });
  });

  it('a root reconnected to another folder is no-binding', async () => {
    const { port } = createFakeSourceFileSystem({ 'a.ts': 'x' });
    const clock = createFixedClock();
    const preview = createSourcePreview({ getFilesystem: () => port, resolveRoot: () => Promise.resolve('/fake-root'), clock });
    const result = await preview.read(requestFor('a.ts', null, { expectedRoot: '/other-root' }));
    expect(result).toEqual({ status: 'unavailable', reason: 'no-binding' });
  });

  // Fix round 1, review minor 7: resolveRoot's own promise can reject (a store lookup that
  // throws); that must resolve read() to no-binding, never reject read()'s own promise.
  it('a rejected resolveRoot is no-binding, not a thrown/rejected read()', async () => {
    const { port } = createFakeSourceFileSystem({ 'a.ts': 'x' });
    const clock = createFixedClock();
    const preview = createSourcePreview({
      getFilesystem: () => port,
      resolveRoot: () => Promise.reject(new Error('profile store unavailable')),
      clock,
    });
    await expect(preview.read(requestFor('a.ts', null))).resolves.toEqual({ status: 'unavailable', reason: 'no-binding' });
  });

  it('a path escaping the root is outside-root', async () => {
    const result = await readWith({ 'a.ts': 'x' }, '../x', null);
    expect(result).toEqual({ status: 'unavailable', reason: 'outside-root' });
  });

  // Fix round 1, review coverage 6f: every shape of an absolute or escaping path is rejected
  // by normalizeRelativePath before anything is stat'd, whatever OS wrote the request.
  it.each([
    ['/etc/x'],
    ['C:/x'],
    ['C:\\x'],
    ['src\\..\\..\\x'],
    ['\\\\srv\\s\\x'],
  ])('%s is outside-root', async (relativePath) => {
    const result = await readWith({ 'a.ts': 'x' }, relativePath, null);
    expect(result).toEqual({ status: 'unavailable', reason: 'outside-root' });
  });

  it('a symlinked file is outside-root', async () => {
    const result = await readWith({ real: 'x', link: { symlinkTo: 'real' } }, 'link', null);
    expect(result).toEqual({ status: 'unavailable', reason: 'outside-root' });
  });

  it('binary content is binary', async () => {
    const result = await readWith({ 'a.ts': { binary: true } }, 'a.ts', null);
    expect(result).toEqual({ status: 'unavailable', reason: 'binary' });
  });

  it('an oversized file is too-large under the 512 KiB cap even with a generous maxFileBytes', async () => {
    const result = await readWith({ 'a.ts': { oversizedBytes: 600_000 } }, 'a.ts', null, { maxFileBytes: 10_000_000 });
    expect(result).toEqual({ status: 'unavailable', reason: 'too-large' });
  });

  it('an unreadable file is read-error', async () => {
    const result = await readWith({ 'a.ts': { unreadable: true } }, 'a.ts', null);
    expect(result).toEqual({ status: 'unavailable', reason: 'read-error' });
  });

  it('a missing path is missing', async () => {
    const result = await readWith({ 'a.ts': 'x' }, 'missing.ts', null);
    expect(result).toEqual({ status: 'unavailable', reason: 'missing' });
  });

  // Fix round 1, review coverage 6e: a missing PARENT (never mind the file) is also `missing`.
  it('a missing parent folder is missing', async () => {
    const result = await readWith({ 'a.ts': 'x' }, 'nope/a.ts', null);
    expect(result).toEqual({ status: 'unavailable', reason: 'missing' });
  });

  it('a directory is not-a-file', async () => {
    const result = await readWith({ 'dir/a.ts': 'x' }, 'dir', null);
    expect(result).toEqual({ status: 'unavailable', reason: 'not-a-file' });
  });
});

// Fix round 1, review minor 3: `caseSensitive` is deps-level, so `sameRoot`'s comparison
// (and the containment check that follows it) can be told to match the host's actual
// platform, never hard-coded to case-insensitive.
describe('createSourcePreview — case sensitivity (fix round 1, review minor 3)', () => {
  it('a differently-cased root matches by default (case-insensitive)', async () => {
    const { port } = createFakeSourceFileSystem({ 'a.ts': 'x' });
    const clock = createFixedClock();
    const preview = createSourcePreview({ getFilesystem: () => port, resolveRoot: () => Promise.resolve('/fake-root'), clock });
    const result = await preview.read(requestFor('a.ts', null, { expectedRoot: '/FAKE-ROOT' }));
    expect(result.status).toBe('ok');
  });

  it('a differently-cased root is no-binding when caseSensitive is true', async () => {
    const { port } = createFakeSourceFileSystem({ 'a.ts': 'x' });
    const clock = createFixedClock();
    const preview = createSourcePreview({
      getFilesystem: () => port, resolveRoot: () => Promise.resolve('/fake-root'), clock, caseSensitive: true,
    });
    const result = await preview.read(requestFor('a.ts', null, { expectedRoot: '/FAKE-ROOT' }));
    expect(result).toEqual({ status: 'unavailable', reason: 'no-binding' });
  });
});

// oxlint consistent-function-scoping: hoisted — it captures nothing from noEntries().
async function* emptyWalkGenerator(): AsyncGenerator<WalkEntry> { /* never yields */ }

function noEntries(): AsyncIterable<WalkEntry> {
  return { [Symbol.asyncIterator]: () => emptyWalkGenerator() };
}

/** A port whose `stat()` answers change on each successive call — the only way to exercise
 *  a race between the pre-read and post-read stat (fix round 1, review minor 2); the shared
 *  fake filesystem always answers the same way, so it cannot express this. */
function racingPort(content: string, stats: readonly StatResult[]): SourceFileSystemPort {
  let call = 0;
  const bytes = new TextEncoder().encode(content);
  return {
    walk(_root: string, _opts: WalkOptions, _token: CancellationToken): AsyncIterable<WalkEntry> {
      return noEntries();
    },
    readText: () => Promise.resolve({ status: 'ok' as const, text: content, bytes }),
    stat(): Promise<StatResult> {
      const answer = stats[Math.min(call, stats.length - 1)]!;
      call += 1;
      return Promise.resolve(answer);
    },
    readLog: () => [],
  };
}

const FILE_STAT = { exists: true, isDirectory: false, isFile: true, isSymbolicLink: false };

describe('createSourcePreview — the stat→read race (fix round 1, review minor 2)', () => {
  it('retries once when size/mtime changed after the read, and reports the POST-read mtime', async () => {
    const stats: StatResult[] = [
      { ...FILE_STAT, size: 5, mtimeMs: 1000 },
      { ...FILE_STAT, size: 6, mtimeMs: 2000 },
      { ...FILE_STAT, size: 6, mtimeMs: 2000 },
    ];
    const port = racingPort('hello', stats);
    const preview = createSourcePreview({ getFilesystem: () => port, resolveRoot: () => Promise.resolve('/fake-root'), clock: createFixedClock() });
    const result = await preview.read(requestFor('a.ts', null));
    if (result.status !== 'ok') throw new Error(`expected ok, got ${result.status}`);
    expect(result.text.mtimeMs).toBe(2000);
  });

  it('a file that became a link after the read is outside-root, not an exact-looking result', async () => {
    const stats: StatResult[] = [
      { ...FILE_STAT, size: 5, mtimeMs: 1000 },
      { exists: true, isDirectory: false, isFile: false, isSymbolicLink: true, size: 5, mtimeMs: 1000 },
    ];
    const port = racingPort('hello', stats);
    const preview = createSourcePreview({ getFilesystem: () => port, resolveRoot: () => Promise.resolve('/fake-root'), clock: createFixedClock() });
    const result = await preview.read(requestFor('a.ts', null));
    expect(result).toEqual({ status: 'unavailable', reason: 'outside-root' });
  });
});

describe('createSourcePreview — no source write', () => {
  it('readLog() holds only stat and read paths under /fake-root', async () => {
    const { preview, port, root } = makePreview({ 'a.ts': HUNDRED_LINES });
    await preview.read(requestFor('a.ts', 50));
    const log = port.readLog();
    expect(log.length).toBeGreaterThan(0);
    for (const entry of log) {
      expect(entry.startsWith(`${root}/`)).toBe(true);
    }
  });
});
