// WP-04 Task 8 (IN18, IN19, IP27, IP42): the durable data.json `investigations` slice,
// `{ [profileId]: { folder } }`. IP42: the store TYPE lives HERE -- it is an adapter type
// used only by the host (settings-tab.ts), never a real application port. Every write is
// ONE writePluginDataSlice under the plugin-wide data lock, mirroring plugin-data-
// analyzer-store.ts's own pattern (analyzer-record.ts's ownEntry/withoutEntry): own keys
// only, `hasOwnProperty.call`, never `in`; a new object, never an in-place edit. The
// folder is shape-checked with zod on both read (IN19: a hand-edited or malformed entry
// is never used -- the caller's default applies instead) and write (defensive, mirrors
// analyzer-record.ts's withEntry -> RECORD.parse). PF-C12: the bound counts CODE POINTS
// (`Array.from(v).length`), matching validateNoteFolder (note-path.ts), never zod's own
// `.max()` (UTF-16 code units).
import { z } from 'zod';
import type { Plugin } from 'obsidian';
import { isPlainObject } from '../../domain/plain-data';
import { NOTE_FOLDER_MAX } from '../../application/investigation/note-path';
import { readPluginData, writePluginDataSlice } from './plugin-data-shape';

export interface InvestigationFolderStore {
  /** null: never set, or the entry fails the shape check -- the caller's default applies (IN19). */
  read(profileId: string): Promise<string | null>;
  /** The caller validates the folder first (IN19); this stores it verbatim. */
  write(profileId: string, folder: string): Promise<void>;
  /** Profile removal (IN18, IP27). The notes already created stay in the vault. */
  purge(profileId: string): Promise<void>;
}

const ENTRY = z.object({
  folder: z.string().min(1).refine((v) => Array.from(v).length <= NOTE_FOLDER_MAX, {
    error: `folder must be ${NOTE_FOLDER_MAX} code points or fewer`,
  }),
}).strict();

function ownEntry(slice: Record<string, unknown>, profileId: string): unknown {
  return Object.prototype.hasOwnProperty.call(slice, profileId) ? slice[profileId] : undefined;
}

function withoutEntry(slice: Record<string, unknown>, profileId: string): Record<string, unknown> {
  return Object.fromEntries(Object.entries(slice).filter(([key]) => key !== profileId));
}

function decodeFolder(slice: unknown, profileId: string): string | null {
  if (!isPlainObject(slice)) return null;
  const entry = ownEntry(slice, profileId);
  if (entry === undefined) return null;
  const parsed = ENTRY.safeParse(entry);
  return parsed.success ? parsed.data.folder : null;
}

/** The new `investigations` value after one write (`folder`) or purge (`folder === null`).
 *  Pure: it never mutates `slice`. Polish E7: writing the value already stored, or
 *  purging an entry that is not there, returns `slice` UNCHANGED (the same reference), so
 *  writePluginDataSlice saves nothing. */
function applyFolder(slice: unknown, profileId: string, folder: string | null): unknown {
  if (folder === null) {
    if (!isPlainObject(slice) || ownEntry(slice, profileId) === undefined) return slice;
    return withoutEntry(slice, profileId);
  }
  if (decodeFolder(slice, profileId) === folder) return slice;
  const base: Record<string, unknown> = isPlainObject(slice) ? slice : {};
  return { ...withoutEntry(base, profileId), [profileId]: ENTRY.parse({ folder }) };
}

export function createPluginDataInvestigationStore(plugin: Plugin): InvestigationFolderStore {
  return {
    async read(profileId) {
      const data = await readPluginData(plugin);
      return decodeFolder(data.investigations, profileId);
    },
    write: (profileId, folder) =>
      writePluginDataSlice(plugin, 'investigations', (current) => applyFolder(current, profileId, folder)),
    purge: (profileId) =>
      writePluginDataSlice(plugin, 'investigations', (current) => applyFolder(current, profileId, null)),
  };
}
