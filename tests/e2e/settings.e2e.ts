// WP-04.2 spec §5 rows 10–14 (NE9): the plugin's settings tab in the real settings renderer. NPF7: the settings
// render in their own window, so every `pluginData` read happens before openPluginSettings or after closeSettings.
// Observed here: a Notice the tab raises, and the source and clear-binding modals it opens, all render in the
// settings window. IPF20: the plugin's own words only through its copy constants; everything else by selector.
import { describe, expect } from 'vitest';
import { defaultNoteFolder } from '../../src/application/investigation/note-path';
import { exclusionInputReasons } from '../../src/domain/validator';
import { NOTES_FOLDER_PROBLEM, NOTES_FOLDER_SETTING_NAME } from '../../src/ui/audit-copy/investigation';
import { test } from './fixture';
import { closeSettings, onlyProfile, openPluginSettings, pluginData, savedBindings, savedProfiles } from './host-probes';
import type { NativeBrowser } from './session';
import { copyProject } from './workspace-files';

const LIST = '.modal.mod-settings .setting-group.mod-list';
const SCOPE_MODAL = '.modal-container [data-field="acknowledge"]';
/** Observed: the profile page and its modals slide in, and their buttons are not interactable until they have. */
async function clickWhenClickable(element: () => ReturnType<NativeBrowser['$']>): Promise<void> {
  await expect.poll(() => element().isClickable()).toBe(true);
  await element().click();
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
});
