// Real temporary directory fixtures for the integration tests and for the
// node-filesystem contract suite. Always under the OS temp directory (os.tmpdir()),
// NEVER inside the repository — task-5-context.md section 1 is explicit that a fixture
// tree landing in the working tree risks `git add -A` sweeping it into a commit.
// node: built-ins are freely usable here — no-nodejs-modules is off under tests/**.
import { mkdtemp, mkdir, writeFile, rm, symlink, readdir, lstat, readFile, chmod } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { createHash } from 'node:crypto';

const execFileAsync = promisify(execFile);

export type TempTreeEntry =
  | string                                  // a regular text file's content
  | { readonly binary: Uint8Array }         // raw bytes (used for binary-content fixtures)
  | { readonly unreadable: string }         // content, then made unreadable after creation
  | { readonly symlinkTo: string };         // a symlink/junction to another key in the same spec

export type TempTreeSpec = Record<string, TempTreeEntry>;

export interface TempTree {
  root: string;
  cleanup(): Promise<void>;
}

async function makeUnreadable(absPath: string, restore: (() => Promise<void>)[]): Promise<void> {
  if (process.platform === 'win32') {
    // chmod does not restrict reads on NTFS through Node (verified: chmod 0o000 followed
    // by a read still succeeds) — the reliable way to produce a genuine EPERM on Windows
    // without an elevated process is a per-file ACL deny, reset before cleanup so
    // rm(recursive) does not itself fail with EPERM (verified: it does, without the reset).
    const user = process.env.USERNAME ?? process.env.USER ?? '';
    await execFileAsync('icacls', [absPath, '/deny', `${user}:(R)`]);
    restore.push(async () => { await execFileAsync('icacls', [absPath, '/reset']); });
  } else {
    // POSIX: chmod actually enforces read permission (unlike Windows/NTFS via Node,
    // verified: chmod 0o000 there does not stop a read).
    await chmod(absPath, 0o000);
    restore.push(async () => { await chmod(absPath, 0o644); });
  }
}

/** Builds a real directory tree under the OS temp directory from a flat, POSIX-keyed
 *  spec. Symlink targets are resolved against the same tree and created as a Windows
 *  junction when the target is a directory (works without elevation — verified; a
 *  Windows FILE symlink needs Developer Mode or an elevated process and fails EPERM
 *  otherwise, so file-target symlinks are attempted but never required to succeed —
 *  see tests/integration/walker-symlinks.test.ts). */
export async function makeTempTree(spec: TempTreeSpec): Promise<TempTree> {
  const root = await mkdtemp(join(tmpdir(), 'codebase-inspector-fixture-'));
  const restore: (() => Promise<void>)[] = [];

  // Symlink entries are created LAST, so their targets (plain files/dirs created above)
  // already exist on disk.
  const direct = Object.entries(spec).filter(([, e]) => typeof e !== 'object' || !('symlinkTo' in e));
  const links = Object.entries(spec).filter(([, e]) => typeof e === 'object' && 'symlinkTo' in e);

  for (const [relPath, entry] of direct) {
    const abs = join(root, ...relPath.split('/'));
    await mkdir(dirname(abs), { recursive: true });
    if (typeof entry === 'string') {
      await writeFile(abs, entry, 'utf8');
    } else if ('binary' in entry) {
      await writeFile(abs, entry.binary);
    } else if ('unreadable' in entry) {
      await writeFile(abs, entry.unreadable, 'utf8');
      await makeUnreadable(abs, restore);
    }
  }
  for (const [relPath, entry] of links) {
    if (typeof entry !== 'object' || !('symlinkTo' in entry)) continue;
    const abs = join(root, ...relPath.split('/'));
    await mkdir(dirname(abs), { recursive: true });
    const targetAbs = join(root, ...entry.symlinkTo.split('/'));
    const targetStat = await lstat(targetAbs);
    const type = process.platform === 'win32' ? (targetStat.isDirectory() ? 'junction' : 'file') : undefined;
    await symlink(targetAbs, abs, type);
  }

  return {
    root,
    async cleanup(): Promise<void> {
      for (const undo of restore) {
        try { await undo(); } catch { /* best-effort: rm below still runs regardless */ }
      }
      await rm(root, { recursive: true, force: true });
    },
  };
}

export interface FileFingerprint { sha256: string; mtimeMs: number; size: number }

/** Hashes every file AND every directory in the tree, including a placeholder for a
 *  file this process cannot read (the deliberately-unreadable fixture) — its
 *  mtimeMs/size still catch a write, which is what the no-source-write proof needs.
 *  Symlinks are fingerprinted by their own lstat (never followed), so re-pointing one
 *  would also be caught. Fix-round-1 finding 2: a directory's OWN fingerprint is
 *  recorded (not just recursed into) — before this, an empty directory a regression
 *  created inside the tree would never appear in the resulting map at all, since only
 *  directories' FILES were ever given an entry; `toEqual` on the whole map would not
 *  have noticed a key that never existed on either side. */
export async function hashTree(root: string): Promise<Record<string, FileFingerprint>> {
  const result: Record<string, FileFingerprint> = {};

  async function visitDir(dir: string, relPrefix: string): Promise<void> {
    const names = (await readdir(dir)).sort();
    for (const name of names) {
      const abs = join(dir, name);
      const rel = relPrefix ? `${relPrefix}/${name}` : name;
      const st = await lstat(abs);
      if (st.isSymbolicLink()) {
        result[rel] = { sha256: 'symlink', mtimeMs: st.mtimeMs, size: st.size };
      } else if (st.isDirectory()) {
        result[rel] = { sha256: 'directory', mtimeMs: st.mtimeMs, size: st.size };
        await visitDir(abs, rel);
      } else if (st.isFile()) {
        let sha256 = 'unreadable';
        try {
          sha256 = createHash('sha256').update(await readFile(abs)).digest('hex');
        } catch { /* the deliberately-unreadable fixture file: fingerprint by stat alone */ }
        result[rel] = { sha256, mtimeMs: st.mtimeMs, size: st.size };
      }
    }
  }

  await visitDir(root, '');
  return result;
}
