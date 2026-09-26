/* global WebdriverIO -- a TypeScript-only global namespace (webdriverio, wdio-obsidian-service), used as a type. */
import { existsSync } from 'node:fs';
import { createConnection } from 'node:net';
import { describe, expect, test } from 'vitest';
import { createNativeSession, type NativeBrowser } from './session';
import { withSession } from '../support/session-lifecycle';
import { caseDirectory, writeEvidence } from './diagnostics';

function ownedResources(browser: NativeBrowser) {
  // WDIO exposes requestedCapabilities as any; constrain it to its public capability type.
  const capabilities = browser.requestedCapabilities as WebdriverIO.Capabilities;
  const args = capabilities['goog:chromeOptions']?.args ?? [];
  const config = args.find(value => value.startsWith('--user-data-dir='))?.slice('--user-data-dir='.length);
  const port = browser.options.port;
  const host = browser.options.hostname;
  if (!config || typeof port !== 'number' || !host || !['localhost', '127.0.0.1', '::1'].includes(host)) {
    throw new Error('Expected an owned local driver, profile and copied vault.');
  }
  return { vault: browser.getObsidianPage().getVaultPath(), config, port, host };
}

function connectionRefused(host: string, port: number): Promise<boolean> {
  return new Promise((resolve, reject) => {
    const socket = createConnection({ host, port });
    socket.once('connect', () => { socket.destroy(); resolve(false); });
    socket.once('error', (error: NodeJS.ErrnoException) => {
      socket.destroy();
      if (error.code === 'ECONNREFUSED') resolve(true);
      else reject(error);
    });
    socket.setTimeout(1_000, () => { socket.destroy(); reject(new Error('Driver probe timed out; shutdown is unverified.')); });
  });
}

async function assertReleased(resources: ReturnType<typeof ownedResources>): Promise<void> {
  expect(existsSync(resources.vault)).toBe(false);
  expect(existsSync(resources.config)).toBe(false);
  await expect.poll(() => connectionRefused(resources.host, resources.port), { timeout: 10_000, interval: 100 }).toBe(true);
}

describe('actual standalone session failure cleanup', () => {
  test('releases the app, driver and copied directories after a test body rejects', async ({ task }) => {
    let resources: ReturnType<typeof ownedResources> | undefined;
    const session = createNativeSession();
    await expect(withSession(session, async browser => {
      resources = ownedResources(browser);
      throw new Error('Intentional native body failure');
    })).rejects.toThrow('Intentional native body failure');
    expect(resources).toBeDefined();
    if (!resources) throw new Error('The real session never started.');
    await assertReleased(resources);
    await session.close();
    await writeEvidence(await caseDirectory(task.id, task.name), 'cleanup', { passed: true, phase: 'body' });
  });

  test('releases an acquired real session when final initialization rejects', async ({ task }) => {
    let resources: ReturnType<typeof ownedResources> | undefined;
    const session = createNativeSession(async browser => {
      resources = ownedResources(browser);
      throw new Error('Intentional native readiness failure');
    });
    await expect(session.start()).rejects.toThrow('Intentional native readiness failure');
    expect(resources).toBeDefined();
    if (!resources) throw new Error('The real session was not acquired.');
    await assertReleased(resources);
    await session.close();
    await writeEvidence(await caseDirectory(task.id, task.name), 'cleanup', { passed: true, phase: 'initialization' });
  });
});
