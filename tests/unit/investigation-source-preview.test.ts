import { describe, expect, it } from 'vitest';
import { createSourcePreview } from '../../src/application/investigation/source-preview';
import type { PreviewRequest, PreviewResult } from '../../src/application/investigation/source-preview';
import { createFakeSourceFileSystem } from '../fixtures/fake-source-filesystem';
import type { FakeTree } from '../fixtures/fake-source-filesystem';
import { createFixedClock } from '../fixtures/clock';

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

  it('cuts a 450-character line to 400 code points and marks it cut', async () => {
    const result = await readWith({ 'a.ts': 'x'.repeat(450) }, 'a.ts', null);
    if (result.status !== 'ok') throw new Error('expected ok');
    expect(result.text.lines).toHaveLength(1);
    expect(Array.from(result.text.lines[0]!.text)).toHaveLength(400);
    expect(result.text.lines[0]!.cut).toBe(true);
  });

  it('shows C0 and bidi controls as \\uXXXX text, and keeps the tab', async () => {
    const result = await readWith({ 'a.ts': '\u0001‮\t' }, 'a.ts', null);
    if (result.status !== 'ok') throw new Error('expected ok');
    expect(result.text.lines[0]!.text).toBe('\\u0001\\u202E\t');
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

  it('a path escaping the root is outside-root', async () => {
    const result = await readWith({ 'a.ts': 'x' }, '../x', null);
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

  it('a directory is not-a-file', async () => {
    const result = await readWith({ 'dir/a.ts': 'x' }, 'dir', null);
    expect(result).toEqual({ status: 'unavailable', reason: 'not-a-file' });
  });
});

describe('createSourcePreview — no source write', () => {
  it('readLog() holds only stat and read paths under /fake-root', async () => {
    const { preview, port, root } = makePreview({ 'a.ts': HUNDRED_LINES });
    await preview.read(requestFor('a.ts', 50));
    const log = port.readLog();
    expect(log.length).toBeGreaterThan(0);
    for (const entry of log) {
      expect(entry.startsWith(root)).toBe(true);
    }
  });
});
