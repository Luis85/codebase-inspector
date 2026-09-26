// IPF20: native tests never match Obsidian's own UI text (the session UI follows the system locale, German
// here); they use selectors, command ids and `executeObsidian`.
import { readFileSync } from 'node:fs';
import { expect } from 'vitest';
import { Key } from 'webdriverio';
import { ROUTE_META } from '../../src/ui/routes';
import { commandAvailable, openPluginSettings } from './host-probes';
import { createFallowSteps } from './inspector-fallow';
import { decodePng, type Png } from './png';
import { CITY_VIEW_TYPE, type NativeBrowser } from './session';

type ErrorWindow = Window & { ciErrors?: string[] };

export type InspectorPage = ReturnType<typeof createInspectorPage>;

/** An XPath predicate: the context node's class list holds `name`. */
export const hasClass = (name: string): string => `contains(concat(' ', normalize-space(@class), ' '), ' ${name} ')`;
/** An XPath string literal for any text (concat() when it holds both quote kinds). */
function xpathLiteral(text: string): string {
  if (!text.includes('"')) return `"${text}"`;
  if (!text.includes("'")) return `'${text}'`;
  return `concat("${text.split('"').join(`", '"', "`)}")`;
}
/** A `.setting-item` child predicate: its own `.setting-item-info > .setting-item-name` is `name`, compared after
 *  XPath's own whitespace normalisation. */
const namedItem = (name: string): string =>
  `[./*[${hasClass('setting-item-info')}]/*[${hasClass('setting-item-name')}][normalize-space(.)=${xpathLiteral(name.trim().replace(/\s+/gu, ' '))}]]`;
/** Probe f: `.modal.mod-settings … .setting-item > .setting-item-info > .setting-item-name`. */
const settingsRowXpath = (name: string): string => `//*[${hasClass('mod-settings')}]//*[${hasClass('setting-item')}]${namedItem(name)}`;
/** NPF7: a profile's navigable row in the settings list (`.setting-group.mod-list .setting-item.mod-navigable`). */
const profileRowXpath = (name: string): string =>
  `//*[${hasClass('mod-settings')}]//*[${hasClass('mod-list')}]//*[${hasClass('setting-item')} and ${hasClass('mod-navigable')}]${namedItem(name)}`;
const PROFILE_NAMES = '.modal.mod-settings .setting-group.mod-list .setting-item.mod-navigable > .setting-item-info > .setting-item-name';
/** The source modal's two modes a test drives: a vault folder, or an absolute path (the modal's `external`). */
export type ConnectMode = 'vault-folder' | 'absolute';

/** Fix round 1 (Important 1): the city commands act on the ACTIVE CityView and silently do nothing without one
 *  (commands.ts), and the main window regains focus only some time after the settings window closes. Makes the city
 *  leaf the active view of the main window (focusing it when it is not) and reports whether it now is. */
function cityActive(browser: NativeBrowser): Promise<boolean> {
  return browser.executeObsidian(({ app }, type): boolean => {
    const leaf = app.workspace.getLeavesOfType(type)[0];
    if (!leaf) throw new Error('no city leaf');
    // The command's own check, getActiveViewOfType(CityView), with the class read off the city leaf's view.
    const ready = (): boolean => activeDocument === document && app.workspace.getActiveViewOfType(leaf.view.constructor as never) === leaf.view;
    if (!ready()) app.workspace.setActiveLeaf(leaf, { focus: true });
    return ready();
  }, CITY_VIEW_TYPE);
}

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
/** The same, trimmed, for an element `$$` already resolved. */
async function trimmedText(element: { getProperty(name: string): Promise<unknown> }): Promise<string> {
  return String(await element.getProperty('textContent')).trim();
}

export function createInspectorPage(browser: NativeBrowser) {
  const root = () => browser.$(`.workspace-leaf-content[data-type="${CITY_VIEW_TYPE}"] .codebase-inspector-root`);
  // One selector per call, so a modal that is still closing never scopes the search.
  const inModal = (selector: string) => browser.$(`.modal-container ${selector}`);
  /** The source modal: the mode, the folder, Continue. */
  const chooseSource = async (folder: string, mode: ConnectMode): Promise<void> => {
    const [value, field] = mode === 'vault-folder' ? ['vault-folder', 'vault-folder-path'] : ['external', 'external-path'];
    const radio = inModal(`input[type="radio"][name="source-mode"][value="${value}"]`);
    // A command that did nothing fails here, by name, rather than as a missing element.
    await expect.poll(() => radio.isExisting()).toBe(true);
    await radio.click();
    await inModal(`[data-field="${field}"]`).setValue(folder);
    await inModal('[data-action="continue"]').click();
  };
  /** The open profile page in the settings window (NPF7). */
  const settingsPage = () => browser.$('.modal.mod-settings .setting-page.vertical-tab-content');
  /** Connect or Reconnect on the open profile page. Observed (Task 2): the source modal opens in the SETTINGS
   *  window, where WebDriver already is; done when the modal is gone and the page offers Clear binding. */
  const bindFrom = async (action: 'connect' | 'reconnect', folder: string, mode: ConnectMode): Promise<void> => {
    // Observed: the profile page slides in, and its buttons are not interactable until it has.
    const button = settingsPage().$(`[data-action="${action}"]`);
    await expect.poll(() => button.isClickable()).toBe(true);
    await button.click();
    await chooseSource(folder, mode);
    await expect.poll(() => inModal('[data-action="continue"]').isExisting()).toBe(false);
    await expect.poll(() => settingsPage().$('[data-action="clear-binding"]').isExisting()).toBe(true);
  };
  /** Before a city command: the city leaf is the main window's active view (see cityActive). */
  const activateCity = async (): Promise<void> => { await expect.poll(() => cityActive(browser)).toBe(true); };
  const navigate = async (title: string): Promise<void> => {
    const item = root().$(`.ci-nav__item*=${title}`);
    if (!(await item.isDisplayed())) await root().$('.ci-topbar__menu').click();
    await item.click();
  };
  /** Refresh evidence… on the note at `path`, then the dialog's Refresh evidence. */
  const confirmRefresh = async (path: string): Promise<void> => {
    await root().$(`.ci-notes-panel__refresh[data-path="${path}"]`).click();
    const confirm = root().$('.ci-refresh-note__confirm');
    await expect.poll(() => confirm.isExisting()).toBe(true);
    await confirm.click();
  };
  /** Runs `scan-codebase` and waits for the leaf to show a snapshot other than `before`. */
  const scanned = async (before: string | null): Promise<void> => {
    await expect.poll(() => snapshotIdOf(browser), { timeout: 60_000 }).not.toBe(before);
    await expect.poll(() => snapshotIdOf(browser)).not.toBeNull();
  };
  /** The scope modal (it must open): the acknowledgement, then Scan once it is enabled. */
  const approveScope = async (): Promise<void> => {
    const acknowledge = inModal('[data-field="acknowledge"]');
    await expect.poll(() => acknowledge.isExisting()).toBe(true);
    await acknowledge.click();
    const scan = inModal('[data-action="confirm-scan"]');
    await expect.poll(() => scan.isEnabled()).toBe(true);
    await scan.click();
  };
  /** The create dialog's folder field, its exclusion checkbox and the path it plans (O7, IN26, IP26). */
  const folderField = () => root().$('.ci-create-note__folder');
  const excludeBox = () => root().$('.ci-create-note__exclude input[type="checkbox"]');
  /** Create investigation note… with `folder` typed over the default (WP-04.2 E2's keys, so `input` fires as a
   *  person's typing does); done when the dialog plans a path in that folder. Returns that path. */
  const openCreateNote = async (folder: string): Promise<string> => {
    await root().$('.ci-notes-panel__create').click();
    await expect.poll(() => folderField().isClickable()).toBe(true);
    await folderField().click();
    await browser.keys([Key.Ctrl, 'a']);
    await folderField().addValue(folder);
    const shown = root().$('.ci-create-note__path');
    await expect.poll(async () => (await shown.isExisting()) && (await textOf(shown)).trim().startsWith(`${folder}/`)).toBe(true);
    return (await textOf(shown)).trim();
  };
  return {
    ...createFallowSteps(browser, root, navigate),
    root,
    screen: (route: string) => root().$(`.ci-screen--${route}`),
    async openCity(): Promise<void> {
      await browser.executeObsidianCommand('codebase-inspector:open-city');
      await expect.poll(() => root().isExisting()).toBe(true);
    },
    navigate,
    activateCity,
    snapshotId: () => snapshotIdOf(browser),
    /** WP-04 Task 16: `scan-codebase` as a user answers it — the source modal (in vault-folder mode unless
     *  `mode` says otherwise), then the scope modal's acknowledgement and Scan. */
    async scanFolder(folder: string, mode: ConnectMode = 'vault-folder'): Promise<void> {
      const before = await snapshotIdOf(browser);
      await activateCity();
      await browser.executeObsidianCommand('codebase-inspector:scan-codebase');
      await chooseSource(folder, mode);
      await approveScope();
      await scanned(before);
    },
    /** `scan-codebase` after the scope changed (M57): the scope modal must open, and is approved. */
    async rescanApproving(): Promise<void> {
      const before = await snapshotIdOf(browser);
      await activateCity();
      await browser.executeObsidianCommand('codebase-inspector:scan-codebase');
      await approveScope();
      await scanned(before);
    },
    /** `scan-codebase` again: a refresh against the stored scope, with no modal (a new snapshot id). */
    async rescan(): Promise<void> {
      const before = await snapshotIdOf(browser);
      await activateCity();
      await browser.executeObsidianCommand('codebase-inspector:scan-codebase');
      await scanned(before);
    },
    /** `scan-codebase` against the stored scope (no modal), returning once the run has started: NPF8, neither cancel
     *  command is available right after the start, so this waits for `cancel-scan`'s own checkCallback to answer true. */
    async startScanNoWait(): Promise<void> {
      await activateCity();
      await browser.executeObsidianCommand('codebase-inspector:scan-codebase');
      await expect.poll(() => commandAvailable(browser, 'cancel-scan')).toBe(true);
    },
    /** Data & scans' import dialog (the `import-analysis-report` command), its file input and Attach. */
    async importReport(absolutePath: string): Promise<void> {
      await activateCity();
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
    /** Investigate, with Show more (`.ci-investigate-list__more`) pressed until it is gone; how many rows it lists. */
    async listedFindings(): Promise<number> {
      await navigate(ROUTE_META.investigate.title);
      const rows = (): Promise<number> => root().$$('.ci-investigate-row').length;
      await expect.poll(rows).toBeGreaterThan(0);
      const more = root().$('.ci-investigate-list__more');
      while (await more.isExisting()) {
        const shown = await rows();
        await more.click();
        await expect.poll(rows).toBeGreaterThan(shown);
      }
      return rows();
    },
    /** Investigate → the row whose fingerprint (`<entity id>#<finding id>`) ends with the id. */
    async selectFinding(findingId: string): Promise<void> {
      await navigate(ROUTE_META.investigate.title);
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
    openCreateNote,
    /** With the create dialog open: whether it offers the in-root exclusion (its checkbox, IP26). */
    overlapOffered: (): Promise<boolean> => excludeBox().isExisting(),
    /** The create dialog's Cancel; done when it has closed. */
    async cancelCreateNote(): Promise<void> {
      await root().$('.ci-create-note__cancel').click();
      await expect.poll(() => root().$('.ci-create-note').isExisting()).toBe(false);
    },
    /** A note in `folder` inside the root (the dialog must offer the exclusion), with its checkbox left checked
     *  (`exclude`) or unchecked; returns the created note's vault path once the notes panel lists it. */
    async createNoteIn(folder: string, exclude: boolean): Promise<string> {
      const path = await openCreateNote(folder);
      await expect.poll(() => excludeBox().isExisting()).toBe(true);
      expect(await excludeBox().isSelected()).toBe(true);   // IN26: checked whenever it appears
      if (!exclude) {
        await excludeBox().click();
        await expect.poll(() => excludeBox().isSelected()).toBe(false);
      }
      await root().$('.ci-create-note__confirm').click();
      await expect.poll(() => root().$(`.ci-notes-panel__open[data-path="${path}"]`).isExisting()).toBe(true);
      return path;
    },
    /** The evidence panel's Review, then the review dialog's control for `disposition` (FindingReviewDialog.vue:
     *  `acknowledged` is the Acknowledge toggle, which saves on press; `dismissed` is Dismiss, a reason and Save),
     *  then Close. Waits for the store to accept decisions (the toggle is not aria-disabled, E40) and for the
     *  dialog's status chip to show the decision. */
    async reviewFinding(disposition: string): Promise<void> {
      await root().$('.ci-evidence-panel__review').click();
      const dialog = root().$('.ci-finding-dialog');
      await expect.poll(() => dialog.isExisting()).toBe(true);
      await expect.poll(() => dialog.$('.ci-finding-dialog__acknowledge').getAttribute('aria-disabled')).toBe('false');
      if (disposition === 'acknowledged') {
        await dialog.$('.ci-finding-dialog__acknowledge').click();
      } else if (disposition === 'dismissed') {
        await dialog.$('.ci-finding-dialog__dismiss').click();
        await dialog.$('.ci-finding-dialog__dismissal textarea').addValue('native e2e');
        await dialog.$('.ci-finding-dialog__save-dismissal').click();
      } else {
        throw new Error(`the review dialog has no control for ${disposition}`);
      }
      await expect.poll(() => dialog.$(`.ci-chip--status-${disposition}`).isExisting()).toBe(true);
      await dialog.$('.ci-finding-dialog__close').click();
      await expect.poll(() => dialog.isExisting()).toBe(false);
    },
    /** The evidence panel's Add work item, then the editor's Save; returns the title the editor was pre-filled
     *  with (IP22). Done when the editor has closed, which it does only on a saved item (WorkItemEditor.vue). */
    async addWorkItem(): Promise<string> {
      await root().$('.ci-evidence-panel__add-work-item').click();
      const title = root().$('.ci-work-editor__title');
      await expect.poll(() => title.isExisting()).toBe(true);
      const prefilled = String(await title.getValue());
      await root().$('.ci-work-editor__save').click();
      await expect.poll(() => root().$('.ci-work-editor').isExisting()).toBe(false);
      return prefilled;
    },
    /** The evidence panel as shown: each `dt` label with the text of the `dd` after it, and the work item lines. */
    async evidence(): Promise<{ rows: Record<string, string>; workItems: string[] }> {
      const meta = root().$('.ci-evidence-panel__meta');
      await expect.poll(() => meta.isExisting()).toBe(true);
      const terms = await meta.$$('dt').map(trimmedText);
      const values = await meta.$$('dd').map(trimmedText);
      const workItems = await root().$$('.ci-evidence-panel__work-items li').map(trimmedText);
      return { rows: Object.fromEntries(terms.map((term, i) => [term, values[i] ?? ''])), workItems };
    },
    /** Refresh evidence… on the note at `path` → Refresh evidence; waits for the dialog to close. */
    async refreshNote(path: string): Promise<void> {
      await confirmRefresh(path);
      await expect.poll(() => root().$('.ci-refresh-note').isExisting()).toBe(false);
    },
    /** The same, for a refusal (E17): the dialog stays open with its role="alert" line (`.ci-refresh-note__error`).
     *  Returns that line's text, then closes the dialog with Cancel. */
    async refreshNoteExpectingRefusal(path: string): Promise<string> {
      await confirmRefresh(path);
      const error = root().$('.ci-refresh-note__error');
      await expect.poll(() => error.isExisting()).toBe(true);
      const words = (await textOf(error)).trim();
      await root().$('.ci-refresh-note__cancel').click();
      await expect.poll(() => root().$('.ci-refresh-note').isExisting()).toBe(false);
      return words;
    },
    /** The Investigate screen's live region (`.ci-investigate__live`, role="status", visually hidden), where a
     *  refreshed or partial outcome is announced once the dialog closes (use-note-refresh.ts, E15). */
    announced: async (): Promise<string> => (await textOf(root().$('.ci-investigate__live'))).trim(),
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
    /** The line number of every highlighted (`aria-current="true"`) source preview line. */
    highlightedLines: async (): Promise<string[]> => root().$$('.ci-source-preview__text [aria-current="true"]')
      .map(async (line) => (await textOf(line.$('.ci-source-preview__number'))).trim()),
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
    /** NE13: the city leaf's `--ci-*` token as sRGB bytes, read the way theme-bridge.ts reads it (the root's own
     *  `getCssPropertyValue`) and resolved through a 1×1 2D canvas in the leaf's own window. */
    resolvedColor: (token: string): Promise<[number, number, number]> => browser.executeObsidian(({ app }, type, name): [number, number, number] => {
      const el = app.workspace.getLeavesOfType(type)[0]?.view.containerEl.querySelector<HTMLElement>('.codebase-inspector-root');
      if (!el) throw new Error('no city leaf');
      // The leaf's own window's global createEl (obsidianmd/prefer-create-el), which Window's type does not declare.
      const canvas = (el.doc.win as Window & { createEl: typeof createEl }).createEl('canvas');
      canvas.width = 1; canvas.height = 1;
      const context = canvas.getContext('2d', { willReadFrequently: true });
      if (!context) throw new Error('no 2D context');
      context.fillStyle = el.getCssPropertyValue(name);
      context.fillRect(0, 0, 1, 1);
      const [r, g, b] = context.getImageData(0, 0, 1, 1).data;
      return [r ?? 0, g ?? 0, b ?? 0];
    }, CITY_VIEW_TYPE, token),
    /** NE13: the city canvas element's own WebDriver screenshot, saved to `file` and decoded. */
    async canvasShot(file: string): Promise<Png> {
      const canvas = root().$('canvas');
      await expect.poll(() => canvas.isExisting()).toBe(true);
      await canvas.saveScreenshot(file);
      return decodePng(readFileSync(file));
    },
    /** A settings `.setting-item` whose own name is `name` (a constant from the plugin's copy, IPF20). The
     *  settings render in their own window: call host-probes' openPluginSettings first. */
    settingsRow: (name: string) => browser.$(settingsRowXpath(name)),
    /** The profile names the settings list shows, in order (the settings window: openPluginSettings first). */
    settingsProfileNames: async (): Promise<string[]> => browser.$$(PROFILE_NAMES).map(async (el) => String(await el.getProperty('textContent')).trim()),
    settingsPage,
    /** WP-04.2 E2: types `value` into a control on the open profile page and leaves it, so its `change` fires as a
     *  person's edit does. Observed: the page slides in, and a control is not interactable until it has. Never
     *  `setValue`: its WebDriver clear fires `change` with an empty value, which the tab saves (or refuses). */
    async editSetting(field: () => ReturnType<NativeBrowser['$']>, value: string): Promise<void> {
      await expect.poll(() => field().isClickable()).toBe(true);
      await field().click();
      await browser.keys([Key.Ctrl, 'a']);
      await field().addValue(value);
      await expect.poll(() => field().getValue()).toBe(value);
      await settingsPage().$('.setting-page-title').click();
    },
    /** openPluginSettings, then the profile's list row: its page is open, and WebDriver is in the settings window. */
    async openCodebaseSettings(profileName: string): Promise<void> {
      await openPluginSettings(browser);
      const row = browser.$(profileRowXpath(profileName));
      // Observed: the settings window animates in, and the row is not interactable until it has.
      await expect.poll(() => row.isClickable()).toBe(true);
      await row.click();
      await expect.poll(() => settingsPage().isExisting()).toBe(true);
    },
    /** Connect on the open profile page (openCodebaseSettings first), through the source modal. */
    connect: (folder: string, mode: ConnectMode): Promise<void> => bindFrom('connect', folder, mode),
    /** Reconnect on the open profile page (a binding this device no longer has), through the source modal. */
    reconnect: (folder: string, mode: ConnectMode): Promise<void> => bindFrom('reconnect', folder, mode),
    /** The text of every `.notice` in the CURRENT window. Observed (Task 2): a Notice the settings tab raises renders
     *  in the settings window, not the main one. */
    notices: async (): Promise<string[]> => browser.$$('.notice').map(async (el) => String(await el.getProperty('textContent'))),
  };
}
