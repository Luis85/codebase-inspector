import { test as base } from 'vitest';
import { createNativeSession, requestedVersion, type NativeBrowser } from './session';
import { captureBrowser, caseDirectory, writeEvidence } from './diagnostics';
import { createInspectorPage, type InspectorPage } from './inspector';
import { withSession } from '../support/session-lifecycle';
import { breadcrumb, hostProcessCounts } from './breadcrumbs';

/** The chromedriver version when the session's capabilities expose one, else the raw browserVersion (GRD1). */
function chromedriverVersion(browser: NativeBrowser): string | undefined {
  const capabilities: { browserVersion?: string; chrome?: { chromedriverVersion?: string } } = browser.capabilities;
  return capabilities.chrome?.chromedriverVersion ?? capabilities.browserVersion;
}

export interface NativeContext {
  browser: NativeBrowser;
  page: ReturnType<NativeBrowser['getObsidianPage']>;
  inspector: InspectorPage;
  directory: string;
}

export const test = base.extend<{ native: NativeContext }>({
  native: async ({ task, signal }, use) => {
    const directory = await caseDirectory(task.id, task.name);
    breadcrumb('case:start', { file: task.file?.filepath, test: task.name, processes: hostProcessCounts() });
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
          node: process.versions.node, uv: process.versions.uv, v8: process.versions.v8,
          chromedriver: chromedriverVersion(browser),
        });
        try {
          await use({ browser, page, inspector: createInspectorPage(browser), directory });
        } finally {
          if (!signal.aborted) await captureBrowser(browser, directory);
        }
      });
      await abortCleanup;
      // The test's own outcome, so a failed case's evidence never reads as clean (Vitest settles it before fixture teardown).
      await writeEvidence(directory, 'teardown', {
        completed: true, testState: task.result?.state ?? 'unknown', errors: (task.result?.errors ?? []).map((error) => error.message),
      });
    } catch (error) {
      await writeEvidence(directory, 'failure', error);
      throw error;
    } finally {
      signal.removeEventListener('abort', cancel);
      breadcrumb('case:end', { test: task.name, state: task.result?.state ?? 'unknown', processes: hostProcessCounts() });
    }
  },
});
