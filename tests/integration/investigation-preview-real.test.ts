// Real temporary directories (spec 6): the source preview over the REAL Node adapter, so
// IP15's classification of `readText`'s unavailable reason is pinned against the adapter's
// own message strings, not a guess at what they might say — and the symlinked-ancestor case
// (not expressible in the in-memory fake, tests/unit/investigation-source-preview.test.ts)
// gets a real Windows junction.
import { afterEach, describe, expect, it } from 'vitest';
import { join } from 'node:path';
import { createSourcePreview } from '../../src/application/investigation/source-preview';
import type { PreviewRequest } from '../../src/application/investigation/source-preview';
import { createRealNodePort } from '../fixtures/real-node-port';
import { makeTempTree, hashTree } from '../fixtures/temp-tree';
import type { TempTree } from '../fixtures/temp-tree';
import { createFixedClock } from '../fixtures/clock';

const trees: TempTree[] = [];
afterEach(async () => {
  await Promise.all(trees.splice(0).map((t) => t.cleanup()));
});

function makePreview(root: string) {
  const port = createRealNodePort();
  return createSourcePreview({ getFilesystem: () => port, resolveRoot: () => Promise.resolve(root), clock: createFixedClock() });
}

function requestFor(root: string, relativePath: string, line: number | null = null): PreviewRequest {
  return { codebaseId: 'cb1', expectedRoot: root, relativePath, maxFileBytes: 10_000_000, line };
}

describe('createSourcePreview over the real Node adapter', () => {
  it('reads a UTF-8 file with a multi-byte character, real mtimeMs and size', async () => {
    const content = 'const héllo = 1;\n// ünïcödé\n';
    const tree = await makeTempTree({ 'src/a.ts': content });
    trees.push(tree);
    const preview = makePreview(tree.root);
    const result = await preview.read(requestFor(tree.root, 'src/a.ts'));
    if (result.status !== 'ok') throw new Error(`expected ok, got ${result.status}`);
    expect(result.text.size).toBe(new TextEncoder().encode(content).length);
    expect(result.text.mtimeMs).toBeGreaterThan(0);
    expect(result.text.lines.map((l) => l.text)).toEqual(['const héllo = 1;', '// ünïcödé']);
  });

  it('classifies invalid UTF-8 bytes (no NUL) as not-utf8', async () => {
    const tree = await makeTempTree({ 'a.ts': { binary: new Uint8Array([0x41, 0xC3, 0x28]) } });
    trees.push(tree);
    const preview = makePreview(tree.root);
    const result = await preview.read(requestFor(tree.root, 'a.ts'));
    expect(result).toEqual({ status: 'unavailable', reason: 'not-utf8' });
  });

  it('classifies bytes holding a NUL as binary', async () => {
    const tree = await makeTempTree({ 'a.ts': { binary: new Uint8Array([0x00, 0x41]) } });
    trees.push(tree);
    const preview = makePreview(tree.root);
    const result = await preview.read(requestFor(tree.root, 'a.ts'));
    expect(result).toEqual({ status: 'unavailable', reason: 'binary' });
  });

  // Fix round 1, review coverage 6g: the real adapter's own "file exceeds the maximum size"
  // wording, asserted directly against `readText` — the exact prefix source-preview.ts's
  // `classify()` matches (IP15), not a guess.
  it('the real adapter\'s readText names an oversized file with "file exceeds the maximum size"', async () => {
    const tree = await makeTempTree({ 'a.ts': 'x'.repeat(100) });
    trees.push(tree);
    const port = createRealNodePort();
    const result = await port.readText(join(tree.root, 'a.ts'), 10);
    expect(result.status).toBe('unavailable');
    if (result.status !== 'unavailable') throw new Error('expected unavailable');
    expect(result.reason.startsWith('file exceeds the maximum size')).toBe(true);
  });

  it('a symlinked ancestor (junction) is outside-root', async () => {
    const tree = await makeTempTree({ 'real/a.ts': 'export const a = 1;\n', link: { symlinkTo: 'real' } });
    trees.push(tree);
    const preview = makePreview(tree.root);
    const result = await preview.read(requestFor(tree.root, 'link/a.ts'));
    expect(result).toEqual({ status: 'unavailable', reason: 'outside-root' });
  });

  it('never writes: hashTree(root) is identical before and after five reads', async () => {
    const tree = await makeTempTree({
      'real/a.ts': 'export const a = 1;\n',
      link: { symlinkTo: 'real' },
      'binary.ts': { binary: new Uint8Array([0x00, 0x41]) },
    });
    trees.push(tree);
    const preview = makePreview(tree.root);
    const before = await hashTree(tree.root);
    await preview.read(requestFor(tree.root, 'real/a.ts'));
    await preview.read(requestFor(tree.root, 'real/a.ts', 1));
    await preview.read(requestFor(tree.root, 'link/a.ts'));
    await preview.read(requestFor(tree.root, 'binary.ts'));
    await preview.read(requestFor(tree.root, 'missing.ts'));
    const after = await hashTree(tree.root);
    expect(after).toEqual(before);
  });
});
