// Direct evidence for how the bounded walk bounds itself (depth, entry count), how
// promptly cancellation interrupts it, and how a genuine failure (spec 7's "a failed
// run") propagates — none of the brief's required scenarios exercise the first two
// directly (the defaults, 128 and 200,000, are far beyond anything a required fixture
// needs) or the third at all, so this file exists purely to prove these mechanisms work,
// using small overrides and hand-rolled deps against the fake port and walkTree itself.
import { describe, expect, it } from 'vitest';
import { createFakeSourceFileSystem } from '../fixtures/fake-source-filesystem';
import type { FakeTree } from '../fixtures/fake-source-filesystem';
import { createCancellationToken } from '../fixtures/cancellation-token';
import { walkTree } from '../../src/adapters/filesystem/walker';
import type { WalkerDeps } from '../../src/adapters/filesystem/walker';
import type { WalkEntry, WalkOptions } from '../../src/application/ports/source-filesystem-port';

async function collect(port: ReturnType<typeof createFakeSourceFileSystem>['port'],
  root: string, opts: WalkOptions): Promise<WalkEntry[]> {
  const { token } = createCancellationToken();
  const out: WalkEntry[] = [];
  for await (const entry of port.walk(root, opts, token)) out.push(entry);
  return out;
}

describe('bounded walk: depth and entry-count limits', () => {
  it('stops descending once maxDepth is exceeded, reporting why', async () => {
    const tree: FakeTree = { 'a/b/c/d/e/leaf.ts': 'x\n' };
    const { port, root } = createFakeSourceFileSystem(tree);
    const entries = await collect(port, root, {
      exclusions: [], maxFileBytes: 1000, followSymlinks: false, maxDepth: 2,
    });
    // 'a' (depth 1) and 'a/b' (depth 2) are found as real 'directory' entries; 'a/b/c'
    // is where maxDepth=2 refuses to descend FURTHER, so nothing UNDER it (its own
    // children) is ever discovered. Fix-round-1 finding 7: 'a/b/c' itself is reported
    // ONLY as a single 'skipped' entry (wasDirectory: true), not ALSO as a 'directory'
    // entry for the very same relativePath — the walker used to yield both, back to
    // back, which the collector then turned into a directory mislabelled as a file.
    expect(entries.some((e) => e.kind === 'directory' && e.relativePath === 'a')).toBe(true);
    expect(entries.some((e) => e.kind === 'directory' && e.relativePath === 'a/b')).toBe(true);
    expect(entries.some((e) => e.relativePath === 'a/b/c' && e.kind === 'directory')).toBe(false);
    const depthSkip = entries.find(
      (e): e is Extract<WalkEntry, { kind: 'skipped' }> => e.kind === 'skipped' && e.relativePath === 'a/b/c',
    );
    expect(depthSkip).toBeDefined();
    expect(depthSkip!.reason).toMatch(/maximum depth/i);
    expect(depthSkip!.wasDirectory).toBe(true);
    // Exactly one entry for 'a/b/c' in total — no duplicate.
    expect(entries.filter((e) => e.relativePath === 'a/b/c')).toHaveLength(1);
    expect(entries.some((e) => e.relativePath.startsWith('a/b/c/'))).toBe(false);
  });

  // Fix-round-1 finding 7's second required case: an unreadable DIRECTORY (its own
  // readdir failing, distinct from the maxDepth case above — this directory IS within
  // depth, it just cannot be listed once reached).
  it('marks an unreadable directory\'s skip as wasDirectory, distinct from a skipped file', async () => {
    const { token } = createCancellationToken();
    const listings: Record<string, string[]> = { '/root': ['locked', 'kept.ts'] };
    const deps: WalkerDeps = {
      caseSensitive: true,
      onOpen: () => {},
      joinPath: (base, name) => `${base}/${name}`,
      readdirNames: (absPath) => {
        if (absPath === '/root/locked') return Promise.reject(new Error('EACCES'));
        return Promise.resolve(listings[absPath] ?? []);
      },
      lstat: (absPath) => Promise.resolve({
        size: 10,
        isDirectory: () => absPath === '/root/locked',
        isFile: () => absPath === '/root/kept.ts',
        isSymbolicLink: () => false,
      }),
      readAsText: () => Promise.resolve({ ok: true, text: 'x\n', bytes: new TextEncoder().encode('x\n') }),
    };
    const opts: WalkOptions = { exclusions: [], maxFileBytes: 1000, followSymlinks: false };
    const entries: WalkEntry[] = [];
    for await (const entry of walkTree('/root', opts, token, deps)) entries.push(entry);

    // 'locked' legitimately appears twice, for two DIFFERENT facts discovered at two
    // different times: once as a real 'directory' entry (it was successfully lstat'd as
    // a directory when discovered), and once as a 'skipped' entry (its OWN contents
    // could not later be enumerated) — this is not the same duplicate the maxDepth case
    // had, since the second fact was not yet known when the first was yielded.
    const directoryEntry = entries.find((e) => e.kind === 'directory' && e.relativePath === 'locked');
    expect(directoryEntry).toBeDefined();
    const skippedEntry = entries.find(
      (e): e is Extract<WalkEntry, { kind: 'skipped' }> => e.kind === 'skipped' && e.relativePath === 'locked',
    );
    expect(skippedEntry).toBeDefined();
    expect(skippedEntry!.wasDirectory).toBe(true);
    expect(skippedEntry!.reason).toMatch(/unreadable/i);
  });

  it('stops after maxEntries, reporting why, instead of exhausting a huge tree', async () => {
    const tree: FakeTree = {};
    for (let i = 0; i < 50; i += 1) tree[`file-${String(i).padStart(3, '0')}.ts`] = 'x\n';
    const { port, root } = createFakeSourceFileSystem(tree);
    const entries = await collect(port, root, {
      exclusions: [], maxFileBytes: 1000, followSymlinks: false, maxEntries: 5,
    });
    // The walk gave up well short of all 50 fixture files.
    expect(entries.length).toBeLessThan(50);
    const limitSkip = entries.find((e) => e.kind === 'skipped' && /entry limit/i.test(e.reason));
    expect(limitSkip).toBeDefined();
  });

  it('cancellation stops the walk promptly, well before a large tree finishes', async () => {
    const tree: FakeTree = {};
    for (let i = 0; i < 500; i += 1) tree[`file-${String(i).padStart(3, '0')}.ts`] = 'x\n';
    const { port, root } = createFakeSourceFileSystem(tree);
    const { token, cancel } = createCancellationToken();
    const asyncIterable = port.walk(root, { exclusions: [], maxFileBytes: 1000, followSymlinks: false }, token);
    const iterator = asyncIterable[Symbol.asyncIterator]();

    let seen = 0;
    // Consume 20 entries out of 500, then cancel — "stops promptly" means the very next
    // pull rejects, not that the walk quietly runs to completion in the background.
    for (let i = 0; i < 20; i += 1) {
      const { done } = await iterator.next();
      if (done) break;
      seen += 1;
    }
    expect(seen).toBe(20);
    cancel();
    await expect(iterator.next()).rejects.toThrow();
  });
});

describe('root read failure propagates (fix-round-1 MINOR finding 8, spec 7 "a failed run")', () => {
  it('re-throws when the ROOT directory itself cannot be listed, distinguishable from cancellation', async () => {
    const { token } = createCancellationToken();
    const rootFailure = new Error('EACCES: permission denied, scandir /root');
    const deps: WalkerDeps = {
      caseSensitive: true,
      onOpen: () => {},
      joinPath: (base, name) => `${base}/${name}`,
      readdirNames: () => Promise.reject(rootFailure),
      lstat: () => Promise.reject(new Error('must not be called: the root readdir itself failed')),
      readAsText: () => Promise.reject(new Error('must not be called: the root readdir itself failed')),
    };
    const opts: WalkOptions = { exclusions: [], maxFileBytes: 1000, followSymlinks: false };
    const iterator = walkTree('/root', opts, token, deps)[Symbol.asyncIterator]();

    // Propagates the ROOT's own failure — not swallowed into an empty snapshot (spec 7:
    // a failed run must be visibly failed, never silently empty) and not disguised as a
    // cancellation, which never happened here.
    await expect(iterator.next()).rejects.toBe(rootFailure);
    expect(token.cancelled).toBe(false);
  });
});

// Fix-round-1 IMPORTANT finding 4: tests/contracts/source-filesystem-port.contract.ts's
// "never yields an entry outside the root" was vacuous by construction — every
// implementation's absolutePath is built as `deps.joinPath(root, name)` starting FROM
// root, so it structurally cannot be anything else; the test could not have failed
// against any implementation, buggy or not. This gives it something that actually could
// escape: Node's own `fs.readdir()` never returns '.' or '..' (it filters them, unlike
// raw POSIX readdir(3)), so this cannot happen through the real adapter today — but it
// is exactly the shape of name `isContained` and `normalizeRelativePath` exist to defend
// against if that ever changed (a different filesystem abstraction, a future refactor,
// or a non-Node WalkerDeps implementation that does not filter '.'/'..' itself).
describe('containment actually intercepts an escaping entry name (fix-round-1 finding 4)', () => {
  it('refuses a directory entry literally named ".." rather than yielding an out-of-root path', async () => {
    const { token } = createCancellationToken();
    // lstat/readAsText SUCCEED here, deliberately — not "must not be called" rejections.
    // A mock that rejects those calls would make this test pass EVEN WITH containment
    // and path-safety removed entirely (verified: I temporarily deleted both checks from
    // classifyEntry and reran this test with an earlier, rejecting version of these
    // mocks — it still passed, because the rejection itself produced a same-shaped
    // 'skipped' entry regardless of which code path produced it). Making lstat report a
    // real, existing FILE means that if containment/path-safety do not intercept the
    // escape, the walk actually YIELDS a 'file' entry with an out-of-root absolutePath —
    // giving this test something genuinely capable of failing.
    const deps: WalkerDeps = {
      caseSensitive: true,
      onOpen: () => {},
      // Deliberately naive: plain concatenation, unlike either real implementation's
      // joinPath, which would never itself be asked to "resolve" a traversal segment —
      // the point is that classifyEntry's OWN checks must catch this regardless of
      // whether joinPath does anything clever.
      joinPath: (base, name) => `${base}/${name}`,
      readdirNames: (absPath) => (absPath === '/root' ? Promise.resolve(['..']) : Promise.resolve([])),
      lstat: () => Promise.resolve({
        size: 10, isDirectory: () => false, isFile: () => true, isSymbolicLink: () => false,
      }),
      readAsText: () => Promise.resolve({ ok: true, text: 'escaped content', bytes: new TextEncoder().encode('escaped content') }),
    };
    const opts: WalkOptions = { exclusions: [], maxFileBytes: 1000, followSymlinks: false };
    const entries: WalkEntry[] = [];
    for await (const entry of walkTree('/root', opts, token, deps)) entries.push(entry);

    expect(entries).toHaveLength(1);
    expect(entries[0]!.kind).toBe('skipped');
    expect((entries[0] as Extract<WalkEntry, { kind: 'skipped' }>).reason).toMatch(/unsafe path|outside the approved root/i);
    // Never an out-of-root absolutePath: the 'skipped' variant carries no absolutePath
    // field at all, so there is nothing here that COULD have escaped through — the
    // escape attempt was refused before an entry with an absolutePath was ever built.
    // (Proved capable of failing: with containment AND path-safety both removed from
    // classifyEntry, this same test yields a 'file' entry with absolutePath '/root/..'
    // instead, failing both assertions above — reverted before committing.)
    expect('absolutePath' in entries[0]!).toBe(false);
  });
});

// Fix-round-1 MINOR finding 6: exclusion matching now applies the same case-sensitivity
// decision containment already uses (ruling M20). Before this fix, isExcluded always
// compared case-sensitively regardless of platform — "the one place where an exclusion
// miss would put plugin output back into scope" on a case-insensitive filesystem.
function treeWithMixedCaseConfigDir(): WalkerDeps {
  const listings: Record<string, string[]> = {
    '/root': ['.Obsidian', 'kept.ts'],
    '/root/.Obsidian': ['data.json'],
  };
  const files = new Set(['/root/kept.ts', '/root/.Obsidian/data.json']);
  return {
    caseSensitive: false,   // overridden per-call below via a fresh deps object
    onOpen: () => {},
    joinPath: (base, name) => `${base}/${name}`,
    readdirNames: (absPath) => Promise.resolve(listings[absPath] ?? []),
    lstat: (absPath) => Promise.resolve({
      size: 10,
      isDirectory: () => absPath in listings,
      isFile: () => files.has(absPath),
      isSymbolicLink: () => false,
    }),
    readAsText: () => Promise.resolve({ ok: true, text: 'x\n', bytes: new TextEncoder().encode('x\n') }),
  };
}

describe('exclusion matching honours the same case-sensitivity decision as containment (fix-round-1 finding 6)', () => {
  async function walkWith(caseSensitive: boolean): Promise<WalkEntry[]> {
    const { token } = createCancellationToken();
    const deps = { ...treeWithMixedCaseConfigDir(), caseSensitive };
    const opts: WalkOptions = { exclusions: ['.obsidian'], maxFileBytes: 1000, followSymlinks: false };
    const out: WalkEntry[] = [];
    for await (const entry of walkTree('/root', opts, token, deps)) out.push(entry);
    return out;
  }

  it('case-insensitive mode (Windows-like): ".obsidian" DOES prune an on-disk ".Obsidian"', async () => {
    const entries = await walkWith(false);
    expect(entries.some((e) => e.relativePath.startsWith('.Obsidian'))).toBe(false);
    expect(entries.some((e) => e.relativePath === 'kept.ts')).toBe(true);
  });

  it('case-sensitive mode (POSIX-like): ".obsidian" does NOT prune an on-disk ".Obsidian"', async () => {
    const entries = await walkWith(true);
    expect(entries.some((e) => e.relativePath.startsWith('.Obsidian'))).toBe(true);
    expect(entries.some((e) => e.relativePath === 'kept.ts')).toBe(true);
  });
});
