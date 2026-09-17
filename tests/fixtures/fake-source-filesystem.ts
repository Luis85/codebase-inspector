// An in-memory SourceFileSystemPort, for the contract suite (tests/contracts/
// fake-filesystem.test.ts) and for tests/unit/inventory-collector.test.ts. Drives the
// SAME walkTree() generator the real Node adapter uses (src/adapters/filesystem/
// walker.ts) — only the low-level WalkerDeps (readdir/lstat/readFile-equivalent) differ
// — so the contract suite is testing one shared algorithm against two different
// dependency implementations, not two independently-written walks that could quietly
// diverge (task-5-context.md section 5, ruling M17's reasoning applied one layer down).
import { walkTree } from '../../src/adapters/filesystem/walker';
import type { WalkerDeps, WalkerStats } from '../../src/adapters/filesystem/walker';
import type {
  SourceFileSystemPort, WalkEntry, WalkOptions, ReadResult, StatResult,
} from '../../src/application/ports/source-filesystem-port';
import type { CancellationToken } from '../../src/application/ports/cancellation-token';

export type FakeEntry =
  | string                                    // a regular text file's content
  | { readonly binary: true }                 // content that must be classified binary
  | { readonly oversizedBytes: number }       // a file reporting this many bytes, content irrelevant
  | { readonly unreadable: true }             // a file that throws when read
  | { readonly symlinkTo: string };           // a symlink (never followed) to another key

export type FakeTree = Record<string, FakeEntry>;

interface FakeDirNode { kind: 'dir'; children: Map<string, FakeNode> }
interface FakeFileNode { kind: 'file'; entry: FakeEntry }
type FakeNode = FakeDirNode | FakeFileNode;

function buildTree(spec: FakeTree): FakeDirNode {
  const root: FakeDirNode = { kind: 'dir', children: new Map() };
  for (const [relPath, entry] of Object.entries(spec)) {
    const segs = relPath.split('/');
    let dir = root;
    for (let i = 0; i < segs.length - 1; i += 1) {
      const seg = segs[i]!;
      let next = dir.children.get(seg);
      if (!next) { next = { kind: 'dir', children: new Map() }; dir.children.set(seg, next); }
      if (next.kind !== 'dir') throw new Error(`fixture conflict: ${seg} is both a file and a directory`);
      dir = next;
    }
    dir.children.set(segs[segs.length - 1]!, { kind: 'file', entry });
  }
  return root;
}

function resolveNode(root: FakeDirNode, absPath: string, fakeRoot: string): FakeNode | undefined {
  if (absPath === fakeRoot) return root;
  const rel = absPath.slice(fakeRoot.length + 1);
  const segs = rel.split('/');
  let node: FakeNode = root;
  for (const seg of segs) {
    if (node.kind !== 'dir') return undefined;
    const next = node.children.get(seg);
    if (!next) return undefined;
    node = next;
  }
  return node;
}

function fakeStats(node: FakeNode | undefined): WalkerStats | null {
  if (!node) return null;
  if (node.kind === 'dir') {
    return { size: 0, isDirectory: () => true, isFile: () => false, isSymbolicLink: () => false };
  }
  const { entry } = node;
  if (typeof entry === 'object' && 'symlinkTo' in entry) {
    return { size: 0, isDirectory: () => false, isFile: () => false, isSymbolicLink: () => true };
  }
  const size = typeof entry === 'string'
    ? entry.length
    : 'oversizedBytes' in entry ? entry.oversizedBytes : 0;
  return { size, isDirectory: () => false, isFile: () => true, isSymbolicLink: () => false };
}

function classify(entry: FakeEntry): { ok: true; text: string; bytes: Uint8Array } | { ok: false; reason: string } {
  if (typeof entry === 'string') return { ok: true, text: entry, bytes: new TextEncoder().encode(entry) };
  if ('binary' in entry) return { ok: false, reason: 'file appears to contain binary content' };
  if ('unreadable' in entry) return { ok: false, reason: 'file is unreadable: permission denied (fake)' };
  if ('oversizedBytes' in entry) {
    const text = 'x'.repeat(Math.min(entry.oversizedBytes, 16));
    return { ok: true, text, bytes: new TextEncoder().encode(text) };
  }
  return { ok: false, reason: 'symlink: not followed (followSymlinks is false)' };
}

/** Matches tests/contracts/source-filesystem-port.contract.ts's `make` signature:
 *  `() => Promise<{ port: SourceFileSystemPort; root: string }>`. */
export function createFakeSourceFileSystem(spec: FakeTree): { port: SourceFileSystemPort; root: string } {
  const root = '/fake-root';
  const tree = buildTree(spec);
  const log: string[] = [];

  const walkerDeps: WalkerDeps = {
    caseSensitive: true,
    onOpen: (absPath) => log.push(absPath),
    joinPath: (base, name) => `${base}/${name}`,
    readdirNames(absPath) {
      const node = resolveNode(tree, absPath, root);
      if (!node || node.kind !== 'dir') return Promise.reject(new Error(`ENOENT: ${absPath}`));
      return Promise.resolve([...node.children.keys()]);
    },
    lstat(absPath) {
      const stats = fakeStats(resolveNode(tree, absPath, root));
      if (!stats) return Promise.reject(new Error(`ENOENT: ${absPath}`));
      return Promise.resolve(stats);
    },
    readAsText(absPath) {
      // Fix-round-1 IMPORTANT finding 4: this must log too, matching
      // node-source-filesystem.ts's real readAsText (which logs via readRawText) — a
      // content read IS an open, and the shared contract suite's read-log tests must
      // see the SAME logging behaviour from both implementations, or "one shared suite
      // proves the fake and the real adapter cannot drift" would not actually hold for
      // the read-log mechanism itself. Proved this mattered: with this line and
      // walker.ts's per-entry onOpen both temporarily removed, the OLD read-log
      // assertion (`p.endsWith('a.ts') || p.includes('src')`) still passed while
      // 'src/a.ts' itself was genuinely never logged — reverted before committing.
      log.push(absPath);
      const node = resolveNode(tree, absPath, root);
      if (!node || node.kind !== 'file') return Promise.reject(new Error(`ENOENT: ${absPath}`));
      return Promise.resolve(classify(node.entry));
    },
  };

  async function readText(absPath: string, maxBytes: number): Promise<ReadResult> {
    log.push(absPath);
    const node = resolveNode(tree, absPath, root);
    if (!node || node.kind !== 'file') return { status: 'unavailable', reason: 'file is unreadable: not found (fake)' };
    const stats = fakeStats(node)!;
    if (stats.size > maxBytes) {
      return { status: 'unavailable', reason: `file exceeds the maximum size of ${maxBytes} bytes` };
    }
    const outcome = classify(node.entry);
    return outcome.ok
      ? { status: 'ok', text: outcome.text, bytes: outcome.bytes }
      : { status: 'unavailable', reason: outcome.reason };
  }

  async function stat(absPath: string): Promise<StatResult> {
    log.push(absPath);
    const stats = fakeStats(resolveNode(tree, absPath, root));
    if (!stats) return { exists: false, isDirectory: false, isFile: false, isSymbolicLink: false, size: 0, mtimeMs: 0 };
    return {
      exists: true, isDirectory: stats.isDirectory(), isFile: stats.isFile(),
      isSymbolicLink: stats.isSymbolicLink(), size: stats.size, mtimeMs: 0,
    };
  }

  const port: SourceFileSystemPort = {
    walk(walkRoot: string, opts: WalkOptions, token: CancellationToken): AsyncIterable<WalkEntry> {
      return walkTree(walkRoot, opts, token, walkerDeps);
    },
    readText,
    stat,
    readLog: () => [...log],
  };

  return { port, root };
}
