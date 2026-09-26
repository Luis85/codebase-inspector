// The shared start of the note scenarios (notes-index.e2e.ts, notes-refresh.e2e.ts): the spine's own setup.
import { expect } from 'vitest';
import type { NativeContext } from './fixture';
import { CYCLE_ANCHOR, RECORDING, copyProject, cycleFinding } from './workspace-files';

/** `code/` scanned through the plugin's own modals, the recording imported, the import cycle selected and a note
 *  created for it, linked through Obsidian's own metadata cache. Returns the note's path, its fingerprint and the
 *  snapshot id the note was created against. */
export async function noteForCycle({ browser, page, inspector }: NativeContext): Promise<{ path: string; fingerprint: string; snapshot: string | null }> {
  copyProject(page.getVaultPath(), 'code');
  await expect.poll(() => browser.executeObsidian(({ app }) => app.vault.adapter.exists('code/src/core/a.ts'))).toBe(true);
  const { id } = cycleFinding();
  const fingerprint = `${CYCLE_ANCHOR}#${id}`;
  await inspector.openCity();
  await inspector.scanFolder('code');
  await inspector.importReport(RECORDING);
  await inspector.selectFinding(id);
  const path = await inspector.createNote();
  await expect.poll(() => inspector.cachedFingerprint(path)).toBe(fingerprint);
  return { path, fingerprint, snapshot: await inspector.snapshotId() };
}
