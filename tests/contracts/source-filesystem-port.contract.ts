// The shared suite every SourceFileSystemPort implementation must pass, so a fake and
// the Node adapter cannot drift (spec 6, task-5 brief step 2). `make()` builds a FRESH
// port over a canonical fixture tree containing one of every situation the eleven tests
// below need at once: a normal file, an excluded subtree, an oversized file (relative to
// a deliberately tiny `maxFileBytes`), a binary file, an unreadable file and a symlink
// (to a directory, so it works without elevation on Windows — see
// tests/fixtures/temp-tree.ts's own note on file-target symlinks).
import { describe, expect, it } from 'vitest';
import type { SourceFileSystemPort, WalkEntry, WalkOptions } from '../../src/application/ports/source-filesystem-port';
import { createCancellationToken } from '../fixtures/cancellation-token';

export const CONTRACT_FIXTURE_OPTIONS: WalkOptions = {
  exclusions: ['excluded'],
  maxFileBytes: 100,
  followSymlinks: false,
};

async function collectAll(port: SourceFileSystemPort, root: string, opts: WalkOptions): Promise<WalkEntry[]> {
  const { token } = createCancellationToken();
  const out: WalkEntry[] = [];
  for await (const entry of port.walk(root, opts, token)) out.push(entry);
  return out;
}

function isAbsolute(p: string): boolean {
  return p.startsWith('/') || /^[A-Za-z]:[\\/]/.test(p);
}

export function runContractSuite(
  name: string,
  make: () => Promise<{ port: SourceFileSystemPort; root: string }>,
): void {
  describe(`SourceFileSystemPort contract: ${name}`, () => {
    it('yields POSIX root-relative paths, never absolute ones', async () => {
      const { port, root } = await make();
      const entries = await collectAll(port, root, CONTRACT_FIXTURE_OPTIONS);
      expect(entries.length).toBeGreaterThan(0);
      for (const entry of entries) {
        expect(isAbsolute(entry.relativePath)).toBe(false);
        expect(entry.relativePath.includes('\\')).toBe(false);
      }
    });

    // Fix-round-1 IMPORTANT finding 4: a bare "starts with root" prefix check is vacuous
    // by construction — every implementation builds absolutePath as
    // `deps.joinPath(root, name)`, so it structurally cannot be anything else, buggy or
    // not (a bare prefix check can never fail here). Strengthened to also assert EXACT
    // correspondence between the suffix of absolutePath (after stripping root) and the
    // entry's own relativePath — this WOULD fail against a real bug class a prefix check
    // cannot see, such as joinPath dropping, duplicating or misordering a path segment.
    // A genuine escape-attempt test (a name that could actually resolve outside root)
    // lives at the walker level instead — see tests/unit/walker-bounds.test.ts's
    // "containment actually intercepts an escaping entry name", which needs direct
    // access to a hand-rolled WalkerDeps that this suite's `make()` shape does not
    // expose, and which real filesystems cannot construct anyway (Node's own
    // `fs.readdir()` never returns a name that could escape via `..`).
    it('never yields an entry outside the root, and its absolutePath matches its relativePath exactly', async () => {
      const { port, root } = await make();
      const entries = await collectAll(port, root, CONTRACT_FIXTURE_OPTIONS);
      const normalizedRoot = root.replace(/\\/g, '/');
      let checked = 0;
      for (const entry of entries) {
        if (entry.kind === 'skipped') continue;
        const normalizedAbs = entry.absolutePath.replace(/\\/g, '/');
        const withinRoot = normalizedAbs === normalizedRoot || normalizedAbs.startsWith(`${normalizedRoot}/`);
        expect(withinRoot, entry.absolutePath).toBe(true);
        const suffix = normalizedAbs.slice(normalizedRoot.length).replace(/^\/+/, '');
        expect(suffix, entry.absolutePath).toBe(entry.relativePath);
        checked += 1;
      }
      // Not vacuous: the fixture always has at least one non-skipped ('file' or
      // 'directory') entry to actually run the check above against.
      expect(checked).toBeGreaterThan(0);
    });

    it('reports a skipped entry with a REASON rather than omitting it', async () => {
      const { port, root } = await make();
      const entries = await collectAll(port, root, CONTRACT_FIXTURE_OPTIONS);
      const skipped = entries.filter((e): e is Extract<WalkEntry, { kind: 'skipped' }> => e.kind === 'skipped');
      expect(skipped.length).toBeGreaterThan(0);
      for (const entry of skipped) {
        expect(typeof entry.reason).toBe('string');
        expect(entry.reason.length).toBeGreaterThan(0);
      }
    });

    it('reports an unreadable file as skipped with a reason, never as zero bytes', async () => {
      const { port, root } = await make();
      const entries = await collectAll(port, root, CONTRACT_FIXTURE_OPTIONS);
      const found = entries.find((e) => e.relativePath === 'unreadable.ts');
      expect(found).toBeDefined();
      expect(found!.kind).toBe('skipped');
      // The 'skipped' WalkEntry variant carries no byteSize field at all — there is no
      // way for this entry to smuggle a 0 through, by construction of the type itself.
      expect('byteSize' in found!).toBe(false);
    });

    it('reports a binary file as skipped with a reason, never as 0 lines', async () => {
      const { port, root } = await make();
      const entries = await collectAll(port, root, CONTRACT_FIXTURE_OPTIONS);
      const found = entries.find((e) => e.relativePath === 'binary.dat');
      expect(found).toBeDefined();
      expect(found!.kind).toBe('skipped');
      expect((found as Extract<WalkEntry, { kind: 'skipped' }>).reason).toMatch(/binary/i);
    });

    it('reports a file over maxFileBytes as skipped with a reason', async () => {
      const { port, root } = await make();
      const entries = await collectAll(port, root, CONTRACT_FIXTURE_OPTIONS);
      const found = entries.find((e) => e.relativePath === 'oversized.ts');
      expect(found).toBeDefined();
      expect(found!.kind).toBe('skipped');
      expect((found as Extract<WalkEntry, { kind: 'skipped' }>).reason).toMatch(/maximum file size/i);
    });

    it('does not follow symlinks, and says so as a reason', async () => {
      const { port, root } = await make();
      const entries = await collectAll(port, root, CONTRACT_FIXTURE_OPTIONS);
      const found = entries.find((e) => e.relativePath === 'linked');
      expect(found).toBeDefined();
      expect(found!.kind).toBe('skipped');
      expect((found as Extract<WalkEntry, { kind: 'skipped' }>).reason).toMatch(/symlink/i);
      // Never followed: nothing from the symlink's target directory ('src/a.ts') was
      // discovered a SECOND time under the 'linked/' prefix.
      expect(entries.some((e) => e.relativePath.startsWith('linked/'))).toBe(false);
    });

    it('stops promptly when the cancellation token is cancelled', async () => {
      const { port, root } = await make();
      const { token, cancel } = createCancellationToken();
      const iterator = port.walk(root, CONTRACT_FIXTURE_OPTIONS, token)[Symbol.asyncIterator]();
      await iterator.next();
      cancel();
      await expect(iterator.next()).rejects.toThrow();
    });

    // Fix-round-1 IMPORTANT finding 4: `p.endsWith('a.ts') || p.includes('src')` is
    // satisfied by the containing DIRECTORY's own open alone (confirmed: the reviewer's
    // measurement found `<root>\src` logged twice and nothing else, and this assertion
    // still passed) — it never actually checked that the FILE itself, as opposed to its
    // parent directory, was opened. This is the assertion the entire read-log safety
    // proof rests on, so it now checks every non-excluded fixture entry individually,
    // not just "something plausible-looking is in the log".
    it('records every path it OPENS in readLog(), for every non-excluded fixture entry', async () => {
      const { port, root } = await make();
      await collectAll(port, root, CONTRACT_FIXTURE_OPTIONS);
      const log = port.readLog().map((p) => p.replace(/\\/g, '/'));
      for (const relativePath of ['src/a.ts', 'oversized.ts', 'binary.dat', 'unreadable.ts', 'linked']) {
        expect(log.some((p) => p.endsWith(`/${relativePath}`)), relativePath).toBe(true);
      }
    });

    it('records nothing in readLog() for an excluded path', async () => {
      const { port, root } = await make();
      await collectAll(port, root, CONTRACT_FIXTURE_OPTIONS);
      const log = port.readLog();
      expect(log.some((p) => p.includes('excluded'))).toBe(false);
    });

    it('is deterministic: two walks yield the same ordered relative paths', async () => {
      const first = await make();
      const second = await make();
      const a = (await collectAll(first.port, first.root, CONTRACT_FIXTURE_OPTIONS)).map((e) => e.relativePath);
      const b = (await collectAll(second.port, second.root, CONTRACT_FIXTURE_OPTIONS)).map((e) => e.relativePath);
      expect(a).toEqual(b);
    });
  });
}
