// The shared start of the note scenarios (notes-index, notes-refresh and notes-root): the spine's own setup, and the
// city leaf's snapshot as its store holds it.
import { expect } from 'vitest';
import type { NativeContext } from './fixture';
import { CITY_VIEW_TYPE } from './session';
import { CYCLE_ANCHOR, RECORDING, copyProject, cycleFinding } from './workspace-files';

/** What the city leaf's own Pinia city store holds (CityView's `cityStore`, private in TypeScript, read at runtime). */
export interface StoreSnapshot { snapshotId: string; rootPath: string; files: string[] }

/** The snapshot the city leaf shows, from the leaf's own city store: its id, its scope's root and its file entities'
 *  root-relative paths, sorted. */
export const storeSnapshot = (browser: NativeContext['browser']): Promise<StoreSnapshot> => browser.executeObsidian(({ app }, type): StoreSnapshot => {
  type Entity = { kind: string; path: string };
  type Held = { snapshotId: string; scope: { rootPath: string }; entities: Entity[] };
  const view = app.workspace.getLeavesOfType(type)[0]?.view as unknown as { cityStore?: { snapshot: Held | null } } | undefined;
  const snapshot = view?.cityStore?.snapshot;
  if (!snapshot) throw new Error('the city leaf holds no snapshot');
  return {
    snapshotId: snapshot.snapshotId, rootPath: snapshot.scope.rootPath,
    files: snapshot.entities.filter((e) => e.kind === 'file').map((e) => e.path).sort(),
  };
}, CITY_VIEW_TYPE);

/** `code/` copied into the vault and scanned through the plugin's own modals (vault-folder mode), the recording
 *  imported and the import cycle selected. Returns the cycle's finding id. */
export async function cycleSelected({ browser, page, inspector }: NativeContext): Promise<string> {
  copyProject(page.getVaultPath(), 'code');
  await expect.poll(() => browser.executeObsidian(({ app }) => app.vault.adapter.exists('code/src/core/a.ts'))).toBe(true);
  const { id } = cycleFinding();
  await inspector.openCity();
  await inspector.scanFolder('code');
  await inspector.importReport(RECORDING);
  await inspector.selectFinding(id);
  return id;
}

/** `cycleSelected`, then a note created for the cycle, linked through Obsidian's own metadata cache. Returns the
 *  note's path, its fingerprint and the snapshot id the note was created against. */
export async function noteForCycle(native: NativeContext): Promise<{ path: string; fingerprint: string; snapshot: string | null }> {
  const { inspector } = native;
  const fingerprint = `${CYCLE_ANCHOR}#${await cycleSelected(native)}`;
  const path = await inspector.createNote();
  await expect.poll(() => inspector.cachedFingerprint(path)).toBe(fingerprint);
  return { path, fingerprint, snapshot: await inspector.snapshotId() };
}
