// The real, Node-backed SourceFileSystemPort. Ruling M17 (task-5-context.md section 5):
// this factory takes its filesystem and path implementations as PARAMETERS, defaulting
// to node-access.ts's exports, rather than importing node-access.ts's values and using
// them directly. Production code calls createNodeSourceFileSystem() with no arguments
// and gets the real thing; tests/contracts/node-filesystem.test.ts injects `node:fs` and
// `node:path` imported directly in the test file (permitted under tests/**, where
// no-nodejs-modules is off), exercising this exact adapter logic against a real
// filesystem without ever importing node-access.ts (whose `window`/`Platform` guard
// throws under plain Node/jsdom per ruling M17's own diagnosis).
//
// node:fs, not node:original-fs, in tests: `node:original-fs` does not exist outside an
// Electron process (`No such built-in module: node:original-fs`, confirmed by running
// it) — it is Electron's patch, not a Node built-in, so only production's real
// window.require('node:original-fs') call (inside Electron) ever resolves it.
import { fsPromises as defaultFsPromises, nodePath as defaultNodePath } from './node-access';
import { walkTree } from './walker';
import type { WalkerDeps, ReadTextOutcome } from './walker';
import type {
  SourceFileSystemPort, WalkEntry, WalkOptions, ReadResult, StatResult,
} from '../../application/ports/source-filesystem-port';
import type { CancellationToken } from '../../application/ports/cancellation-token';
import type { NodeFsPromisesLike, NodePathLike } from './node-globals';

const BINARY_SNIFF_BYTES = 8000;

function message(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

function looksBinary(bytes: Uint8Array): boolean {
  const scanned = Math.min(bytes.length, BINARY_SNIFF_BYTES);
  for (let i = 0; i < scanned; i += 1) {
    if (bytes[i] === 0) return true;
  }
  return false;
}

type DecodedText = { ok: true; text: string; bytes: Uint8Array } | { ok: false; reason: string };

/** Single source of truth for binary/undecodable classification, used both by the
 *  walk's own per-file check and by the public readText() method, so the two can never
 *  disagree about what counts as text. Carries the raw bytes through on success, so the
 *  collector can compute the byte-size observation via the domain's own `byteSize()`
 *  (task 2) rather than trusting a number this adapter merely reports. */
function decodeIfText(bytes: Uint8Array): DecodedText {
  if (looksBinary(bytes)) return { ok: false, reason: 'file appears to contain binary content' };
  try {
    return { ok: true, text: new TextDecoder('utf-8', { fatal: true }).decode(bytes), bytes };
  } catch {
    return { ok: false, reason: 'file is not valid UTF-8 text' };
  }
}

export interface NodeSourceFileSystemDeps {
  fsPromises?: NodeFsPromisesLike;
  path?: NodePathLike;
}

/** Creates the real Node-backed SourceFileSystemPort. With no arguments this uses
 *  node-access.ts's window.require'd modules (production); passing `fsPromises`/`path`
 *  overrides them (ruling M17 part 2 — this is how the Node adapter is exercised under
 *  plain Vitest, which never touches `window`). */
export function createNodeSourceFileSystem(deps: NodeSourceFileSystemDeps = {}): SourceFileSystemPort {
  const maybeFsp = deps.fsPromises ?? defaultFsPromises;
  const maybePath = deps.path ?? defaultNodePath;
  if (!maybeFsp || !maybePath) {
    throw new Error(
      'createNodeSourceFileSystem has no fs/path implementation: Platform.isDesktopApp ' +
      'is false and no override was supplied.',
    );
  }
  // Rebound to new names: TypeScript's null-narrowing above does not persist into the
  // closures declared below (`fsp`/`path` read `maybeFsp`/`maybePath` through a captured
  // variable, not the narrowed check itself), so these are the definitely-non-null
  // values every function in this factory actually uses.
  const fsp: NodeFsPromisesLike = maybeFsp;
  const path: NodePathLike = maybePath;

  const log: string[] = [];
  // Ruling M20: the adapter decides case sensitivity from the platform it is actually
  // running on (here: the injected path module's own separator), never from reading
  // process.platform directly — src/domain/** cannot read the platform at all, and this
  // keeps the one signal (path.sep) flowing through the same injected dependency as
  // everything else this adapter touches.
  const caseSensitive = path.sep !== '\\';

  async function readRawText(absPath: string): Promise<DecodedText> {
    log.push(absPath);
    try {
      const bytes = await fsp.readFile(absPath);
      return decodeIfText(bytes);
    } catch (e) {
      return { ok: false, reason: `file is unreadable: ${message(e)}` };
    }
  }

  const walkerDeps: WalkerDeps = {
    caseSensitive,
    onOpen: (absPath) => log.push(absPath),
    joinPath: (base, name) => path.join(base, name),
    readdirNames: (absPath) => fsp.readdir(absPath),
    lstat: (absPath) => fsp.lstat(absPath),
    readAsText: async (absPath): Promise<ReadTextOutcome> => {
      const outcome = await readRawText(absPath);
      return outcome.ok ? { ok: true, text: outcome.text } : outcome;
    },
  };

  async function readText(absPath: string, maxBytes: number): Promise<ReadResult> {
    log.push(absPath);   // the lstat below is itself an open, logged even if it fails
    let st;
    try {
      st = await fsp.lstat(absPath);
    } catch (e) {
      return { status: 'unavailable', reason: `file is unreadable: ${message(e)}` };
    }
    if (st.size > maxBytes) {
      return { status: 'unavailable', reason: `file exceeds the maximum size of ${maxBytes} bytes` };
    }
    const outcome = await readRawText(absPath);
    return outcome.ok
      ? { status: 'ok', text: outcome.text, bytes: outcome.bytes }
      : { status: 'unavailable', reason: outcome.reason };
  }

  async function stat(absPath: string): Promise<StatResult> {
    log.push(absPath);
    try {
      const st = await fsp.lstat(absPath);
      return {
        exists: true, isDirectory: st.isDirectory(), isFile: st.isFile(),
        isSymbolicLink: st.isSymbolicLink(), size: st.size, mtimeMs: st.mtimeMs,
      };
    } catch {
      return { exists: false, isDirectory: false, isFile: false, isSymbolicLink: false, size: 0, mtimeMs: 0 };
    }
  }

  return {
    walk(root: string, opts: WalkOptions, token: CancellationToken): AsyncIterable<WalkEntry> {
      return walkTree(root, opts, token, walkerDeps);
    },
    readText,
    stat,
    readLog: () => [...log],
  };
}
