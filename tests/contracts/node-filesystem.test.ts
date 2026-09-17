// Exercises the REAL Node adapter (src/adapters/filesystem/node-source-filesystem.ts)
// against a real temporary filesystem tree, injecting `node:fs/promises` and `node:path`
// directly (ruling M17 part 2) — this file's own no-nodejs-modules is OFF under
// tests/**, and node-access.ts's `window`/`Platform` guard is never touched here at all.
import { afterEach } from 'vitest';
import * as fsPromises from 'node:fs/promises';
import * as path from 'node:path';
import { runContractSuite } from './source-filesystem-port.contract';
import { createNodeSourceFileSystem } from '../../src/adapters/filesystem/node-source-filesystem';
import { makeTempTree } from '../fixtures/temp-tree';
import type { TempTreeSpec } from '../fixtures/temp-tree';

const FIXTURE: TempTreeSpec = {
  'src/a.ts': 'export const a = 1;\n',
  'excluded/secret.txt': 'top secret',
  'oversized.ts': 'x'.repeat(500),
  'binary.dat': { binary: new Uint8Array([0x00, 0x01, 0x02, 0xff, 0x00]) },
  'unreadable.ts': { unreadable: 'secret content' },
  linked: { symlinkTo: 'src' },
};

const cleanups: Array<() => Promise<void>> = [];

afterEach(async () => {
  await Promise.all(cleanups.splice(0).map((cleanup) => cleanup()));
});

runContractSuite('node (real filesystem)', async () => {
  const tree = await makeTempTree(FIXTURE);
  cleanups.push(() => tree.cleanup());
  // node:fs/promises' real readdir/lstat/readFile carry more overloads than
  // NodeFsPromisesLike needs — structurally compatible, no cast required.
  const port = createNodeSourceFileSystem({ fsPromises, path });
  return { port, root: tree.root };
});
