/* global WebdriverIO -- a TypeScript-only global namespace (webdriverio, wdio-obsidian-service), used as a type. */
import { resolve } from 'node:path';
import { remote } from 'webdriverio';
import ObsidianWorkerService, { launcher, type startWdioSession } from 'wdio-obsidian-service';
import { SessionLifecycle } from '../support/session-lifecycle';

export type NativeBrowser = Awaited<ReturnType<typeof startWdioSession>>;
type SessionConfig = Parameters<typeof startWdioSession>[0];

export const PLUGIN_ID = 'codebase-inspector';
export const CITY_VIEW_TYPE = 'codebase-inspector-city';
/** IN49 (IP47): the earliest public release satisfying manifest.json's minAppVersion (1.13.0 was never
 *  published); `latest` on request. Never downgraded. tests/unit/native-baseline.test.ts pins
 *  NATIVE_BASELINE_VERSION >= minAppVersion, so a raised minAppVersion fails fast. */
export const NATIVE_BASELINE_VERSION = '1.13.4';
export const requestedVersion = process.env.OBSIDIAN_VERSION ?? NATIVE_BASELINE_VERSION;

export function createNativeSession(afterReady: (browser: NativeBrowser) => Promise<void> = () => Promise.resolve()): SessionLifecycle<NativeBrowser> {
  const capabilities: WebdriverIO.Capabilities = {
    browserName: 'obsidian',
    'wdio:obsidianOptions': {
      appVersion: requestedVersion, installerVersion: 'latest',
      plugins: [resolve('dist')], vault: resolve('tests/e2e/vault'), copy: true,
    },
  };
  const config: SessionConfig = {
    capabilities, cacheDir: resolve('.obsidian-cache'),
    logLevel: 'warn', waitforTimeout: 10_000, waitforInterval: 100,
    connectionRetryTimeout: 30_000, connectionRetryCount: 0,
  };
  // describe's version-pinned seam (IN42): startWdioSession()'s own sequence, keeping the
  // worker so afterSession() runs on success AND on partial failure.
  const preparation = new launcher({}, capabilities, config);
  const worker = new ObsidianWorkerService({}, capabilities, config);
  return new SessionLifecycle({
    async prepare() {
      await preparation.onPrepare(config, [capabilities]);
      await worker.beforeSession(config, capabilities);
    },
    connect: () => remote(config),
    async initialize(browser) {
      await worker.before(capabilities, [], browser);
      await afterReady(browser);
    },
    disconnect: (browser) => browser.deleteSession(),
    cleanup: () => worker.afterSession(),
  });
}
