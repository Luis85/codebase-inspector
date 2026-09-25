import { test as base } from 'vitest';
import { createNativeSession, requestedVersion, type NativeBrowser } from './session';
import { captureBrowser, caseDirectory, writeEvidence } from './diagnostics';
import { createInspectorPage, type InspectorPage } from './inspector';
import { withSession } from '../support/session-lifecycle';

export interface NativeContext {
  browser: NativeBrowser;
  page: ReturnType<NativeBrowser['getObsidianPage']>;
  inspector: InspectorPage;
  directory: string;
}

export const test = base.extend<{ native: NativeContext }>({
  native: async ({ task, signal }, use) => {
    const directory = await caseDirectory(task.id, task.name);
    const session = createNativeSession();
    let abortCleanup: Promise<void> | undefined;
    const cancel = (): void => {
      abortCleanup = session.close();
      // Observe immediately; teardown below still awaits and propagates failures.
      void abortCleanup.catch(() => undefined);
    };
    signal.addEventListener('abort', cancel, { once: true });
    if (signal.aborted) cancel();
    try {
      await withSession(session, async browser => {
        const page = browser.getObsidianPage();
        await writeEvidence(directory, 'environment', {
          requestedVersion, appVersion: browser.getObsidianVersion(),
          installerVersion: browser.getObsidianInstallerVersion(),
          platform: process.platform, runner: 'vitest',
          commit: process.env.SOURCE_COMMIT ?? 'local',
          vault: page.getVaultPath(),
        });
        try {
          await use({ browser, page, inspector: createInspectorPage(browser), directory });
        } finally {
          if (!signal.aborted) await captureBrowser(browser, directory);
        }
      });
      await abortCleanup;
      await writeEvidence(directory, 'teardown', { completed: true });
    } catch (error) {
      await writeEvidence(directory, 'failure', error);
      throw error;
    } finally {
      signal.removeEventListener('abort', cancel);
    }
  },
});
