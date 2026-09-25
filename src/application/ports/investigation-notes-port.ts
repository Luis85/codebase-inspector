// WP-04 §3 (IP12): the one application port for investigation notes. Eight members: the
// spec's five (list, create, refresh, open, subscribe) plus destination, plan and
// sourceNotePath. `plan` validates and names WITHOUT writing (IN26, IN27); only `create`
// and `refresh` write (IN35), and nothing is written outside the chosen notes folder, or to
// an existing note whose frontmatter links it to this codebase. The host implementation is
// src/host/investigation-notes.ts.
import type { NoteFolderProblem, NoteNameProblem } from '../investigation/note-path';
import type { NoteIdentity } from '../investigation/note-model';
import type { NoteIndex } from '../investigation/note-index';

/** IN18: the codebase's folder setting, or its default when none is stored (IP11). */
export interface NoteDestination { readonly folder: string; readonly isDefault: boolean }

/** IN26–IN29: what a create would write, decided before anything is written. `folder` is the
 *  canonical folder (existing segments in their own case, IP9); `renamed` is true when the
 *  requested name was taken and a ` (n)` suffix was added; `overlapsRoot` is true when the
 *  folder, joined to the vault base path, is inside the codebase root, and
 *  `rootRelativeFolder` is its path relative to that root, or null when it IS the root (IP26). */
export type DestinationPlan =
  | { readonly status: 'ok'; readonly folder: string; readonly fileName: string; readonly path: string; readonly renamed: boolean;
      readonly overlapsRoot: boolean; readonly rootRelativeFolder: string | null }
  | { readonly status: 'invalid-folder'; readonly problem: NoteFolderProblem }
  | { readonly status: 'invalid-name'; readonly problem: NoteNameProblem }
  | { readonly status: 'folder-is-file' }
  | { readonly status: 'no-free-name' };

export interface CreateNoteRequest {
  readonly identity: NoteIdentity; readonly folder: string; readonly baseName: string; readonly body: string;
  readonly excludeFolder: boolean; readonly rootPath: string | null;
}

export type CreateNoteResult =
  | { readonly status: 'created'; readonly path: string; readonly exclusion: 'added' | 'already' | 'not-requested' | 'failed' }
  | { readonly status: 'refused'; readonly reason: 'invalid' | 'exists' | 'write-failed' };

export interface RefreshNoteRequest {
  readonly path: string; readonly codebaseId: string; readonly block: string; readonly snapshotId: string; readonly sourcePath: string;
}

/** WP-04 E15/E17: `'partial'` — the block was replaced but the frontmatter update failed, so
 *  the note DID change (never reported as "nothing changed"). */
export type RefreshNoteResult = 'refreshed' | 'partial' | 'markers-edited' | 'missing' | 'not-linked' | 'write-failed';

export interface InvestigationNotesPort {
  destination(codebaseId: string): Promise<NoteDestination>;
  plan(folder: string, baseName: string, rootPath: string | null): DestinationPlan;
  list(codebaseId: string): NoteIndex;
  create(request: CreateNoteRequest): Promise<CreateNoteResult>;
  refresh(request: RefreshNoteRequest): Promise<RefreshNoteResult>;
  open(path: string): Promise<boolean>;
  /** IN12: the vault path of a `.md` file under `rootPath` that the vault holds, else null. */
  sourceNotePath(rootPath: string, relativePath: string): string | null;
  subscribe(listener: () => void): () => void;
}
