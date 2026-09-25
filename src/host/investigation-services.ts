// WP-04 (IP41): the investigation services, built once in onload and inert until a leaf uses
// them. The notes port registers its vault and metadata-cache events through
// plugin.registerEvent on its first list or subscribe, never in onload (IP12, spec 4.4). The
// preview's root comes from the codebase's LIVE binding on this device (IP14), or, for a codebase
// with no binding at all, from the scanned snapshot's own root (E25); the filesystem
// is built per read and is null where there is no Node filesystem.
import { Platform } from 'obsidian';
import type { Plugin } from 'obsidian';
import { createNodeSourceFileSystem } from '../adapters/filesystem/node-source-filesystem';
import type { InvestigationFolderStore } from '../adapters/storage/plugin-data-investigation-store';
import { createSourcePreview, type SourcePreview } from '../application/investigation/source-preview';
import type { Clock } from '../application/ports/clock';
import type { InvestigationNotesPort } from '../application/ports/investigation-notes-port';
import type { LocalBindingStore } from '../application/ports/local-binding-store';
import type { ProfileStore } from '../application/ports/profile-store';
import type { SourceFileSystemPort } from '../application/ports/source-filesystem-port';
import { createInvestigationNotes } from './investigation-notes';

// IPF1: module-private — main.ts reads the two members structurally, never names these types.
interface InvestigationServices { readonly notes: InvestigationNotesPort; readonly preview: SourcePreview }
interface InvestigationServiceDeps {
  readonly profileStore: ProfileStore; readonly bindingStore: LocalBindingStore;
  readonly folders: InvestigationFolderStore; readonly clock: Clock;
}

function nodeFilesystem(): SourceFileSystemPort | null {
  try { return createNodeSourceFileSystem(); } catch { return null; }
}

export function createInvestigationServices(plugin: Plugin, deps: InvestigationServiceDeps): InvestigationServices {
  // WP-04 E25 (amends IP14): a profile with no binding (scan-codebase's own, bindingId null) is
  // `unbound`, and the preview reads under the in-memory snapshot's approved root; a binding id
  // whose record this device lacks stays null (no-binding).
  const resolveRoot = async (codebaseId: string): Promise<string | null | { readonly unbound: true }> => {
    const profile = await deps.profileStore.get(codebaseId);
    if (profile === null) return null;
    if (profile.bindingId === null) return { unbound: true };
    return (await deps.bindingStore.get(profile.bindingId))?.rootPath ?? null;
  };
  return {
    notes: createInvestigationNotes(plugin.app, {
      folders: deps.folders, profiles: deps.profileStore, clock: deps.clock,
      registerEvent: (ref) => { plugin.registerEvent(ref); },
    }),
    // Windows and macOS default filesystems are case-insensitive; Linux is not (the same
    // signal investigation-notes.ts uses for its own containment).
    preview: createSourcePreview({ getFilesystem: nodeFilesystem, resolveRoot, clock: deps.clock, caseSensitive: Platform.isLinux }),
  };
}
