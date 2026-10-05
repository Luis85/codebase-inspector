// Gap closure GRB17b (GCQ9, closes Part A E17): an lstat that fails for any reason other than
// "nothing is there" (ENOENT, ENOTDIR) is reported as unreadable, with its code — never as
// missing. Driven through the REAL Node adapter with an injected fs whose lstat/readdir fail
// with chosen codes, then through the preview and the scan coordinator that consume it.
import { posix } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createNodeSourceFileSystem } from '../../src/adapters/filesystem/node-source-filesystem';
import { createSourcePreview } from '../../src/application/investigation/source-preview';
import { ScanCoordinator } from '../../src/application/scan-coordinator';
import { approve } from '../../src/application/approval';
import { InMemorySnapshotStore } from '../../src/adapters/storage/in-memory-snapshot-store';
import { createFixedClock } from '../fixtures/clock';
import { createCancellationToken } from '../fixtures/cancellation-token';
import type { NodeFsPromisesLike, NodeStatsLike } from '../../src/adapters/filesystem/node-globals';
import type { ScanLifecycleState } from '../../src/application/run-state';
import type { AnalysisScope } from '../../src/domain/model';

/** 'dir', a file's text, or the code its lstat fails with. */
type StubNode = 'dir' | { text: string } | { lstatError: string };

function errno(code: string, syscall: string, path: string): Error {
  return Object.assign(new Error(`${code}: ${syscall} '${path}'`), { code });
}

function statsOf(node: 'dir' | { text: string }): NodeStatsLike {
  const isDir = node === 'dir';
  return {
    size: isDir ? 0 : new TextEncoder().encode(node.text).length, mtimeMs: 1,
    isDirectory: () => isDir, isFile: () => !isDir, isSymbolicLink: () => false,
  };
}

/** A posix-path fs stub. A path not in `tree` fails ENOENT; `readdirErrors` names a directory
 *  whose listing fails with that code even though its lstat succeeds. */
function stubFs(tree: Readonly<Record<string, StubNode>>, readdirErrors: Readonly<Record<string, string>> = {}): NodeFsPromisesLike {
  const lookup = (path: string, syscall: string): 'dir' | { text: string } => {
    const node = tree[path];
    if (node === undefined) throw errno('ENOENT', syscall, path);
    if (typeof node === 'object' && 'lstatError' in node) throw errno(node.lstatError, syscall, path);
    return node;
  };
  const readdir = async (path: string): Promise<string[]> => {
    const code = readdirErrors[path];
    if (code !== undefined) throw errno(code, 'scandir', path);
    if (lookup(path, 'scandir') !== 'dir') throw errno('ENOTDIR', 'scandir', path);
    return Object.keys(tree).filter((p) => p !== path && posix.dirname(p) === path).map((p) => posix.basename(p));
  };
  return {
    readdir: readdir as NodeFsPromisesLike['readdir'],
    lstat: async (path) => statsOf(lookup(path, 'lstat')),
    stat: async (path) => statsOf(lookup(path, 'stat')),
    readFile: async (path) => {
      const node = lookup(path, 'open');
      if (node === 'dir') throw errno('EISDIR', 'read', path);
      return new TextEncoder().encode(node.text);
    },
    realpath: async (path) => path,
    open: async (path) => { throw errno('EPERM', 'open', path); },
  };
}

const portOver = (tree: Readonly<Record<string, StubNode>>, readdirErrors: Readonly<Record<string, string>> = {}) =>
  createNodeSourceFileSystem({ fsPromises: stubFs(tree, readdirErrors), path: posix });

describe('stat() on a path lstat cannot read (GRB17b)', () => {
  it('EACCES is exists: true with unreadable EACCES, and neither a folder nor a file', async () => {
    const port = portOver({ '/r': { lstatError: 'EACCES' } });
    expect(await port.stat('/r')).toEqual({
      exists: true, unreadable: 'EACCES', isDirectory: false, isFile: false, isSymbolicLink: false, size: 0, mtimeMs: 0,
    });
  });

  it('any other code is unreadable too, carrying that code', async () => {
    const port = portOver({ '/r': { lstatError: 'EPERM' }, '/s': { lstatError: 'EBUSY' } });
    expect((await port.stat('/r')).unreadable).toBe('EPERM');
    expect((await port.stat('/s')).unreadable).toBe('EBUSY');
  });

  it('control: ENOENT and ENOTDIR stay exists: false, with no unreadable code', async () => {
    const port = portOver({ '/r': { lstatError: 'ENOTDIR' } });
    for (const path of ['/gone', '/r']) {
      const stat = await port.stat(path);
      expect(stat.exists).toBe(false);
      expect('unreadable' in stat).toBe(false);
    }
  });
});

function previewOver(tree: Readonly<Record<string, StubNode>>) {
  const port = portOver(tree);
  return createSourcePreview({
    getFilesystem: () => port, resolveRoot: () => Promise.resolve('/r'), clock: createFixedClock(), caseSensitive: true,
  });
}
const request = (relativePath: string) => ({ codebaseId: 'p', expectedRoot: '/r', relativePath, maxFileBytes: 10_000, line: 1 });

describe('the preview of an unreadable path (GRB17b)', () => {
  it('reports read-error, not missing, for a file whose lstat fails EACCES', async () => {
    const preview = previewOver({ '/r': 'dir', '/r/a.ts': { lstatError: 'EACCES' } });
    expect(await preview.read(request('a.ts'))).toEqual({ status: 'unavailable', reason: 'read-error' });
  });

  it('reports read-error for a file under an ancestor whose lstat fails EACCES', async () => {
    const preview = previewOver({ '/r': 'dir', '/r/src': { lstatError: 'EACCES' }, '/r/src/a.ts': { text: 'x\n' } });
    expect(await preview.read(request('src/a.ts'))).toEqual({ status: 'unavailable', reason: 'read-error' });
  });

  it('control: a file that is not there is still missing, and a readable one reads', async () => {
    const preview = previewOver({ '/r': 'dir', '/r/b.ts': { text: 'x\n' } });
    expect(await preview.read(request('a.ts'))).toEqual({ status: 'unavailable', reason: 'missing' });
    expect((await preview.read(request('b.ts'))).status).toBe('ok');
  });
});

describe('a scan whose root cannot be read (GCQ9)', () => {
  const clock = createFixedClock();
  const scope: AnalysisScope = { rootPath: '/r', exclusions: [], maxFileBytes: 10_000, followSymlinks: false };

  async function scanOver(tree: Readonly<Record<string, StubNode>>, readdirErrors: Readonly<Record<string, string>> = {}): Promise<ScanLifecycleState> {
    const coordinator = new ScanCoordinator({
      port: portOver(tree, readdirErrors), store: new InMemorySnapshotStore(clock), clock, createCancellationToken,
    });
    const seen: ScanLifecycleState[] = [];
    coordinator.subscribe((s) => { seen.push(s); });
    await coordinator.start(approve('p', scope.rootPath, scope, clock), scope);
    return seen[seen.length - 1]!;
  }

  it('an unreadable root stat fails as root-unavailable, naming the code', async () => {
    const last = await scanOver({ '/r': { lstatError: 'EACCES' } });
    expect(last.run.status).toBe('failed');
    expect(last.rootUnavailable).toBe(true);
    expect(last.banner).toBe('Scan failed: The source directory is no longer available: /r (EACCES)');
  });

  it('a root whose listing throws fails as root-unavailable, naming the code — never a plain scan failure', async () => {
    const last = await scanOver({ '/r': 'dir', '/r/a.ts': { text: 'x\n' } }, { '/r': 'EACCES' });
    expect(last.run.status).toBe('failed');
    expect(last.rootUnavailable).toBe(true);
    expect(last.banner).toBe('Scan failed: The source directory is no longer available: /r (EACCES)');
  });

  it('control: a missing root keeps the message without a code, and a readable root completes', async () => {
    const missing = await scanOver({});
    expect(missing.rootUnavailable).toBe(true);
    expect(missing.banner).toBe('Scan failed: The source directory is no longer available: /r');
    const readable = await scanOver({ '/r': 'dir', '/r/a.ts': { text: 'x\n' } });
    expect(readable.run.status).toBe('complete');
    expect(readable.rootUnavailable).toBe(false);
  });
});
