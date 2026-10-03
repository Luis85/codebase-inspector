// Real temporary directories (spec 6): content the walker must give up on — binary,
// oversized, unreadable — split out of walker.test.ts to keep that file under the
// tests/** 450-line limit (task-5-context.md section 6).
import { afterEach, describe, expect, it } from 'vitest';
import { createRealNodePort } from '../fixtures/real-node-port';
import { createCancellationToken } from '../fixtures/cancellation-token';
import { makeTempTree } from '../fixtures/temp-tree';
import type { TempTree } from '../fixtures/temp-tree';
import type { WalkEntry, WalkOptions } from '../../src/application/ports/source-filesystem-port';

async function walkAll(root: string, opts: WalkOptions): Promise<WalkEntry[]> {
  const port = createRealNodePort();
  const { token } = createCancellationToken();
  const out: WalkEntry[] = [];
  for await (const entry of port.walk(root, opts, token)) out.push(entry);
  return out;
}

const trees: TempTree[] = [];
afterEach(async () => {
  await Promise.all(trees.splice(0).map((t) => t.cleanup()));
});

describe('real temporary trees: content the walker cannot use', () => {
  it('reports binary content as unavailable with a reason, never 0 lines', async () => {
    const tree = await makeTempTree({
      'bin/data.bin': { binary: new Uint8Array([0x00, 0x01, 0x02, 0x03, 0x00, 0xff]) },
    });
    trees.push(tree);
    const entries = await walkAll(tree.root, { exclusions: [], maxFileBytes: 1_000_000, followSymlinks: false });
    const found = entries.find((e) => e.relativePath === 'bin/data.bin');
    expect(found).toBeDefined();
    expect(found!.kind).toBe('skipped');
    expect((found as Extract<WalkEntry, { kind: 'skipped' }>).reason).toMatch(/binary/i);
    // No WalkEntry variant that could carry a numeric "0" exists for this entry at all —
    // the 'skipped' shape has no byteSize field, so "0 lines" cannot be smuggled through.
    expect('byteSize' in found!).toBe(false);
  });

  it('reports an oversized file as unavailable with a reason', async () => {
    const tree = await makeTempTree({ 'big.ts': 'x'.repeat(10_000) });
    trees.push(tree);
    const entries = await walkAll(tree.root, { exclusions: [], maxFileBytes: 100, followSymlinks: false });
    const found = entries.find((e) => e.relativePath === 'big.ts');
    expect(found).toBeDefined();
    expect(found!.kind).toBe('skipped');
    expect((found as Extract<WalkEntry, { kind: 'skipped' }>).reason).toMatch(/maximum file size/i);
  });

  it('reports an unreadable file as unavailable with a reason', async () => {
    const tree = await makeTempTree({ 'locked.ts': { unreadable: 'export const secret = 1;\n' } });
    trees.push(tree);
    const entries = await walkAll(tree.root, { exclusions: [], maxFileBytes: 1_000_000, followSymlinks: false });
    const found = entries.find((e) => e.relativePath === 'locked.ts');
    expect(found).toBeDefined();
    expect(found!.kind).toBe('skipped');
    expect((found as Extract<WalkEntry, { kind: 'skipped' }>).reason).toMatch(/unreadable/i);
  });
});
