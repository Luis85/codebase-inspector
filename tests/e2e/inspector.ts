// IPF20: native tests never match Obsidian's own UI text (the session UI follows the system locale, German
// here); they use selectors, command ids and `executeObsidian`.
import { expect } from 'vitest';
import { CITY_VIEW_TYPE, PLUGIN_ID, type NativeBrowser } from './session';

type ErrorWindow = Window & { ciErrors?: string[] };
/** Obsidian's settings modal: on `app`, but not in the public typings. */
interface SettingsApp { setting: { open(): void; openTabById(id: string): void; close(): void } }

export type InspectorPage = ReturnType<typeof createInspectorPage>;

/** The city leaf's persisted snapshot id (Obsidian's own `View.getState()`), or null. */
function snapshotIdOf(browser: NativeBrowser): Promise<string | null> {
  return browser.executeObsidian(({ app }, type): string | null => {
    const id = app.workspace.getLeavesOfType(type)[0]?.view.getState().snapshotId;
    return typeof id === 'string' ? id : null;
  }, CITY_VIEW_TYPE);
}

/** An element's text as the DOM holds it: `getText` reads "" for an element WebDriver does not
 *  consider rendered (see smoke.e2e.ts), so this reads `textContent`. */
async function textOf(element: ReturnType<NativeBrowser['$']>): Promise<string> {
  return String(await element.getProperty('textContent'));
}

export function createInspectorPage(browser: NativeBrowser) {
  const root = () => browser.$(`.workspace-leaf-content[data-type="${CITY_VIEW_TYPE}"] .codebase-inspector-root`);
  // One selector per call, so a modal that is still closing never scopes the search.
  const inModal = (selector: string) => browser.$(`.modal-container ${selector}`);
  /** The source modal (scan-codebase's or Settings' Connect): vault-folder mode, the folder, Continue. */
  const chooseVaultFolder = async (folder: string): Promise<void> => {
    await inModal('input[type="radio"][name="source-mode"][value="vault-folder"]').click();
    await inModal('[data-field="vault-folder-path"]').setValue(folder);
    await inModal('[data-action="continue"]').click();
  };
  const navigate = async (title: string): Promise<void> => {
    const item = root().$(`.ci-nav__item*=${title}`);
    if (!(await item.isDisplayed())) await root().$('.ci-topbar__menu').click();
    await item.click();
  };
  /** Runs `scan-codebase` and waits for the leaf to show a snapshot other than `before`. */
  const scanned = async (before: string | null): Promise<void> => {
    await expect.poll(() => snapshotIdOf(browser), { timeout: 60_000 }).not.toBe(before);
    await expect.poll(() => snapshotIdOf(browser)).not.toBeNull();
  };
  return {
    root,
    screen: (route: string) => root().$(`.ci-screen--${route}`),
    async openCity(): Promise<void> {
      await browser.executeObsidianCommand('codebase-inspector:open-city');
      await expect.poll(() => root().isExisting()).toBe(true);
    },
    navigate,
    snapshotId: () => snapshotIdOf(browser),
    /** WP-04 Task 16: `scan-codebase` as a user answers it — the source modal in vault-folder
     *  mode, then the scope modal's acknowledgement and Scan. */
    async scanFolder(folder: string): Promise<void> {
      const before = await snapshotIdOf(browser);
      await browser.executeObsidianCommand('codebase-inspector:scan-codebase');
      await chooseVaultFolder(folder);
      await inModal('[data-field="acknowledge"]').click();
      const scan = inModal('[data-action="confirm-scan"]');
      await expect.poll(() => scan.isEnabled()).toBe(true);
      await scan.click();
      await scanned(before);
    },
    /** Settings → this plugin's tab → Add profile → the new profile's page → Connect → the
     *  source modal in vault-folder mode: a profile with the LocalBinding the preview's root
     *  comes from (IP14), which the next `scan-codebase` then uses. A profile that a first
     *  `scan-codebase` creates itself is unbound (scan-flow.ts), so its preview reads
     *  `no-binding`, and the Settings tab does not list it until the plugin reloads (both in
     *  the Task 16 report). */
    async addConnectedProfile(folder: string): Promise<void> {
      const main = await browser.getWindowHandle();
      // Serialised into the app window: the (untyped) settings modal is reached inside each callback.
      await browser.executeObsidian(({ app }, id) => {
        const { setting } = app as unknown as SettingsApp;
        setting.open();
        setting.openTabById(id);
      }, PLUGIN_ID);
      // Observed in Obsidian 1.13.4: Settings opens in its own window.
      await expect.poll(async () => (await browser.getWindowHandles()).length).toBe(2);
      const settings = (await browser.getWindowHandles()).find((handle) => handle !== main);
      if (settings === undefined) throw new Error('Settings did not open a window');
      await browser.switchToWindow(settings);
      try {
        await browser.$('.setting-group.mod-list .extra-setting-button[aria-label="Add profile"]').click();
        const profile = browser.$('.setting-group.mod-list .setting-items .setting-item:not(.mod-empty-state)');
        await expect.poll(() => profile.isExisting()).toBe(true);
        await profile.click();
        // The profile's page slides in: Connect exists before it can take a click.
        const connect = browser.$('[data-action="connect"]');
        await expect.poll(() => connect.isClickable()).toBe(true);
        await connect.click();
        await chooseVaultFolder(folder);
        await expect.poll(() => browser.$('[data-action="clear-binding"]').isExisting()).toBe(true);
      } finally {
        await browser.switchToWindow(main);
      }
      await browser.executeObsidian(({ app }) => { (app as unknown as SettingsApp).setting.close(); });
      await expect.poll(async () => (await browser.getWindowHandles()).length).toBe(1);
    },
    /** `scan-codebase` again: a refresh against the stored scope, with no modal (a new snapshot id). */
    async rescan(): Promise<void> {
      const before = await snapshotIdOf(browser);
      await browser.executeObsidianCommand('codebase-inspector:scan-codebase');
      await scanned(before);
    },
    /** Data & scans' import dialog (the `import-analysis-report` command), its file input and Attach. */
    async importReport(absolutePath: string): Promise<void> {
      await browser.executeObsidianCommand('codebase-inspector:import-analysis-report');
      const file = root().$('.ci-connect-fallow__file');
      await expect.poll(() => file.isExisting()).toBe(true);
      // addValue, not setValue: clearing a file input is an invalid element state.
      await file.addValue(absolutePath);
      const attach = root().$('.ci-connect-fallow__attach');
      await expect.poll(() => attach.isExisting()).toBe(true);
      await attach.click();
      await expect.poll(() => attach.isExisting()).toBe(false);
    },
    /** Investigate → the row whose fingerprint (`<entity id>#<finding id>`) ends with the id. */
    async selectFinding(findingId: string): Promise<void> {
      await navigate('Investigate');
      const row = root().$(`.ci-investigate-row[data-fingerprint$="#${findingId}"]`);
      await expect.poll(() => row.isExisting()).toBe(true);
      await row.click();
      await expect.poll(() => row.getAttribute('aria-current')).toBe('true');
    },
    /** Create investigation note… → Create note; returns the vault path the dialog showed. */
    async createNote(): Promise<string> {
      await root().$('.ci-notes-panel__create').click();
      const shown = root().$('.ci-create-note__path');
      await expect.poll(() => shown.isExisting()).toBe(true);
      const path = (await textOf(shown)).trim();
      await root().$('.ci-create-note__confirm').click();
      await expect.poll(() => root().$(`.ci-notes-panel__open[data-path="${path}"]`).isExisting()).toBe(true);
      return path;
    },
    /** Refresh evidence… on the note at `path` → Refresh evidence; waits for the dialog to close. */
    async refreshNote(path: string): Promise<void> {
      await root().$(`.ci-notes-panel__refresh[data-path="${path}"]`).click();
      const confirm = root().$('.ci-refresh-note__confirm');
      await expect.poll(() => confirm.isExisting()).toBe(true);
      await confirm.click();
      await expect.poll(() => root().$('.ci-refresh-note').isExisting()).toBe(false);
    },
    readNote: (path: string): Promise<string> => browser.getObsidianPage().read(path),
    /** The note's frontmatter through Obsidian's own `getFrontMatterInfo` and `parseYaml`. */
    async frontmatter(path: string): Promise<Record<string, unknown>> {
      return browser.executeObsidian(async ({ app, obsidian }, target): Promise<Record<string, unknown>> => {
        const file = app.vault.getFileByPath(target);
        if (file === null) throw new Error(`no note at ${target}`);
        const info = obsidian.getFrontMatterInfo(await app.vault.read(file));
        return obsidian.parseYaml(info.frontmatter) as Record<string, unknown>;
      }, path);
    },
    /** IN33: what Obsidian's own metadata cache holds as the note's finding fingerprint. */
    cachedFingerprint: (path: string): Promise<unknown> => browser.executeObsidian(({ app }, target): unknown => {
      const file = app.vault.getFileByPath(target);
      return file === null ? null : app.metadataCache.getFileCache(file)?.frontmatter?.finding_fingerprint;
    }, path),
    /** The notes panel's listed note paths (each Open button's `data-path`). */
    notePaths: async (): Promise<(string | null)[]> => root().$$('.ci-notes-panel__open').map((b) => b.getAttribute('data-path')),
    async recordErrors(): Promise<void> {
      await browser.executeObsidian(() => {
        const win: ErrorWindow = activeWindow;
        const errors: string[] = [];
        win.ciErrors = errors;
        const original = console.error.bind(console);
        console.error = (...args: unknown[]) => { errors.push(args.map(String).join(' ')); original(...args); };
        win.addEventListener('error', (e) => { errors.push(e.message); });
        win.addEventListener('unhandledrejection', (e) => { errors.push(String(e.reason)); });
      });
    },
    errors: () => browser.executeObsidian((): string[] => (activeWindow as ErrorWindow).ciErrors ?? []),
  };
}
