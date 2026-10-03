// WP-04.2 spec §5 rows 10–14 (NE9) and polish row 38 (PN4): the plugin's settings tab in the real settings renderer.
// NPF7: the settings render in their own window, so every `pluginData` read happens before openPluginSettings or
// after closeSettings (scenarios 38 and 41 switch to the main window with the settings still open, for a write elsewhere).
// Scenario 41 (gap closure GRD3, Ruling E1) reads the settings search through `app.setting`, from the main window.
// Observed here: a Notice the tab raises, and the source and clear-binding modals it opens, all render in the
// settings window. IPF20: the plugin's own words only through its copy constants; everything else by selector.
import { describe, expect } from 'vitest';
import { Key } from 'webdriverio';
import { defaultNoteFolder } from '../../src/application/investigation/note-path';
import { exclusionInputReasons } from '../../src/domain/validator';
import { NOTES_FOLDER_PROBLEM, NOTES_FOLDER_SETTING_NAME } from '../../src/ui/audit-copy/investigation';
import { writeEvidence } from './diagnostics';
import { test } from './fixture';
import { closeSettings, onlyProfile, openPluginSettings, pluginData, savedBindings, savedProfiles } from './host-probes';
import { PLUGIN_ID, type NativeBrowser } from './session';
import { copyProject } from './workspace-files';

const LIST = '.modal.mod-settings .setting-group.mod-list';
const SCOPE_MODAL = '.modal-container [data-field="acknowledge"]';
/** Observed: the profile page and its modals slide in, and their buttons are not interactable until they have. */
async function clickWhenClickable(element: () => ReturnType<NativeBrowser['$']>): Promise<void> {
  await expect.poll(() => element().isClickable()).toBe(true);
  await element().click();
}

/** Scenario 38: switches WebDriver to the window holding the Obsidian app WITHOUT closing the settings (NPF7:
 *  `executeObsidian` works only there); the settings window's handle is `settingsWindow`. */
async function switchToMainWindow(browser: NativeBrowser, settingsWindow: string): Promise<void> {
  for (const handle of await browser.getWindowHandles()) {
    if (handle === settingsWindow) continue;
    await browser.switchToWindow(handle);
    if (await browser.execute(() => typeof (window as unknown as { app?: unknown }).app === 'object')) return;
  }
  throw new Error('no window holds the Obsidian app');
}

type OpenTab = {
  id?: string;
  investigations?: { write(profileId: string, folder: string): Promise<void> };
  profileStore?: { update(profileId: string, mutate: (profile: { name: string }) => { name: string }): Promise<void> };
  entries?: { profile: { profileId: string; name: string }; investigationFolder: string }[];
};
/** Scenario 38's write elsewhere, from the main window: the plugin's one investigation folder store (main.ts passes
 *  its instance to the tab; the plugin instance holds none) writes the watched `investigations` slice through
 *  writePluginDataSlice, so the NE9 watcher hears it. Reached through probe f's `app.setting.activeTab`. */
async function writeNotesFolderElsewhere(browser: NativeBrowser, profileId: string, folder: string): Promise<void> {
  await browser.executeObsidian(async ({ app }, id, profile, value) => {
    const tab = (app as unknown as { setting: { activeTab?: OpenTab | null } }).setting.activeTab;
    if (tab?.id !== id || tab.investigations === undefined) throw new Error(`the open settings tab is not ${id}`);
    await tab.investigations.write(profile, value);
  }, PLUGIN_ID, profileId, folder);
}

/** The notes folder the open tab's last refresh() read for `profileId` (from the main window). refresh() stores what
 *  it read and asks for the render in the same task, so once this shows a write, the refresh that heard it has asked. */
function tabNotesFolder(browser: NativeBrowser, profileId: string): Promise<string | null> {
  return browser.executeObsidian(({ app }, profile) => {
    const tab = (app as unknown as { setting: { activeTab?: OpenTab | null } }).setting.activeTab;
    return tab?.entries?.find((entry) => entry.profile.profileId === profile)?.investigationFolder ?? null;
  }, profileId);
}

/** Scenario 41 (Ruling Gap-closure E1): a rename elsewhere, from the main window, through the open tab's private
 *  profile store (the polish E5 precedent). A page's name is in Obsidian's settings search index; a row's value is not. */
async function renameElsewhere(browser: NativeBrowser, profileId: string, name: string): Promise<void> {
  await browser.executeObsidian(async ({ app }, id, profile, value) => {
    const tab = (app as unknown as { setting: { activeTab?: OpenTab | null } }).setting.activeTab;
    if (tab?.id !== id || tab.profileStore === undefined) throw new Error(`the open settings tab is not ${id}`);
    await tab.profileStore.update(profile, (saved) => ({ ...saved, name: value }));
  }, PLUGIN_ID, profileId, name);
}

/** The profile name the open tab's last refresh() read for `profileId` (from the main window). */
function tabProfileName(browser: NativeBrowser, profileId: string): Promise<string | null> {
  return browser.executeObsidian(({ app }, profile) => {
    const tab = (app as unknown as { setting: { activeTab?: OpenTab | null } }).setting.activeTab;
    return tab?.entries?.find((entry) => entry.profile.profileId === profile)?.profile.name ?? null;
  }, profileId);
}

const SEARCH = '.modal.mod-settings .setting-search-container input[type="search"]';
const SEARCH_RESULTS = '.modal.mod-settings .setting-search-results';
type SearchItem = { tab: { id: string }; isPage?: boolean; el: HTMLElement };
type SettingsSearch = {
  activeTab?: { id?: string } | null; searchNavItems?: SearchItem[]; pluginTabs?: { id: string; settingItems?: { name?: string; items?: { name?: string }[] }[] }[];
};
/** Scenario 41, from the main window (probed on 1.13.4): the settings search's nav items for our tab's page named
 *  `name` (its result group's header item; `name` is test data), the open tab, and what our tab's update() stored. */
function searchState(browser: NativeBrowser, name: string): Promise<{ ourPage: number; activeTab: string | null; storedPages: string[]; settingItems: number }> {
  return browser.executeObsidian(({ app }, id, page) => {
    const setting = (app as unknown as { setting: SettingsSearch }).setting;
    const stored = setting.pluginTabs?.find((tab) => tab.id === id)?.settingItems ?? [];
    return {
      ourPage: (setting.searchNavItems ?? []).filter((item) => item.tab.id === id && item.isPage === true
        && item.el.querySelector('.setting-search-result-tab-label')?.textContent === page).length,
      activeTab: setting.activeTab?.id ?? null,
      storedPages: stored.flatMap((item) => (item.items ?? []).map((child) => child.name ?? '')),
      settingItems: stored.length,
    };
  }, PLUGIN_ID, name);
}

/** Scenario 41: types `query` into the settings search (settings window) and waits until it shows results for it. */
async function searchSettings(browser: NativeBrowser, query: string): Promise<number> {
  await expect.poll(() => browser.$(SEARCH).isClickable()).toBe(true);
  await browser.$(SEARCH).click();
  await browser.$(SEARCH).addValue(query);
  await expect.poll(async () => await browser.$(SEARCH).getValue() === query && await browser.$(SEARCH_RESULTS).isDisplayed()).toBe(true);
  return browser.$$(`${SEARCH_RESULTS} .setting-search-result-group`).length;
}

/** Scenario 41: empties the settings search (settings window); the tab list shows again. */
async function clearSettingsSearch(browser: NativeBrowser): Promise<void> {
  await browser.$(SEARCH).click();
  await browser.keys([Key.Ctrl, 'a']);
  await browser.keys(Key.Backspace);
  await expect.poll(() => browser.$(SEARCH_RESULTS).isDisplayed()).toBe(false);
}

describe('the settings tab in the real settings renderer (WP-04.2 NE9)', () => {
  test('the settings tab renders each saved codebase in the real settings renderer', async ({ native: { browser, page, inspector } }) => {
    copyProject(page.getVaultPath(), 'code');
    await inspector.openCity();
    // Positive control: the same renderer, before any codebase exists, renders its list with no profile.
    await openPluginSettings(browser);
    await expect.poll(() => browser.$(LIST).isExisting()).toBe(true);
    expect(await inspector.settingsProfileNames()).toEqual([]);
    await closeSettings(browser);
    await inspector.scanFolder('code');
    const profile = onlyProfile(await pluginData(browser));
    await inspector.openCodebaseSettings(profile.name);
    const shown = inspector.settingsPage();
    // The page's first row is the name; then Excluded paths (the page's one textarea), the notes folder and Connect.
    expect(await shown.$('.setting-item input[type="text"]').getValue()).toBe(profile.name);
    expect(await shown.$('textarea').getValue()).toBe(profile.exclusions.join('\n'));
    expect(await inspector.settingsRow(NOTES_FOLDER_SETTING_NAME).$('input').getValue()).toBe(defaultNoteFolder(profile.name));
    expect(await shown.$('[data-action="connect"]').isExisting()).toBe(true);
    await closeSettings(browser);
  });

  test('the settings tab lists a codebase that scan-codebase created', async ({ native: { browser, page, inspector } }) => {
    copyProject(page.getVaultPath(), 'code');
    await inspector.openCity();
    // Positive control: the tab renders, and has no codebase yet.
    await openPluginSettings(browser);
    await expect.poll(() => browser.$(LIST).isExisting()).toBe(true);
    expect(await inspector.settingsProfileNames()).toEqual([]);
    await closeSettings(browser);
    await inspector.scanFolder('code');
    const profile = onlyProfile(await pluginData(browser));
    // No plugin reload: the tab follows a write it did not make.
    await openPluginSettings(browser);
    await expect.poll(() => inspector.settingsProfileNames()).toEqual([profile.name]);
    await closeSettings(browser);
  });

  test('the notes folder setting saves a valid folder and refuses an invalid one with its reason', async ({ native: { browser, page, inspector } }) => {
    copyProject(page.getVaultPath(), 'code');
    const configDir = await page.getConfigDir();
    await inspector.openCity();
    await inspector.scanFolder('code');
    const profile = onlyProfile(await pluginData(browser));
    const folder = () => inspector.settingsRow(NOTES_FOLDER_SETTING_NAME).$('input');
    await inspector.openCodebaseSettings(profile.name);
    await inspector.editSetting(folder, `${configDir}/x`);
    await expect.poll(async () => (await inspector.notices()).some((text) => text.includes(NOTES_FOLDER_PROBLEM['config-dir']))).toBe(true);
    await expect.poll(() => folder().getValue()).toBe(defaultNoteFolder(profile.name));
    await closeSettings(browser);
    expect((await pluginData(browser)).investigations).toBeUndefined();
    // Positive control: a valid folder is saved, and shown again after the settings reopen.
    await inspector.openCodebaseSettings(profile.name);
    await inspector.editSetting(folder, 'Research/notes');
    await closeSettings(browser);
    await expect.poll(async () => ((await pluginData(browser)).investigations as Record<string, { folder?: string }> | undefined)?.[profile.profileId]?.folder)
      .toBe('Research/notes');
    await inspector.openCodebaseSettings(profile.name);
    expect(await folder().getValue()).toBe('Research/notes');
    await closeSettings(browser);
  });

  test('an excluded-paths change is saved, a refused one names its reason, and the next scan asks for approval', async ({ native: { browser, page, inspector } }) => {
    copyProject(page.getVaultPath(), 'code');
    await inspector.openCity();
    await inspector.scanFolder('code');
    // Positive control: an unchanged rescan asks nothing (a new snapshot, no scope modal).
    await inspector.rescan();
    expect(await browser.$(SCOPE_MODAL).isExisting()).toBe(false);
    const profile = onlyProfile(await pluginData(browser));
    const excluded = () => inspector.settingsPage().$('textarea');
    const saved = [...profile.exclusions, 'dist2'];
    await inspector.openCodebaseSettings(profile.name);
    await inspector.editSetting(excluded, saved.join('\n'));
    await closeSettings(browser);
    await expect.poll(async () => savedProfiles(await pluginData(browser))[0]?.exclusions).toEqual(saved);
    // Two refused lines, each with its reason in one Notice; the stored value unchanged and shown again. `dist*` is
    // refused only at this input boundary (M62: a stored record may hold it), `./dist` by the stored-record rules too.
    const refused = [...saved, './dist', 'dist*'];
    // validationFailureText's own join of a ValidationError's reasons, without naming the field (IPF20).
    const reason = exclusionInputReasons(refused).join(' ');
    expect(exclusionInputReasons(refused)).toHaveLength(2);
    await inspector.openCodebaseSettings(profile.name);
    await inspector.editSetting(excluded, refused.join('\n'));
    await expect.poll(async () => (await inspector.notices()).some((text) => text.includes(reason))).toBe(true);
    await expect.poll(() => excluded().getValue()).toBe(saved.join('\n'));
    await closeSettings(browser);
    expect(savedProfiles(await pluginData(browser))[0]?.exclusions).toEqual(saved);
    // The saved change is a new scope: scan-codebase asks for approval again.
    await inspector.activateCity();
    await browser.executeObsidianCommand('codebase-inspector:scan-codebase');
    await expect.poll(() => browser.$(SCOPE_MODAL).isExisting()).toBe(true);
  });

  test('Connect binds a codebase to a vault folder and Clear binding asks before removing it', async ({ native: { browser, page, inspector } }) => {
    copyProject(page.getVaultPath(), 'code');
    await inspector.openCity();
    await inspector.scanFolder('code');
    const profile = onlyProfile(await pluginData(browser));
    await inspector.openCodebaseSettings(profile.name);
    await inspector.connect('code', 'vault-folder');
    await closeSettings(browser);
    const bound = await pluginData(browser);
    const bindings = savedBindings(bound);
    expect(bindings).toHaveLength(1);
    expect(bindings[0]!.rootPath).toMatch(/[\\/]code$/u);
    expect(savedProfiles(bound)[0]?.bindingId).toBe(bindings[0]!.bindingId);
    const clear = () => inspector.settingsPage().$('[data-action="clear-binding"]');
    const inModal = (action: string) => browser.$(`.modal-container [data-action="${action}"]`);
    // Clear binding asks first: Cancel keeps the binding.
    await inspector.openCodebaseSettings(profile.name);
    await clickWhenClickable(clear);
    await clickWhenClickable(() => inModal('cancel'));
    await expect.poll(() => inModal('cancel').isExisting()).toBe(false);
    expect(await clear().isExisting()).toBe(true);
    await closeSettings(browser);
    expect((await pluginData(browser)).bindings).toEqual(bindings);
    // Confirming removes it, and the page offers Reconnect.
    await inspector.openCodebaseSettings(profile.name);
    await clickWhenClickable(clear);
    await clickWhenClickable(() => inModal('confirm-clear-binding'));
    await expect.poll(() => inspector.settingsPage().$('[data-action="reconnect"]').isExisting()).toBe(true);
    await closeSettings(browser);
    await expect.poll(async () => (await pluginData(browser)).bindings).toEqual([]);
  });

  test('a setting being typed keeps its text when a write elsewhere refreshes the settings tab', async ({ native: { browser, page, inspector } }) => {
    copyProject(page.getVaultPath(), 'code');
    await inspector.openCity();
    await inspector.scanFolder('code');
    const profile = onlyProfile(await pluginData(browser));
    const elsewhere = 'Research/elsewhere';
    const excluded = () => inspector.settingsPage().$('textarea');
    await inspector.openCodebaseSettings(profile.name);
    const settingsWindow = await browser.getWindowHandle();
    await expect.poll(() => excluded().isClickable()).toBe(true);
    await excluded().click();
    await browser.keys([Key.Ctrl, Key.End]);
    await excluded().addValue('\nfirst-half');
    // Focus stays in the textarea: observed, a switch to the main window and back with no write fires no focusout
    // and no change, and the textarea is still document.activeElement. The settings stay open.
    await switchToMainWindow(browser, settingsWindow);
    await writeNotesFolderElsewhere(browser, profile.profileId, elsewhere);
    await expect.poll(async () => ((await pluginData(browser)).investigations as Record<string, { folder?: string }> | undefined)?.[profile.profileId]?.folder)
      .toBe(elsewhere);
    // The tab heard it: its refresh has read the write (before the fix, it re-rendered the page at once).
    await expect.poll(() => tabNotesFolder(browser, profile.profileId)).toBe(elsewhere);
    await browser.switchToWindow(settingsWindow);
    await browser.keys('second-half');
    await inspector.settingsPage().$('.setting-page-title').click();
    // Positive control (E4): a render after the write shows it. The notes folder row is render-type, so its field
    // shows the folder written elsewhere only once the page is drawn again. The while-focused evidence is the poll on
    // the tab's own state before the switch back.
    await expect.poll(() => inspector.settingsRow(NOTES_FOLDER_SETTING_NAME).$('input').getValue()).toBe(elsewhere);
    await closeSettings(browser);
    await expect.poll(async () => savedProfiles(await pluginData(browser))[0]?.exclusions).toContain('first-halfsecond-half');
  });

  test('a render waiting in the settings tab is released when another settings tab is opened', async ({ native: { browser, page, inspector, directory } }) => {
    copyProject(page.getVaultPath(), 'code');
    await inspector.openCity();
    await inspector.scanFolder('code');
    const profile = onlyProfile(await pluginData(browser));
    const renamed = `Renamed-${Date.now()}`;
    const excluded = () => inspector.settingsPage().$('textarea');
    await inspector.openCodebaseSettings(profile.name);
    const settingsWindow = await browser.getWindowHandle();
    const fromMain = async <T>(read: () => Promise<T>): Promise<T> => {
      await switchToMainWindow(browser, settingsWindow);
      const value = await read();
      await browser.switchToWindow(settingsWindow);
      return value;
    };
    await expect.poll(() => excluded().isClickable()).toBe(true);
    await excluded().click();
    await browser.keys([Key.Ctrl, Key.End]);
    await excluded().addValue('\nfirst-half');
    // The field keeps focus (scenario 38): the rename's refresh asks for a render, and the render waits.
    await switchToMainWindow(browser, settingsWindow);
    await renameElsewhere(browser, profile.profileId, renamed);
    await expect.poll(async () => savedProfiles(await pluginData(browser))[0]?.name).toBe(renamed);
    await expect.poll(() => tabProfileName(browser, profile.profileId)).toBe(renamed);
    await browser.switchToWindow(settingsWindow);
    // Positive control: while the wait holds (focus moves to the search field, another field of the settings), the
    // definitions our tab stored are stale, so the search does not find the renamed page.
    const staleGroups = await searchSettings(browser, renamed);
    const stale = await fromMain(() => searchState(browser, renamed));
    expect(stale.ourPage).toBe(0);
    expect(stale.storedPages).toEqual([profile.name]);
    await clearSettingsSearch(browser);
    // Another settings tab: focus moves to its nav item (tabIndex -1, still inside the settings document), so no
    // focusout releases the wait; Obsidian's openTab() calls our hide(), which does.
    await browser.$('.modal.mod-settings [data-setting-id="appearance"]').click();
    await expect.poll(() => fromMain(() => searchState(browser, renamed).then((state) => state.activeTab))).toBe('appearance');
    const freshGroups = await searchSettings(browser, renamed);
    await expect.poll(() => fromMain(() => searchState(browser, renamed).then((state) => state.ourPage))).toBe(1);
    const fresh = await fromMain(() => searchState(browser, renamed));
    await writeEvidence(directory, 'hide-release', { renamed, staleGroups, stale, freshGroups, fresh });
    await closeSettings(browser);
  });
});
