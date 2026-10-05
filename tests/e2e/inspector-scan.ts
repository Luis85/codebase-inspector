// Gap closure GRD6: the scan steps of the inspector page, spread into createInspectorPage the way inspector-fallow.ts
// is. The source modal and the scope modal live here, shared by inspector.ts's scanFolder and by scanFolderNoWait,
// which returns once Scan is pressed and leaves the run going. IPF20: selectors only, never Obsidian's own UI text.
import { expect } from 'vitest';
import type { NativeBrowser } from './session';

/** The source modal's two modes a test drives: a vault folder, or an absolute path (the modal's `external`). */
export type ConnectMode = 'vault-folder' | 'absolute';

export function createScanSteps(browser: NativeBrowser, activateCity: () => Promise<void>) {
  // One selector per call, so a modal that is still closing never scopes the search.
  const inModal = (selector: string) => browser.$(`.modal-container ${selector}`);
  /** The source modal: the mode, the folder, Continue. */
  const chooseSource = async (folder: string, mode: ConnectMode): Promise<void> => {
    const [value, field] = mode === 'vault-folder' ? ['vault-folder', 'vault-folder-path'] : ['external', 'external-path'];
    const radio = inModal(`input[type="radio"][name="source-mode"][value="${value}"]`);
    // A command that did nothing fails here, by name, rather than as a missing element.
    await expect.poll(() => radio.isExisting()).toBe(true);
    await radio.click();
    await inModal(`[data-field="${field}"]`).setValue(folder);
    await inModal('[data-action="continue"]').click();
  };
  /** The scope modal (it must open): the acknowledgement, then Scan once it is enabled. */
  const approveScope = async (): Promise<void> => {
    const acknowledge = inModal('[data-field="acknowledge"]');
    await expect.poll(() => acknowledge.isExisting()).toBe(true);
    await acknowledge.click();
    const scan = inModal('[data-action="confirm-scan"]');
    await expect.poll(() => scan.isEnabled()).toBe(true);
    await scan.click();
  };
  return {
    inModal,
    chooseSource,
    approveScope,
    /** scanFolder's steps (`scan-codebase`, the source modal in vault-folder mode, the scope modal's Scan) without
     *  waiting for the snapshot: the caller observes the run itself, e.g. through `cancel-scan`'s checkCallback. */
    async scanFolderNoWait(folder: string): Promise<void> {
      await activateCity();
      await browser.executeObsidianCommand('codebase-inspector:scan-codebase');
      await chooseSource(folder, 'vault-folder');
      await approveScope();
    },
  };
}
