// Gap closure GRA8 (GCO6): resolves the codebase's display name from the profile store for the
// S05 toolbar. `ui` never imports a port, so the host reads the profile and writes the name into
// the leaf's store. It refreshes on demand (open, a completed scan) and whenever the profiles
// slice is written (a rename in Settings); a missing profile or an unreadable store leaves the
// name that is already shown, never blanks it.
import type { Plugin } from 'obsidian';
import { watchPluginData } from '../adapters/storage/plugin-data-shape';
import type { ProfileStore } from '../application/ports/profile-store';

export interface CodebaseNameDeps {
  plugin: Plugin;
  profileStore: ProfileStore;
  /** The leaf's current profile id, read at refresh time (it changes with the first scan). */
  profileId: () => string | null;
  setName: (name: string | undefined) => void;
}

export interface CodebaseNameWiring {
  refresh(): void;
  dispose(): void;
}

export function wireCodebaseName(deps: CodebaseNameDeps): CodebaseNameWiring {
  let generation = 0;
  let disposed = false;

  function refresh(): void {
    const id = deps.profileId();
    if (disposed || id === null) return;
    generation += 1;
    const mine = generation;
    deps.profileStore.get(id).then((profile) => {
      // A later refresh supersedes this one however long this read took.
      if (disposed || mine !== generation || profile === null) return;
      deps.setName(profile.name);
    }, () => { /* an unreadable profile store leaves the name as it was */ });
  }

  const unwatch = watchPluginData(deps.plugin, ['profiles'], refresh);
  return {
    refresh,
    dispose(): void {
      disposed = true;
      unwatch();
    },
  };
}
