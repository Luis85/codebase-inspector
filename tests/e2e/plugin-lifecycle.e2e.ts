// WP-04.2 spec §5 rows 1–2 (NE10, NE11): the plugin's lifecycle in the real host. Scenario 1: a disable releases
// every view, listener, interval and canvas the enabled plugin made (probe a's listener tables, probe b's leaves).
// Scenario 2: the five values written through the real UI survive a disable and enable, in data.json and on screen.
// NPF3: a disable detaches every city leaf and an enable restores none, so "enabling opens no tab" is asserted at
// the FIRST enable, and scenario 2 opens the city again after its reload. NPF7: every `executeObsidian` read
// happens outside the settings window. IPF20: the plugin's own words only through its copy constants.
// Observed (Task 3): unregistering a view type with open leaves costs Obsidian itself one `workspace:layout-change`
// listener per leaf (its unknown-view pane's, registered from app.js during the swap). Scenario 1 measures that
// cost on the core Outline view in the same test and allows exactly it per city leaf, never anything else.
import type { EventRef } from 'obsidian';
import { describe, expect } from 'vitest';
import { INVESTIGATE_ROW_DISPOSITION, INVESTIGATE_WORK_ITEM_LINE, NOTES_FOLDER_SETTING_NAME } from '../../src/ui/audit-copy/investigation';
import { FINDING_STATUS_LABEL } from '../../src/ui/audit-copy/quality';
import { WORK_ITEM_STATUS_LABEL } from '../../src/ui/inspector-copy';
import { ROUTE_META } from '../../src/ui/routes';
import { writeEvidence } from './diagnostics';
import { test } from './fixture';
import {
  closeSettings, leakedListeners, listenerCounts, liveIntervals, pluginData, reloadPlugin, trackIntervals, type ListenerCounts,
} from './host-probes';
import { CITY_VIEW_TYPE, PLUGIN_ID, type NativeBrowser } from './session';
import { RECORDING, copyProject, cycleFinding } from './workspace-files';

type ProbeWindow = Window & { ciProbeRef?: EventRef; ciProbeInterval?: number };
interface HostState { cityLeaves: number; leafTypes: string[]; roots: number; canvases: number; allCanvases: number }
interface SavedProfile { profileId: string; name: string; bindingId: string | null }
interface SavedBinding { bindingId: string; rootPath: string; machineId: string }
interface SavedReviews { dispositions?: Record<string, unknown>[]; workItems?: Record<string, unknown>[] }

/** plugin-data-binding-store.ts's MACHINE_ID_KEY (not exported): a storage key, not a word on screen. */
const MACHINE_ID_KEY = 'codebase-inspector:machine-id';
const NOTES_FOLDER = 'Research/notes';
/** FindingReviewDialog.vue's Acknowledge decision. */
const DISPOSITION = 'acknowledged';
/** The note index's four registerEvent listeners (investigation-note-index.ts), started by Investigate. */
const NOTE_INDEX_EVENTS = ['metadataCache:changed', 'metadataCache:resolved', 'vault:delete', 'vault:rename'];
const HAS_SETTING_ITEM = 'contains(concat(" ", normalize-space(@class), " "), " setting-item ")';

/** Probe b plus the DOM: the city leaves, every leaf's view type, and the plugin's roots and canvases. */
function hostState(browser: NativeBrowser): Promise<HostState> {
  return browser.executeObsidian(({ app }, type): HostState => {
    const leafTypes: string[] = [];
    app.workspace.iterateAllLeaves((leaf) => { leafTypes.push(leaf.view.getViewType()); });
    return {
      cityLeaves: app.workspace.getLeavesOfType(type).length, leafTypes,
      roots: document.querySelectorAll('.codebase-inspector-root').length,
      canvases: document.querySelectorAll('.codebase-inspector-root canvas').length,
      allCanvases: document.querySelectorAll('canvas').length,
    };
  }, CITY_VIEW_TYPE);
}

/** Each listener table that grew from `before` to `after`, by how many. */
function growth(before: ListenerCounts, after: ListenerCounts): Record<string, number> {
  return Object.fromEntries(leakedListeners(before, after).map((name) => [name, (after[name] ?? 0) - (before[name] ?? 0)]));
}
const scaled = (per: Record<string, number>, times: number): Record<string, number> =>
  Object.fromEntries(Object.entries(per).map(([name, n]) => [name, n * times]));

/** The control for Obsidian's own cost: disables the core Outline plugin (an internal, `app.internalPlugins`)
 *  while its view has an open leaf, and returns how many leaves that was and how each listener table grew. */
async function hostUnregisterCost(browser: NativeBrowser): Promise<{ leaves: number; growth: Record<string, number> }> {
  const start = await listenerCounts(browser);
  const leaves = await browser.executeObsidian(({ app }): number => {
    const outline = (app as unknown as { internalPlugins: { getPluginById(id: string): { disable(save: boolean): void } | null } })
      .internalPlugins.getPluginById('outline');
    if (!outline) throw new Error('no core Outline plugin');
    const open = app.workspace.getLeavesOfType('outline').length;
    outline.disable(false);
    return open;
  });
  return { leaves, growth: growth(start, await listenerCounts(browser)) };
}

const machineId = (browser: NativeBrowser): Promise<unknown> =>
  browser.executeObsidian(({ app }, key): unknown => app.loadLocalStorage(key), MACHINE_ID_KEY);
const profilesOf = (data: Record<string, unknown>): SavedProfile[] => (data.profiles ?? []) as SavedProfile[];
const bindingsOf = (data: Record<string, unknown>): SavedBinding[] => (data.bindings ?? []) as SavedBinding[];
const folderOf = (data: Record<string, unknown>, profileId: string): unknown =>
  (data.investigations as Record<string, { folder?: unknown }> | undefined)?.[profileId]?.folder;

describe('the plugin lifecycle in the real Obsidian host (WP-04.2 NE10, NE11)', () => {
  test('unloading the plugin releases its views, events and timers', async ({ native: { browser, page, inspector, directory } }) => {
    // Positive control (probe a): a listener leaked through the same tables is reported, then removed.
    const control = await listenerCounts(browser);
    await browser.executeObsidian(({ app }) => { (activeWindow as ProbeWindow).ciProbeRef = app.workspace.on('css-change', () => undefined); });
    expect(leakedListeners(control, await listenerCounts(browser))).toEqual(['workspace:css-change']);
    await browser.executeObsidian(({ app }) => {
      const win = activeWindow as ProbeWindow;
      if (win.ciProbeRef) app.workspace.offref(win.ciProbeRef);
      delete win.ciProbeRef;
    });
    expect(leakedListeners(control, await listenerCounts(browser))).toEqual([]);

    copyProject(page.getVaultPath(), 'code');
    // The baseline, taken with the plugin disabled.
    await page.disablePlugin(PLUGIN_ID);
    const disabled = await hostState(browser);
    // The first enable's precondition: no city leaf exists while disabled (NPF3), so any city leaf after the enable
    // below could only have been opened by the enable itself.
    expect(disabled).toMatchObject({ cityLeaves: 0, roots: 0 });
    const before = await listenerCounts(browser);
    await trackIntervals(browser);
    // Positive control: an interval made now is counted while live, and not once cleared.
    await browser.executeObsidian(() => { (window as ProbeWindow).ciProbeInterval = window.setInterval(() => undefined, 60_000); });
    expect(await liveIntervals(browser)).toBe(1);
    await browser.executeObsidian(() => { window.clearInterval((window as ProbeWindow).ciProbeInterval); });
    expect(await liveIntervals(browser)).toBe(0);

    // Enabling opens no tab. Non-vacuous because no city leaf existed before it (asserted above), and asserted at
    // the first enable, never after a later disable (NPF3: a disable detaches every city leaf, an enable restores none).
    await page.enablePlugin(PLUGIN_ID);
    const enabled = await hostState(browser);
    expect(enabled).toMatchObject({ cityLeaves: 0, roots: 0 });

    // Two city leaves; one scanned, shown Investigate (the note index starts), then the city route (a canvas).
    await inspector.openCity();
    await inspector.openCity();
    await expect.poll(async () => (await hostState(browser)).roots).toBe(2);
    await inspector.scanFolder('code');
    await inspector.navigate(ROUTE_META.investigate.title);
    await expect.poll(() => inspector.screen('investigate').isDisplayed()).toBe(true);
    await expect.poll(async () => leakedListeners(before, await listenerCounts(browser))).toEqual(expect.arrayContaining(NOTE_INDEX_EVENTS));
    await inspector.navigate(ROUTE_META.city.title);
    await expect.poll(async () => (await hostState(browser)).canvases).toBeGreaterThanOrEqual(1);
    const open = await hostState(browser);
    const during = await listenerCounts(browser);
    // Non-vacuous: the open plugin holds each listener the disable must release.
    expect(leakedListeners(before, during)).toEqual(expect.arrayContaining([...NOTE_INDEX_EVENTS, 'workspace:css-change']));

    await page.disablePlugin(PLUGIN_ID);
    await expect.poll(async () => (await hostState(browser)).roots).toBe(0);
    const after = await hostState(browser);
    const released = await listenerCounts(browser);
    const intervals = await liveIntervals(browser);
    // Obsidian's own cost of unregistering a view type while a leaf shows it, measured the same way on its core
    // Outline view (one open leaf): observed here, 1.13.4 swaps each such leaf to its unknown-view pane, whose
    // `layout-change` listener outlives the leaf. WP-04.2 E4: the plugin may leave exactly that many layout-change
    // listeners per city leaf; every other event name must return to its pre-enable count exactly.
    const host = await hostUnregisterCost(browser);
    await writeEvidence(directory, 'leaves', { disabled, enabled, open, after, windows: (await browser.getWindowHandles()).length });
    await writeEvidence(directory, 'listeners', {
      grewWhileOpen: leakedListeners(before, during), grewAfterDisable: growth(before, released), host, before, during, released, intervals,
    });
    expect(host.leaves).toBe(1);
    // Fail closed (E4): the allowance is layout-change or nothing, so a host leak on another name never widens it.
    expect([[], ['workspace:layout-change']]).toContainEqual(Object.keys(host.growth));
    expect(growth(before, released)).toEqual(scaled(host.growth, open.cityLeaves));
    expect(intervals).toBe(0);
    expect(after).toMatchObject({ cityLeaves: 0, roots: 0, canvases: 0, allCanvases: disabled.allCanvases });
  });

  test('keeps profiles, bindings, the notes folder, dispositions and work items across a plugin reload', async ({ native: { browser, page, inspector, directory } }) => {
    copyProject(page.getVaultPath(), 'code');
    const { id } = cycleFinding();
    const folder = () => inspector.settingsRow(NOTES_FOLDER_SETTING_NAME).$('input');
    const clearBinding = () => inspector.settingsPage().$('[data-action="clear-binding"]');
    /** The binding row's description (setting-definitions.ts shows the bound root there). */
    const bindingText = async (): Promise<string> =>
      String(await clearBinding().$(`./ancestor::*[${HAS_SETTING_ITEM}][1]`).$('.setting-item-description').getProperty('textContent'));

    // The five writes, through the real UI: a profile (scan-codebase), the notes folder and a binding (Settings),
    // a disposition (the review dialog) and a work item (the work item editor).
    await inspector.openCity();
    await inspector.scanFolder('code');
    const profiles = profilesOf(await pluginData(browser));
    expect(profiles).toHaveLength(1);
    const profile = profiles[0]!;
    await inspector.openCodebaseSettings(profile.name);
    await inspector.editSetting(folder, NOTES_FOLDER);
    await closeSettings(browser);
    await expect.poll(async () => folderOf(await pluginData(browser), profile.profileId)).toBe(NOTES_FOLDER);
    await inspector.openCodebaseSettings(profile.name);
    await inspector.connect('code', 'vault-folder');
    await closeSettings(browser);
    await inspector.importReport(RECORDING);
    await inspector.selectFinding(id);
    await inspector.reviewFinding(DISPOSITION);
    const title = await inspector.addWorkItem();
    const workLine = INVESTIGATE_WORK_ITEM_LINE(title, WORK_ITEM_STATUS_LABEL.investigate);
    // Positive control: the panel shows both before the reload.
    await expect.poll(async () => (await inspector.evidence()).workItems).toEqual([workLine]);
    expect((await inspector.evidence()).rows[INVESTIGATE_ROW_DISPOSITION]).toBe(FINDING_STATUS_LABEL[DISPOSITION]);

    const before = await pluginData(browser);
    const machine = await machineId(browser);
    // Positive control: every write reached data.json, and the binding is this device's.
    const bindings = bindingsOf(before);
    expect(profilesOf(before)).toHaveLength(1);
    expect(bindings).toHaveLength(1);
    expect(profilesOf(before)[0]?.bindingId).toBe(bindings[0]!.bindingId);
    expect(folderOf(before, profile.profileId)).toBe(NOTES_FOLDER);
    const reviews = (before.reviews as Record<string, SavedReviews> | undefined)?.[profile.profileId];
    expect(reviews?.dispositions).toHaveLength(1);
    expect(reviews?.dispositions?.[0]).toMatchObject({ status: DISPOSITION });
    expect(reviews?.workItems).toHaveLength(1);
    expect(reviews?.workItems?.[0]).toMatchObject({ title, status: 'investigate' });
    expect(typeof machine === 'string' && machine.length > 0).toBe(true);
    expect(bindings[0]!.machineId).toBe(machine);

    await reloadPlugin(browser);
    const after = await pluginData(browser);
    const machineAfter = await machineId(browser);
    await writeEvidence(directory, 'reload', { machine, machineAfter, before, after });
    expect(after).toEqual(before);
    expect(machineAfter).toBe(machine);

    // The UI shows them again: Settings lists the profile, its folder and its binding (NPF3: the city is reopened).
    await inspector.openCity();
    await inspector.openCodebaseSettings(profile.name);
    expect(await folder().getValue()).toBe(NOTES_FOLDER);
    expect(await clearBinding().isExisting()).toBe(true);
    expect((await bindingText()).trim()).toBe(bindings[0]!.rootPath);
    await closeSettings(browser);
    // The snapshot store is in memory (WP-01 §4.5), so the reopened leaf scans afresh, then re-imports.
    await inspector.scanFolder('code');
    await inspector.importReport(RECORDING);
    await inspector.selectFinding(id);
    await expect.poll(async () => (await inspector.evidence()).workItems).toEqual([workLine]);
    expect((await inspector.evidence()).rows[INVESTIGATE_ROW_DISPOSITION]).toBe(FINDING_STATUS_LABEL[DISPOSITION]);
  }, 300_000);
});
