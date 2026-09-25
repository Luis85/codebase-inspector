import { describe, expect } from 'vitest';
import { test } from './fixture';
import { CITY_VIEW_TYPE, PLUGIN_ID } from './session';

describe('codebase-inspector in the real Obsidian host', () => {
  test('loads the plugin without errors and opens the inspector on its default route', async ({ native: { browser, page, inspector } }) => {
    await page.disablePlugin(PLUGIN_ID);
    await inspector.recordErrors();
    await page.enablePlugin(PLUGIN_ID);
    await inspector.openCity();
    await expect.poll(() => inspector.screen('overview').isDisplayed()).toBe(true);
    expect(await browser.executeObsidian(({ app }, type) => app.workspace.getLeavesOfType(type).length, CITY_VIEW_TYPE)).toBe(1);
    expect(await inspector.errors()).toEqual([]);
  });
});
