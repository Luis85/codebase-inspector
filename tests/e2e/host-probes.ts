// NE3/NE4: host probes for native scenarios. Every Obsidian internal reached here is a spec §6 probe, observed at
// pre-flight (WP-04 Part 2 Task 1) on 1.13.4:
//   a  `Events` keeps listeners in `_[name]` arrays on app.workspace, app.vault and app.metadataCache;
//   d  `app.changeTheme('obsidian' | 'moonstone')` swaps body.theme-dark / theme-light and fires one `css-change`
//      per real switch (switching to the current theme fires none);
//   f  `app.setting.open()` + `openTabById(id)` renders the declarative tab in a SEPARATE window: a second
//      WebDriver handle, whose page has no `window.app`, so `executeObsidian` works only from the main handle.
// IPF20: nothing here matches Obsidian's own UI text.
import { expect } from 'vitest';
import { PLUGIN_ID, type NativeBrowser } from './session';

/** `workspace:css-change` -> 3: every `_` table entry of the three Events sources. */
export type ListenerCounts = Record<string, number>;

type TrackedWindow = Window & {
  ciIntervals?: Set<number>;
  ciIntervalOriginals?: { set: Window['setInterval']; clear: Window['clearInterval'] };
};
type CommandEntry = { checkCallback?: (checking: boolean) => boolean | void; callback?: () => unknown };
type SettingHost = { open(): void; openTabById(id: string): unknown; close(): void; activeTab?: { id?: string } | null };

/** Probe a: the listener tables of app.workspace, app.vault and app.metadataCache, by `<source>:<event>`. */
export function listenerCounts(browser: NativeBrowser): Promise<ListenerCounts> {
  return browser.executeObsidian(({ app }): Record<string, number> => {
    const out: Record<string, number> = {};
    const sources: [string, unknown][] = [['workspace', app.workspace], ['vault', app.vault], ['metadataCache', app.metadataCache]];
    for (const [source, events] of sources) {
      const table = (events as { _?: unknown })._;
      if (typeof table !== 'object' || table === null) throw new Error(`${source} has no Events listener table`);
      for (const [name, listeners] of Object.entries(table as Record<string, unknown>)) {
        if (Array.isArray(listeners)) out[`${source}:${name}`] = listeners.length;
      }
    }
    return out;
  });
}

/** The names whose listener count grew from `before` to `after`, sorted. */
export function leakedListeners(before: ListenerCounts, after: ListenerCounts): string[] {
  return Object.keys(after).filter((name) => (after[name] ?? 0) > (before[name] ?? 0)).sort();
}

/** Wraps the main window's setInterval/clearInterval so liveIntervals counts what is created from now on. */
export async function trackIntervals(browser: NativeBrowser): Promise<void> {
  await browser.executeObsidian(() => {
    const win = activeWindow as TrackedWindow;
    if (win.ciIntervalOriginals) throw new Error('intervals are already tracked');
    const live = new Set<number>();
    const set = win.setInterval.bind(win);
    const clear = win.clearInterval.bind(win);
    win.ciIntervals = live;
    win.ciIntervalOriginals = { set, clear };
    win.setInterval = ((handler: TimerHandler, timeout?: number, ...args: unknown[]): number => {
      const id = set(handler, timeout, ...args);
      live.add(id);
      return id;
    }) as Window['setInterval'];
    win.clearInterval = (id?: number): void => {
      if (id !== undefined) live.delete(id);
      clear(id);
    };
  });
}

/** Intervals created since trackIntervals and not cleared. */
export function liveIntervals(browser: NativeBrowser): Promise<number> {
  return browser.executeObsidian((): number => {
    const live = (activeWindow as TrackedWindow).ciIntervals;
    if (!live) throw new Error('trackIntervals was not called');
    return live.size;
  });
}

/** Probe d: Obsidian's own theme switch (`obsidian` is dark, `moonstone` light), waited on through the body class. */
export async function setTheme(browser: NativeBrowser, mode: 'dark' | 'light'): Promise<void> {
  await browser.executeObsidian(({ app }, theme) => {
    (app as unknown as { changeTheme(name: string): void }).changeTheme(theme);
  }, mode === 'dark' ? 'obsidian' : 'moonstone');
  await expect.poll(() => browser.executeObsidian((_host, name) => document.body.classList.contains(name), `theme-${mode}`)).toBe(true);
}

/** The window handle whose page satisfies `test` (run in that page), or null; the current handle is restored. */
async function handleWhere(browser: NativeBrowser, test: () => boolean): Promise<string | null> {
  const current = await browser.getWindowHandle();
  let found: string | null = null;
  for (const handle of await browser.getWindowHandles()) {
    await browser.switchToWindow(handle);
    if (await browser.execute(test)) { found = handle; break; }
  }
  await browser.switchToWindow(current);
  return found;
}

const hasSettings = (): boolean => document.querySelector('.modal.mod-settings') !== null;
const hasApp = (): boolean => typeof (window as unknown as { app?: unknown }).app === 'object';

/** Probe f: opens our settings tab and switches WebDriver to the settings window, so `browser.$` (and
 *  `inspector.settingsRow`) reach it. `executeObsidian` fails there; call closeSettings first. */
export async function openPluginSettings(browser: NativeBrowser): Promise<void> {
  const tab = await browser.executeObsidian(({ app }, id) => {
    const setting = (app as unknown as { setting: SettingHost }).setting;
    setting.open();
    setting.openTabById(id);
    return setting.activeTab?.id ?? null;
  }, PLUGIN_ID);
  if (tab !== PLUGIN_ID) throw new Error(`the settings opened on ${String(tab)}, not ${PLUGIN_ID}`);
  await expect.poll(() => handleWhere(browser, hasSettings)).not.toBeNull();
  const handle = await handleWhere(browser, hasSettings);
  if (handle === null) throw new Error('the settings window vanished');
  await browser.switchToWindow(handle);
}

/** Switches WebDriver back to the main window, closes the settings, and waits until no window shows them. */
export async function closeSettings(browser: NativeBrowser): Promise<void> {
  const main = await handleWhere(browser, hasApp);
  if (main === null) throw new Error('no window holds the Obsidian app');
  await browser.switchToWindow(main);
  await browser.executeObsidian(({ app }) => { (app as unknown as { setting: SettingHost }).setting.close(); });
  await expect.poll(() => handleWhere(browser, hasSettings)).toBeNull();
}

/** A plugin command's own availability: `checkCallback(true)`, or a plain `callback`. `id` without a prefix is ours. */
export function commandAvailable(browser: NativeBrowser, id: string): Promise<boolean> {
  return browser.executeObsidian(({ app }, full): boolean => {
    const command = (app as unknown as { commands: { commands: Record<string, CommandEntry | undefined> } }).commands.commands[full];
    if (!command) return false;
    if (typeof command.checkCallback === 'function') return command.checkCallback(true) === true;
    return typeof command.callback === 'function';
  }, id.includes(':') ? id : `${PLUGIN_ID}:${id}`);
}

/** Waits two frames in the main window, so whatever a command body just changed has rendered before the DOM is read. */
export async function rendered(browser: NativeBrowser): Promise<void> {
  await browser.executeObsidian(async (): Promise<void> => {
    await new Promise<void>((resolve) => {
      window.requestAnimationFrame(() => { window.requestAnimationFrame(() => { resolve(); }); });
    });
  });
}

/** The plugin's `data.json` under the session's config dir, parsed; `{}` when it does not exist yet. */
export async function pluginData(browser: NativeBrowser): Promise<Record<string, unknown>> {
  const configDir = await browser.getObsidianPage().getConfigDir();
  const text = await browser.executeObsidian(async ({ app }, path) =>
    (await app.vault.adapter.exists(path)) ? app.vault.adapter.read(path) : null, `${configDir}/plugins/${PLUGIN_ID}/data.json`);
  return text === null ? {} : JSON.parse(text) as Record<string, unknown>;
}

/** A codebase profile as `data.json` stores it: the fields native tests read. */
export interface SavedProfile { profileId: string; name: string; bindingId: string | null; exclusions: string[] }
/** A root binding as `data.json` stores it. */
export interface SavedBinding { bindingId: string; rootPath: string; machineId: string }

/** `data.json`'s profiles, from a pluginData read (`[]` when none is saved). */
export const savedProfiles = (data: Record<string, unknown>): SavedProfile[] => (data.profiles ?? []) as SavedProfile[];
/** `data.json`'s bindings, from a pluginData read (`[]` when none is saved). */
export const savedBindings = (data: Record<string, unknown>): SavedBinding[] => (data.bindings ?? []) as SavedBinding[];
/** The one profile saved (scan-codebase made exactly one), from a pluginData read. */
export function onlyProfile(data: Record<string, unknown>): SavedProfile {
  const profiles = savedProfiles(data);
  expect(profiles).toHaveLength(1);
  return profiles[0]!;
}

/** The vault base path the plugin reads (`FileSystemAdapter.getBasePath()`, as investigation-notes.ts does), or null. */
export function vaultBasePath(browser: NativeBrowser): Promise<string | null> {
  return browser.executeObsidian(({ app, obsidian }) => {
    const adapter = app.vault.adapter;
    return adapter instanceof obsidian.FileSystemAdapter ? adapter.getBasePath() : null;
  });
}

/** Disables and enables the plugin through the service. Probe b: this detaches every city leaf (each becomes an
 *  `empty` leaf) and re-enabling restores none. */
export async function reloadPlugin(browser: NativeBrowser): Promise<void> {
  const page = browser.getObsidianPage();
  await page.disablePlugin(PLUGIN_ID);
  await page.enablePlugin(PLUGIN_ID);
}
