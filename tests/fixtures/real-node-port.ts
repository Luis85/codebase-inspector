// Shared one-liner for every integration test that needs the REAL Node adapter: inject
// real `node:fs/promises` and `node:path` (ruling M17 part 2) rather than going through
// node-access.ts, whose window/Platform guard is never touched under Vitest.
import * as fsPromises from 'node:fs/promises';
import * as path from 'node:path';
import { createNodeSourceFileSystem } from '../../src/adapters/filesystem/node-source-filesystem';
import type { SourceFileSystemPort } from '../../src/application/ports/source-filesystem-port';

export function createRealNodePort(): SourceFileSystemPort {
  return createNodeSourceFileSystem({ fsPromises, path });
}
