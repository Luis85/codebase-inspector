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
    // 'a' (depth 1), 'a/b' (depth 2) and 'a/b/c' (depth 3, itself still discovered and
    // yielded) are found; 'a/b/c' is where maxDepth=2 refuses to descend FURTHER, so
    // nothing UNDER it (its own children) is ever discovered.
    expect(entries.some((e) => e.relativePath === 'a')).toBe(true);
    expect(entries.some((e) => e.relativePath === 'a/b')).toBe(true);
    expect(entries.some((e) => e.relativePath === 'a/b/c')).toBe(true);
    const depthSkip = entries.find((e) => e.kind === 'skipped' && /maximum depth/i.test(e.reason));
    expect(depthSkip).toBeDefined();
    expect(entries.some((e) => e.relativePath.startsWith('a/b/c/'))).toBe(false);
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
