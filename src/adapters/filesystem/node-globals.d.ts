// Ambient typing ONLY — erased at compile time, no runtime code, no Node import.
//
// node-access.ts's code is spec 3.1 verbatim (ruling M17: it must not be restructured,
// not even to add a type annotation). But `window` is a DOM `Window`, which has no
// `require` member in lib.dom.d.ts, so `window.require(...)` does not typecheck without
// something augmenting `Window` first. The obvious fix — adding `@types/node` to
// tsconfig.json's `types` — was rejected: it would put Node's ambient globals (`process`,
// `Buffer`, `__dirname`, ...) within reach of every file under src/**, which is exactly
// what the single-Node-access-module design (spec 3.1) and `no-nodejs-modules` exist to
// prevent. Rejected instead of a `(window as any).require(...)` cast at each call site,
// which would make `fs`/`fsPromises`/`nodePath` themselves `any`, tripping
// @typescript-eslint/no-unsafe-* everywhere they are later consumed (walker.ts,
// node-source-filesystem.ts) and forcing a lint-rule weakening this plan will not allow.
//
// So: a global augmentation, in its own file, declaring only the exact overloads this
// file's two calls need, returning minimal STRUCTURAL shapes (not the real @types/node
// ambient types) — real Node's fs/promises and path modules satisfy these structurally,
// so no cast is needed at the call site in production, and tests injecting the real
// modules (ruling M17 part 2) satisfy them too.

export interface NodeDirentLike {
  name: string;
  isDirectory(): boolean;
  isFile(): boolean;
  isSymbolicLink(): boolean;
}

export interface NodeStatsLike {
  size: number;
  mtimeMs: number;
  isDirectory(): boolean;
  isFile(): boolean;
  isSymbolicLink(): boolean;
}

/** Part 7 Z4: enough of fs.promises' FileHandle to read an executable's first bytes. */
export interface NodeFileHandleLike {
  read(buffer: Uint8Array, offset: number, length: number, position: number): Promise<{ bytesRead: number }>;
  close(): Promise<void>;
}

export interface NodeFsPromisesLike {
  readdir(path: string): Promise<string[]>;
  readdir(path: string, options: { withFileTypes: true }): Promise<NodeDirentLike[]>;
  lstat(path: string): Promise<NodeStatsLike>;
  stat(path: string): Promise<NodeStatsLike>;
  readFile(path: string): Promise<Uint8Array>;
  /** Part 7 Z4/Z5: the executable's and the root's real paths. */
  realpath(path: string): Promise<string>;
  /** Part 7 Z4: opened read-only for the 4-byte native-format check, then closed. */
  open(path: string, flags: 'r'): Promise<NodeFileHandleLike>;
}

/** WP-04.2 NE15: the synchronous real path node-access.ts's realPathOfNearest resolves with. */
export interface NodeRealPathLike {
  realpathSync: { native(path: string): string };
}

export interface NodeFsLike extends NodeRealPathLike {
  promises: NodeFsPromisesLike;
}

export interface NodePathLike {
  resolve(...segments: string[]): string;
  join(...segments: string[]): string;
  relative(from: string, to: string): string;
  /** WP-04.2 NE15: realPathOfNearest's walk up to the nearest existing ancestor. */
  dirname(path: string): string;
  basename(path: string): string;
  sep: string;
}

declare global {
  interface Window {
    require(id: 'node:original-fs'): NodeFsLike;
    require(id: 'node:path'): NodePathLike;
    require(id: string): unknown;
  }
}
