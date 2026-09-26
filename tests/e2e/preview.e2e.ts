// WP-04.2 spec §5 rows 23 and 24: the source preview in real Obsidian. Scenario 23 (NE19, E25): a profile connected
// in Settings to `code/` previews the cycle's exact line under its binding; once the binding is reconnected to
// `code-copy/` (a byte-identical copy), the preview refuses as `no-binding`, because the binding's root no longer names
// the snapshot's root. No scan reads the binding (WP-04.2 E14), so nothing is rescanned in between. Scenario 24 (NE18,
// NP12): a report crafted from the 3.27.0 recording anchors a finding on a Markdown file of the scanned `code/`; Open in
// Obsidian opens it in a NEW tab, as does Open note from the notes panel; a `.ts` anchor offers no Open in Obsidian.
// IPF20: nothing matches Obsidian's own UI; the plugin's words come from its copy module.
import { join } from 'node:path';
import { describe, expect } from 'vitest';
import { PREVIEW_UNAVAILABLE } from '../../src/ui/audit-copy/investigation';
import { writeEvidence } from './diagnostics';
import { test } from './fixture';
import type { NativeContext } from './fixture';
import { closeSettings, pluginData } from './host-probes';
import { storeSnapshot } from './cycle-note';
import { CITY_VIEW_TYPE } from './session';
import { RECORDING, copyProject, cycleFinding, recordingFindings, writeReport } from './workspace-files';

type Browser = NativeContext['browser'];
interface SavedProfile { profileId: string; name: string; bindingId: string | null }
interface SavedBinding { bindingId: string; rootPath: string }
/** One workspace leaf: Obsidian's own leaf id, its tab group's id, its view type and the vault path its view shows. */
interface LeafFact { id: string; group: string; type: string; path: string | null }

/** The Markdown file scenario 24 anchors a finding on, root-relative and as a vault path. */
const GUIDE = 'docs/guide.md';
const GUIDE_PATH = `code/${GUIDE}`;

const saved = async (browser: Browser): Promise<{ profile: SavedProfile; bindings: SavedBinding[] }> => {
  const data = await pluginData(browser);
  const profiles = (data.profiles ?? []) as SavedProfile[];
  expect(profiles).toHaveLength(1);
  return { profile: profiles[0]!, bindings: (data.bindings ?? []) as SavedBinding[] };
};

/** The vault base path the plugin reads (`FileSystemAdapter.getBasePath()`). */
const basePath = (browser: Browser): Promise<string | null> => browser.executeObsidian(({ app, obsidian }) => {
  const adapter = app.vault.adapter;
  return adapter instanceof obsidian.FileSystemAdapter ? adapter.getBasePath() : null;
});

/** Every workspace leaf, and which one is active. */
const leaves = (browser: Browser): Promise<{ active: string | null; all: LeafFact[] }> => browser.executeObsidian(({ app, obsidian }) => {
  // Obsidian's leaf and tab-group ids, which its typings do not declare.
  type Identified = { id: string };
  const all: LeafFact[] = [];
  app.workspace.iterateAllLeaves((leaf) => {
    const file = (leaf.view as { file?: { path: string } | null }).file;
    const id = (leaf as unknown as Identified).id;
    all.push({ id, group: (leaf.parent as unknown as Identified).id, type: leaf.view.getViewType(), path: file?.path ?? null });
  });
  const active = app.workspace.getActiveViewOfType(obsidian.ItemView)?.leaf;
  return { active: active === undefined ? null : (active as unknown as Identified).id, all };
});

/** The leaves in `after` that were not in `before` (by Obsidian's own leaf id). */
const added = (before: LeafFact[], after: LeafFact[]): Omit<LeafFact, 'id'>[] => {
  const known = new Set(before.map((leaf) => leaf.id));
  return after.filter((leaf) => !known.has(leaf.id)).map(({ group, type, path }) => ({ group, type, path }));
};

/** Observed: once a Markdown leaf exists, Obsidian's status bar (its editor item) floats over the foot of the city
 *  leaf, where the notes panel's buttons sit, and intercepts WebDriver's click there. Scrolls `element` to the middle
 *  of its scroll container (the DOM's own scrollIntoView) and waits until WebDriver finds it clickable. */
async function centred(browser: Browser, element: ReturnType<Browser['$']>): Promise<void> {
  await expect.poll(() => element.isExisting()).toBe(true);
  // The resolved element (a chainable one is not serialised as an element reference).
  const resolved = await element.getElement();
  await browser.execute((el: HTMLElement) => { el.scrollIntoView({ block: 'center' }); }, resolved as unknown as HTMLElement);
  await expect.poll(() => element.isClickable()).toBe(true);
}

/** Clicks `button` (in the city leaf) and requires what a new tab means: exactly one new leaf, a Markdown view of
 *  `path` in the city leaf's own tab group (a tab, not a split), and the previously active leaf (the city leaf the
 *  button is in) still the city view. Returns the facts. Observed (Obsidian 1.13.4): with the city leaf active (its
 *  view's `navigation` is false), `getLeaf(false)` also creates a new tab in that group, so no leaf fact tells it
 *  from `getLeaf(true)` here; a split or a reused leaf fails these checks. */
async function opensNewTab(native: NativeContext, button: string, path: string): Promise<{ before: unknown; after: unknown }> {
  const { browser, inspector } = native;
  const before = await leaves(browser);
  const city = before.all.find((leaf) => leaf.type === CITY_VIEW_TYPE);
  expect(city).toBeDefined();
  expect(before.active).toBe(city!.id);
  await centred(browser, inspector.root().$(button));
  await inspector.root().$(button).click();
  await expect.poll(async () => added(before.all, (await leaves(browser)).all)).toEqual([{ group: city!.group, type: 'markdown', path }]);
  const after = await leaves(browser);
  expect(after.all).toHaveLength(before.all.length + 1);
  expect(after.all.filter((leaf) => leaf.type === 'markdown')).toHaveLength(before.all.filter((leaf) => leaf.type === 'markdown').length + 1);
  expect(after.all.find((leaf) => leaf.id === city!.id)?.type).toBe(CITY_VIEW_TYPE);
  // Back to the city tab for the next step: it is the active view again and its UI is rendered.
  await inspector.activateCity();
  await expect.poll(() => inspector.root().isDisplayed()).toBe(true);
  return { before, after };
}

describe('the source preview (WP-04.2 rows 23, 24)', () => {
  test('a bound codebase previews under its connected folder and refuses a changed root', async ({ native }) => {
    const { browser, page, inspector, directory } = native;
    copyProject(page.getVaultPath(), 'code');
    copyProject(page.getVaultPath(), 'code-copy');
    await expect.poll(() => browser.executeObsidian(({ app }) => app.vault.adapter.exists('code-copy/src/core/a.ts'))).toBe(true);
    const { id, line } = cycleFinding();
    const base = await basePath(browser);
    if (base === null) throw new Error('the vault has no base path');

    // Scanned in vault-folder mode, then Connected in Settings to the same vault folder: the binding's root is the
    // snapshot's root, both through Obsidian's base path.
    await inspector.openCity();
    await inspector.scanFolder('code');
    const scanned = await storeSnapshot(browser);
    await inspector.openCodebaseSettings((await saved(browser)).profile.name);
    await inspector.connect('code', 'vault-folder');
    await closeSettings(browser);
    const connected = await saved(browser);
    expect(connected.bindings).toHaveLength(1);
    const binding = connected.bindings[0]!;
    expect(connected.profile.bindingId).toBe(binding.bindingId);
    expect(binding.rootPath).toBe(scanned.rootPath);
    expect(scanned.rootPath).toBe(join(base, 'code'));

    // Positive control: through the binding (the bound path, not E25's unbound one), exactly the cycle's line.
    await inspector.importReport(RECORDING);
    await inspector.selectFinding(id);
    await expect.poll(() => inspector.highlightedLines()).toEqual([String(line)]);

    // Reconnect to code-copy: a live binding offers only Clear binding, which (confirmed) removes this device's record
    // and leaves the page offering Reconnect; Reconnect keeps the binding id and gives it the new root.
    // Observed: the profile page slides in, and its buttons are not interactable until it has.
    await inspector.openCodebaseSettings(connected.profile.name);
    const clear = inspector.settingsPage().$('[data-action="clear-binding"]');
    await expect.poll(() => clear.isClickable()).toBe(true);
    await clear.click();
    const confirm = browser.$('.modal-container [data-action="confirm-clear-binding"]');
    await expect.poll(() => confirm.isClickable()).toBe(true);
    await confirm.click();
    const reconnect = inspector.settingsPage().$('[data-action="reconnect"]');
    await expect.poll(() => reconnect.isClickable()).toBe(true);
    await inspector.reconnect('code-copy', 'vault-folder');
    await closeSettings(browser);
    const reconnected = await saved(browser);
    expect(reconnected.profile.bindingId).toBe(binding.bindingId);
    expect(reconnected.bindings).toEqual([{ ...binding, rootPath: join(base, 'code-copy') }]);
    // WP-04.2 E14: nothing rescanned, so the snapshot still names code/.
    expect((await storeSnapshot(browser)).rootPath).toBe(scanned.rootPath);

    // Reload re-reads the selection: the binding no longer names the snapshot's root, so no-binding, and no highlight.
    await inspector.root().$('.ci-source-preview__reload').click();
    const unavailable = inspector.root().$('.ci-source-preview__unavailable');
    await expect.poll(() => unavailable.isExisting()).toBe(true);
    const words = String(await unavailable.getProperty('textContent')).trim();
    const highlighted = await inspector.highlightedLines();
    await writeEvidence(directory, 'changed-root', {
      snapshotRoot: scanned.rootPath, connected: binding, reconnected: reconnected.bindings, unavailable: words, highlighted,
    });
    expect(words).toBe(PREVIEW_UNAVAILABLE['no-binding']);
    expect(highlighted).toEqual([]);
  });

  test('Open in Obsidian and Open note each open the file in a new tab', async ({ native }) => {
    const { browser, page, inspector, directory } = native;
    // NPF15: a Markdown file the vault must know about is created through the vault API (and code/ with it); the
    // project itself is copied in afterwards.
    await browser.executeObsidian(async ({ app }, path) => {
      await app.vault.createFolder('code');
      await app.vault.createFolder('code/docs');
      await app.vault.create(path, 'A guide.\n');
    }, GUIDE_PATH);
    copyProject(page.getVaultPath(), 'code');
    await expect.poll(() => browser.executeObsidian(({ app }) => app.vault.adapter.exists('code/src/core/a.ts'))).toBe(true);
    expect(await browser.executeObsidian(({ app }, path) => app.vault.getFileByPath(path)?.extension ?? null, GUIDE_PATH)).toBe('md');

    // The recording, with its first unused export moved onto the guide (NP12: imported through the real dialog).
    // Observed: the normaliser makes no finding of `unused_files` (normalize-fallow.ts reads unused_exports and
    // unused_types), so the brief's fallback, an `unused_exports` path, is the anchor.
    const report = writeReport(join(directory, 'md-anchor.json'), (raw) => {
      const unused = (raw.check as { unused_exports: { path: string }[] }).unused_exports;
      expect(unused[0]?.path).toBe('src/barrel/x.ts');
      unused[0]!.path = GUIDE;
    });
    const anchored = recordingFindings(report).filter((finding) => finding.path === GUIDE);
    expect(anchored).toHaveLength(1);
    const cycle = cycleFinding();
    await inspector.openCity();
    await inspector.scanFolder('code');
    await inspector.importReport(report);

    // Open in Obsidian, on the Markdown anchor: a new tab on the guide.
    await inspector.selectFinding(anchored[0]!.id);
    const openObsidian = inspector.root().$('.ci-source-preview__open-obsidian');
    await expect.poll(() => openObsidian.isExisting()).toBe(true);
    const fromPreview = await opensNewTab(native, '.ci-source-preview__open-obsidian', GUIDE_PATH);

    // Control: the .ts cycle anchor, once its preview has read, offers no Open in Obsidian.
    await inspector.selectFinding(cycle.id);
    await expect.poll(() => inspector.highlightedLines()).toEqual([String(cycle.line)]);
    expect(await openObsidian.isExisting()).toBe(false);

    // Open note: a note for the cycle, opened from the notes panel in another new tab. Observed: once a Markdown leaf
    // exists, Obsidian's editor status bar item covers the notes panel's foot, so its buttons are scrolled to the middle.
    await centred(browser, inspector.root().$('.ci-notes-panel__create'));
    const note = await inspector.createNote();
    const fromNote = await opensNewTab(native, `.ci-notes-panel__open[data-path="${note}"]`, note);
    await writeEvidence(directory, 'tabs', { finding: anchored[0], fromPreview, note, fromNote });
  });
});
