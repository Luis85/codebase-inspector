// Part 7 Z4/Z5: what the executable IS, before anything runs. A stat, a real path and its
// first 4 bytes — it is never executed, and this file touches no child_process. Checks run
// in order and the first failure wins: absolute path, base name (launchers by extension),
// exists, regular file, real path, native format (a `#!` script is a launcher). Fs deps
// are injectable (M17), defaulting to node-access.ts; tests pass node:fs/promises.
import { Platform } from 'obsidian';
import { fsPromises as defaultFsPromises } from '../filesystem/node-access';
import type { NodeFsPromisesLike, NodeStatsLike } from '../filesystem/node-globals';
import { isContained, normalizeAbsolutePath } from '../../domain/path-safety';
import type {
  ExecutableFormat, ExecutableInspection, ExecutableInspectorPort, ExecutableRefusal,
} from '../../application/ports/executable-inspector';

export interface ExecutableInspectorDeps {
  /** null: not the desktop app, so nothing can be inspected. */
  fsPromises?: NodeFsPromisesLike | null;
  /** Node's platform name; defaults to Obsidian's Platform flags. */
  platform?: string;
}

const LAUNCHER_EXTENSIONS: readonly string[] = ['.cmd', '.bat', '.ps1', '.js', '.mjs', '.cjs', '.sh', '.vbs'];
const MACH_O: readonly string[] = ['feedface', 'feedfacf', 'cefaedfe', 'cffaedfe', 'cafebabe'];

function hostPlatform(): string {
  if (Platform.isWin) return 'win32';
  return Platform.isMacOS ? 'darwin' : 'linux';
}

const refuse = (refusal: ExecutableRefusal, detail = ''): ExecutableInspection => ({ ok: false, refusal, detail });

function baseNameOf(path: string): string {
  const posix = path.replace(/\\/g, '/');
  return posix.slice(posix.lastIndexOf('/') + 1);
}

function codeOf(e: unknown): string {
  if (typeof e === 'object' && e !== null && 'code' in e) {
    const code = e.code;
    if (typeof code === 'string') return code;
  }
  return 'UNKNOWN';
}

/** Z4: fallow.exe on Windows (any case), fallow elsewhere (exact). `fallow` plus a launcher
 *  extension is refused as a launcher, with its own message; anything else is a wrong name. */
function nameRefusal(name: string, platform: string): ExecutableInspection | null {
  const expected = platform === 'win32' ? 'fallow.exe' : 'fallow';
  if (platform === 'win32' ? name.toLowerCase() === expected : name === expected) return null;
  const lower = name.toLowerCase();
  const dot = lower.lastIndexOf('.');
  const stem = dot < 0 ? lower : lower.slice(0, dot);
  const extension = dot < 0 ? '' : lower.slice(dot);
  return refuse(stem === 'fallow' && LAUNCHER_EXTENSIONS.includes(extension) ? 'launcher' : 'wrong-name', expected);
}

function formatOf(head: Uint8Array, platform: string): ExecutableFormat | 'script' | null {
  if (head[0] === 0x23 && head[1] === 0x21) return 'script';
  const hex = Array.from(head, (b) => b.toString(16).padStart(2, '0')).join('');
  if (platform === 'win32') return hex.startsWith('4d5a') ? 'pe' : null;
  if (platform === 'darwin') return MACH_O.includes(hex) ? 'mach-o' : null;
  return hex === '7f454c46' ? 'elf' : null;
}

async function readHead(fs: NodeFsPromisesLike, path: string): Promise<Uint8Array> {
  const handle = await fs.open(path, 'r');
  try {
    const buffer = new Uint8Array(4);
    const { bytesRead } = await handle.read(buffer, 0, 4, 0);
    return buffer.subarray(0, bytesRead);
  } finally {
    await handle.close();
  }
}

export function createExecutableInspector(deps: ExecutableInspectorDeps = {}): ExecutableInspectorPort {
  const fs = deps.fsPromises === undefined ? defaultFsPromises : deps.fsPromises;
  const platform = deps.platform ?? hostPlatform();
  // M20: the platform's own case rule for containment.
  const caseSensitive = platform !== 'win32' && platform !== 'darwin';
  const inside = (root: string, candidate: string): boolean => isContained(root, candidate, { caseSensitive });
  return {
    executableName: platform === 'win32' ? 'fallow.exe' : 'fallow',
    async inspect(executablePath, rootPath) {
      let path: string;
      try {
        path = normalizeAbsolutePath(executablePath.trim());
      } catch {
        return refuse('not-absolute');
      }
      const named = nameRefusal(baseNameOf(path), platform);
      if (named !== null) return named;
      if (fs === null) return refuse('unreadable', 'UNAVAILABLE');
      let stat: NodeStatsLike;
      try {
        stat = await fs.stat(path);
      } catch (e) {
        const code = codeOf(e);
        return code === 'ENOENT' ? refuse('executable-missing') : refuse('unreadable', code);
      }
      if (!stat.isFile()) return refuse('not-a-file');
      let realPath: string;
      let head: Uint8Array;
      try {
        realPath = await fs.realpath(path);
        head = await readHead(fs, realPath);
      } catch (e) {
        return refuse('unreadable', codeOf(e));
      }
      const format = formatOf(head, platform);
      if (format === 'script') return refuse('launcher', platform === 'win32' ? 'fallow.exe' : 'fallow');
      if (format === null) return refuse('not-native');
      // K22 (Review Focus 3): the root's real path too, so a root reached through a
      // symlink or junction still flags a binary inside its target.
      const realRoot = await fs.realpath(rootPath).catch(() => rootPath);
      const insideRoot = inside(rootPath, path) || inside(rootPath, realPath) || inside(realRoot, realPath);
      return { ok: true, facts: { executablePath: path, realPath, size: stat.size, mtimeMs: stat.mtimeMs, format, insideRoot } };
    },
  };
}
