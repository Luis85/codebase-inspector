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

/** Fix wave item 10 (M6, and deferred minor #23): a deliberately NON-ASCII fixture file,
 *  required in both driver fixtures. Every byte-size claim on this branch was previously
 *  established only by source inspection, against an ASCII-only fixture where a byte
 *  count and a UTF-16 code-unit count are the same number — so nothing anywhere would
 *  have failed if a size had been measured in code units. `.length` on this string is 20
 *  and its UTF-8 encoding is 27 bytes, so the two answers are now visibly different.
 *  Comfortably under CONTRACT_FIXTURE_OPTIONS.maxFileBytes, so it is a KEPT file. */
export const CONTRACT_UNICODE_PATH = 'unicode.ts';
export const CONTRACT_UNICODE_CONTENT = 'const gruß = "日本語";\n';
export const CONTRACT_UNICODE_BYTES = new TextEncoder().encode(CONTRACT_UNICODE_CONTENT).length;

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

    // --- byteSize / byteLength are BYTES ------------------------------------------
    // Fix wave item 10 (M6 + deferred minor #23). Both numbers used to be checked only
    // against ASCII fixtures, where a byte count and a UTF-16 code-unit count coincide.
    // This also caught real fake-vs-real drift: the fake reported `byteSize` from
    // String.length while the Node adapter reports it from a real lstat.
    it('measures a multi-byte file in BYTES, not UTF-16 code units', async () => {
      const { port, root } = await make();
      const entries = await collectAll(port, root, CONTRACT_FIXTURE_OPTIONS);
      const found = entries.find((e) => e.relativePath === CONTRACT_UNICODE_PATH);
      expect(found, CONTRACT_UNICODE_PATH).toBeDefined();
      expect(found!.kind).toBe('file');
      const file = found as Extract<WalkEntry, { kind: 'file' }>;
      // Not vacuous: the two candidate answers genuinely differ for this fixture.
      expect(CONTRACT_UNICODE_BYTES).not.toBe(CONTRACT_UNICODE_CONTENT.length);
      expect(file.byteLength).toBe(CONTRACT_UNICODE_BYTES);
      expect(file.byteSize).toBe(CONTRACT_UNICODE_BYTES);
      expect(file.lineCount).toBe(1);
    });

    // --- readText() ---------------------------------------------------------------
    // Fix wave item 10 (M6): all eleven original tests drove walk() and readLog(), so two
    // of the port's four methods were never exercised at all -- and there was real
    // fake-vs-real drift sitting in one of them (the Node adapter logged a readText path
    // TWICE, once for its lstat and once inside readRawText; the fake logged it once).
    // Spec 6 says the shared suite exists "so a fake and the Node adapter cannot drift".
    it('readText() returns the decoded text and the raw bytes for a readable file', async () => {
      const { port, root } = await make();
      const result = await port.readText(`${root}/${CONTRACT_UNICODE_PATH}`, CONTRACT_FIXTURE_OPTIONS.maxFileBytes);
      expect(result.status).toBe('ok');
      const ok = result as Extract<typeof result, { status: 'ok' }>;
      expect(ok.text).toBe(CONTRACT_UNICODE_CONTENT);
      expect(ok.bytes.length).toBe(CONTRACT_UNICODE_BYTES);
    });

    it('readText() logs the path it opened EXACTLY once, however many syscalls it took', async () => {
      const { port, root } = await make();
      const absPath = `${root}/${CONTRACT_UNICODE_PATH}`;
      await port.readText(absPath, CONTRACT_FIXTURE_OPTIONS.maxFileBytes);
      // One logical read of one file is one entry. How many filesystem calls an
      // implementation makes underneath is exactly the kind of detail a shared contract
      // must not let vary: readLog() answers "which paths did this port open", and the
      // safety proof that rests on it (tests/integration/read-log.test.ts) is about
      // presence and absence of paths, not about call counts.
      expect(port.readLog().filter((p) => p === absPath)).toHaveLength(1);
    });

    it('readText() reports an over-size file as unavailable with a reason, never truncated', async () => {
      const { port, root } = await make();
      const result = await port.readText(`${root}/oversized.ts`, CONTRACT_FIXTURE_OPTIONS.maxFileBytes);
      expect(result.status).toBe('unavailable');
      expect((result as Extract<typeof result, { status: 'unavailable' }>).reason).toMatch(/maximum size/i);
    });

    it('readText() reports binary content as unavailable with a reason', async () => {
      const { port, root } = await make();
      const result = await port.readText(`${root}/binary.dat`, CONTRACT_FIXTURE_OPTIONS.maxFileBytes);
      expect(result.status).toBe('unavailable');
      expect((result as Extract<typeof result, { status: 'unavailable' }>).reason).toMatch(/binary/i);
    });

    it('readText() reports a path that does not exist as unavailable, never as empty text', async () => {
      const { port, root } = await make();
      const result = await port.readText(`${root}/no-such-file.ts`, CONTRACT_FIXTURE_OPTIONS.maxFileBytes);
      expect(result.status).toBe('unavailable');
      expect((result as Extract<typeof result, { status: 'unavailable' }>).reason.length).toBeGreaterThan(0);
    });

    // --- stat() -------------------------------------------------------------------
    it('stat() distinguishes a directory, a file and a missing path', async () => {
      const { port, root } = await make();
      const dir = await port.stat(`${root}/src`);
      expect([dir.exists, dir.isDirectory, dir.isFile]).toEqual([true, true, false]);

      const file = await port.stat(`${root}/${CONTRACT_UNICODE_PATH}`);
      expect([file.exists, file.isDirectory, file.isFile]).toEqual([true, false, true]);
      expect(file.size).toBe(CONTRACT_UNICODE_BYTES);

      const missing = await port.stat(`${root}/no-such-file.ts`);
      // Never a throw and never a half-populated record: a missing path is reported.
      expect(missing).toEqual(
        { exists: false, isDirectory: false, isFile: false, isSymbolicLink: false, size: 0, mtimeMs: 0 });
    });

    it('stat() reports a symlink WITHOUT following it', async () => {
      const { port, root } = await make();
      const link = await port.stat(`${root}/linked`);
      expect(link.exists).toBe(true);
      // lstat semantics, never stat: the link's target is a directory, so a following
      // implementation would report isDirectory here.
      expect(link.isSymbolicLink).toBe(true);
      expect(link.isDirectory).toBe(false);
    });

    it('stat() logs the path it opened', async () => {
      const { port, root } = await make();
      const absPath = `${root}/${CONTRACT_UNICODE_PATH}`;
      await port.stat(absPath);
      expect(port.readLog().filter((p) => p === absPath)).toHaveLength(1);
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
