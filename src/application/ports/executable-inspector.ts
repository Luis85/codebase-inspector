// Part 7 Z4/Z5: what is known about the executable before anything runs. The adapter
// (src/adapters/fallow/executable-inspector.ts) stats it and reads its first 4 bytes; it
// never executes it.
export type ExecutableFormat = 'pe' | 'elf' | 'mach-o';

export interface ExecutableFacts {
  /** The normalised absolute path, as bound and as shown. */
  executablePath: string;
  realPath: string;
  size: number;
  mtimeMs: number;
  format: ExecutableFormat;
  /** Z5 (K22): inside the analysed root, by its path, its real path, or the root's real path. */
  insideRoot: boolean;
}

export type ExecutableRefusal =
  | 'not-absolute' | 'wrong-name' | 'launcher' | 'executable-missing' | 'not-a-file' | 'not-native' | 'unreadable';

/** `detail` is data for the copy: the expected name for `wrong-name` and `launcher`, the
 *  error code for `unreadable`, '' otherwise. */
export type ExecutableInspection =
  | { ok: true; facts: ExecutableFacts }
  | { ok: false; refusal: ExecutableRefusal; detail: string };

export interface ExecutableInspectorPort {
  inspect(executablePath: string, rootPath: string): Promise<ExecutableInspection>;
  /** The only accepted base name on this platform, for the path hint (Z22, K41). */
  readonly executableName: 'fallow.exe' | 'fallow';
}
