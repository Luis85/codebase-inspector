// WP-04 Task 8 (IPF11): an in-memory InvestigationFolderStore double for component and
// host tests. Harness-safe: no `vitest`, no `node:*` (Task 17's browser harness bundles
// this file directly, the same requirement fake-vault.ts documents at its own head).
import type { InvestigationFolderStore } from '../../src/adapters/storage/plugin-data-investigation-store';

export function createFakeInvestigationFolders(
  initial: Record<string, string> = {},
): InvestigationFolderStore & { readonly folders: Map<string, string> } {
  const folders = new Map<string, string>(Object.entries(initial));
  return {
    folders,
    read: (profileId) => Promise.resolve(folders.get(profileId) ?? null),
    write: (profileId, folder) => {
      folders.set(profileId, folder);
      return Promise.resolve();
    },
    purge: (profileId) => {
      folders.delete(profileId);
      return Promise.resolve();
    },
  };
}
