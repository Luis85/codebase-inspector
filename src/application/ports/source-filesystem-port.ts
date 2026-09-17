import type { CancellationToken } from './cancellation-token';

// WalkEntry's 'file' | 'directory' variant and its four fields, and the 'skipped'
// variant's relativePath/reason fields, are verbatim from the task-5 brief's "Produces"
// list — do not paraphrase a field out of it. A 'skipped' entry deliberately carries no
// byteSize: once the walker gives up on an entry (symlink, oversized, binary,
// unreadable), NEITHER metric is knowable from it, which is what makes "unavailable is
// never 0, for both metrics" (acceptance criterion 8) fall out of the type itself rather
// than of collector logic.
//
// `wasDirectory` (fix-round-1 MINOR finding 7) is an ADDITIVE, optional field, not a
// paraphrase of anything the brief specified: an unreadable directory (its own readdir
// failing) or a directory sitting at the walk's maxDepth limit both produce a 'skipped'
// entry, and without this discriminator the collector had no way to tell that entry
// apart from a skipped FILE — it built a `kind: 'file'` CodeEntity, complete with a file
// category, for what was actually a directory. Absent/false means "this was a file-like
// thing" (the only case that existed before this fix), so every pre-existing producer
// and consumer of a 'skipped' entry that never sets or reads this field keeps working
// unchanged.
export type WalkEntry =
  | { kind: 'file' | 'directory'; absolutePath: string; relativePath: string; byteSize: number }
  | { kind: 'skipped'; relativePath: string; reason: string; wasDirectory?: boolean };

/** The scan's tunable inputs, everything `walk` needs besides the root itself (the root
 *  is `AnalysisScope.rootPath`, passed as `walk`'s first argument so it is never
 *  duplicated between the scope and this options object). `maxDepth`/`maxEntries` are
 *  the bounded walk's own limits (design decision, not part of any frozen §4 contract):
 *  generous enough that "deep nesting beyond 20 levels" (acceptance criterion 1) is
 *  nowhere near either bound, but finite, so a pathological or adversarial tree (a
 *  symlink loop the walker would refuse to follow anyway, or a directory bomb) cannot
 *  run the scan forever. */
export interface WalkOptions {
  exclusions: readonly string[];
  maxFileBytes: number;
  followSymlinks: false;
  maxDepth?: number;
  maxEntries?: number;
}

/** What `readText` returns for one file. Mirrors `Observation.status`'s vocabulary
 *  deliberately (the collector maps this directly onto an Observation) but is declared
 *  independently here: the application layer must not import `src/domain/model` just to
 *  borrow a string literal type. `bytes` is carried alongside `text` so the collector can
 *  compute the byte-size observation through the domain's own `byteSize()` (task 2)
 *  rather than trusting a number an adapter merely reports. */
export type ReadResult =
  | { status: 'ok'; text: string; bytes: Uint8Array }
  | { status: 'unavailable'; reason: string };

export interface StatResult {
  exists: boolean;
  isDirectory: boolean;
  isFile: boolean;
  isSymbolicLink: boolean;
  size: number;
  mtimeMs: number;
}

/** The one filesystem port every task-5 file speaks through. `readLog()` is not
 *  instrumentation for convenience — it is the mechanism that lets the read-log proof
 *  (tests/integration/read-log.test.ts) assert the ABSENCE of a read for an excluded
 *  path, rather than merely the absence of a method that could have read it. */
export interface SourceFileSystemPort {
  walk(root: string, opts: WalkOptions, token: CancellationToken): AsyncIterable<WalkEntry>;
  readText(absPath: string, maxBytes: number): Promise<ReadResult>;
  stat(absPath: string): Promise<StatResult>;
  readLog(): readonly string[];
}
