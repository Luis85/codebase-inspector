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

  // WP-04 IN51 a / IPF5: a label that is not a substring of any nav item proves this poll
  // can actually fail (RED, this task's report) — 'Investigat' would still match under
  // WDIO's `*=` contains selector and so would never fail.
  test('renders the Investigate route in a real leaf', async ({ native: { inspector } }) => {
    await inspector.openCity();
    await inspector.navigate('Investigate');
    await expect.poll(() => inspector.screen('investigate').isDisplayed()).toBe(true);
    expect(await inspector.screen('investigate').$('.ci-no-snapshot').isExisting()).toBe(true);
    // getHTML, not getText: the nav drawer can close again right after navigate()'s own
    // click, and getText reads "" for an element WebDriver does not consider rendered.
    const sections = inspector.root().$$('.ci-nav__section');
    const groups = await sections.map((s) => s.$('.ci-nav__group').getHTML({ includeSelectorTag: false }));
    const act = sections[groups.indexOf('Act')]!;
    const labels = await act.$$('.ci-nav__label').map((el) => el.getHTML({ includeSelectorTag: false }));
    expect(labels).toEqual(['Investigate', 'Refactor workbench', 'Audit report']);
  });
});
