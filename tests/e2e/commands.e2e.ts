// WP-04.2 spec §5 rows 5–7: the plugin's commands and its ribbon icon, run by id in the real host.
// Scenario 5: open-city and the ribbon icon each open a NEW city tab (commands.ts's openCity, ruling M9).
// Scenario 6 (NE8): cancel-scan is refused with no scan, and stops a refresh mid-run; the window is proven first by
// timing an uncancelled refresh over a 4 000-file synthetic tree (WP-04.2 E8), and the cancel is sent only once
// cancel-scan's own checkCallback answers true. Scenario 7: import-analysis-report is refused while the city shows no
// snapshot, and after a scan attaches the real 3.27.0 recording, whose every finding Investigate then lists (IN1).
// Observed (Task 4, 1.13.4, NPF13): `commands.executeCommandById` returns true for ANY registered command whose body does not
// throw, whatever its checkCallback answers, so `executeObsidianCommand` on a refused command RESOLVES. A refusal is
// therefore its checkCallback(true) answering false (the palette's own test, `commandAvailable`) and its body not
// running when invoked by id anyway.
// IPF20: nothing here matches Obsidian's own UI text; the ribbon is found by the label the plugin passes to
// addRibbonIcon (main.ts, NPF12); the cancelled banner by the constant surfaceCopy renders.
import { join } from 'node:path';
import { describe, expect } from 'vitest';
import { CANCELLED_BANNER } from '../../src/application/run-state';
import { ROUTE_META } from '../../src/ui/routes';
import { writeEvidence } from './diagnostics';
import { test } from './fixture';
import { commandAvailable, rendered } from './host-probes';
import { CITY_VIEW_TYPE, type NativeBrowser } from './session';
import { RECORDING, copyProject, cycleFinding, recordingFindingCount, writeSyntheticTree } from './workspace-files';

/** NPF12: the plugin's own ribbon label (main.ts's addRibbonIcon). */
const RIBBON = '.side-dock-ribbon-action[aria-label="Open codebase city"]';
/** WP-04.2 E8 (amends NPF8): the synthetic tree for cancel-scan, sized so an uncancelled REFRESH takes about 3 s, and
 *  the shortest uncancelled run that leaves a window to cancel in. */
const SYNTHETIC_FILES = 4_000;
const MIN_WINDOW_MS = 2_000;

const cityLeaves = (browser: NativeBrowser): Promise<number> =>
  browser.executeObsidian(({ app }, type): number => app.workspace.getLeavesOfType(type).length, CITY_VIEW_TYPE);

describe('the plugin commands and ribbon in the real Obsidian host (WP-04.2 §5 rows 5–7)', () => {
  test('open-city and the ribbon icon each open a new city tab', async ({ native: { browser, inspector } }) => {
    // Precondition: a fresh session opens no city tab (NPF3), so every tab counted below was opened here.
    expect(await cityLeaves(browser)).toBe(0);
    await browser.executeObsidianCommand('codebase-inspector:open-city');
    await expect.poll(() => cityLeaves(browser)).toBe(1);
    await browser.executeObsidianCommand('codebase-inspector:open-city');
    await expect.poll(() => cityLeaves(browser)).toBe(2);
    // Positive control: the selector names exactly one ribbon action, the plugin's.
    expect(await browser.$$(RIBBON).length).toBe(1);
    await browser.$(RIBBON).click();
    await expect.poll(() => cityLeaves(browser)).toBe(3);
    // Each tab is a rendered city, not an empty leaf.
    await expect.poll(() => browser.$$(`.workspace-leaf-content[data-type="${CITY_VIEW_TYPE}"] .codebase-inspector-root`).length).toBe(3);
    expect(await inspector.root().isExisting()).toBe(true);
  });

  test('cancel-scan stops a running scan and is refused when no scan runs', async ({ native: { browser, page, inspector, directory } }) => {
    writeSyntheticTree(join(page.getVaultPath(), 'big'), SYNTHETIC_FILES);
    await expect.poll(() => browser.executeObsidian(({ app }) => app.vault.adapter.exists('big/src/index.ts'))).toBe(true);
    await inspector.openCity();

    // Refused: a city view with no scan offers no cancel, and running it by id anyway changes nothing on the leaf.
    await inspector.activateCity();
    expect(await commandAvailable(browser, 'cancel-scan')).toBe(false);
    await browser.executeObsidianCommand('codebase-inspector:cancel-scan');
    await rendered(browser);
    expect(await inspector.root().$('.ci-status-banner').isExisting()).toBe(false);
    expect(await inspector.snapshotId()).toBeNull();
    expect(await commandAvailable(browser, 'cancel-scan')).toBe(false);

    // The initial scan through the modals stores the scope and makes the first snapshot; it is not the control.
    let started = Date.now();
    await inspector.scanFolder('big');
    const scanMs = Date.now() - started;
    const scanned = await inspector.snapshotId();
    // Positive control (NE8, WP-04.2 E8): an UNCANCELLED refresh against the stored scope, the same kind of run as the
    // one cancelled below, timed until the snapshot id changes. It also publishes a new snapshot, so the unchanged id
    // asserted after the cancel is not vacuous.
    started = Date.now();
    await inspector.rescan();
    const refreshMs = Date.now() - started;
    const control = await inspector.snapshotId();
    await writeEvidence(directory, 'mid-run-window', { files: SYNTHETIC_FILES, scanMs, refreshMs, scanned, control });
    if (refreshMs < MIN_WINDOW_MS) throw new Error('mid-run window too short');
    expect(control).not.toBeNull();
    expect(control).not.toBe(scanned);
    expect(await commandAvailable(browser, 'cancel-scan')).toBe(false);

    // The cancel: a refresh, sent only once cancel-scan's own checkCallback answers true (startScanNoWait). Observed: a
    // scan leaves the leaf on Overview, and StatusBanner renders in the city route's workspace (CityWorkspace.vue).
    await inspector.navigate(ROUTE_META.city.title);
    await expect.poll(() => inspector.screen(ROUTE_META.city.id).isDisplayed()).toBe(true);
    await inspector.startScanNoWait();
    await browser.executeObsidianCommand('codebase-inspector:cancel-scan');
    // StatusBanner.vue's cancelled state: the run store's status, in the words surfaceCopy gives it.
    // Queried afresh on each poll: the banner element is replaced (or removed) as the run's state changes.
    const bannerText = (): Promise<string | null> => browser.executeObsidian(({ app }, type): string | null => {
      const banner = app.workspace.getLeavesOfType(type)[0]?.view.containerEl.querySelector('.ci-status-banner');
      return banner?.textContent?.trim() ?? null;
    }, CITY_VIEW_TYPE);
    await expect.poll(bannerText, { timeout: 30_000 }).toBe(CANCELLED_BANNER);
    await expect.poll(() => commandAvailable(browser, 'cancel-scan')).toBe(false);
    // The cancelled refresh published nothing: the leaf still shows the control's snapshot.
    expect(await inspector.snapshotId()).toBe(control);
    await writeEvidence(directory, 'cancelled', { control, after: await inspector.snapshotId() });
  }, 240_000);

  test('import-analysis-report attaches a real report file and is refused without a snapshot', async ({ native: { browser, page, inspector, directory } }) => {
    copyProject(page.getVaultPath(), 'code');
    await expect.poll(() => browser.executeObsidian(({ app }) => app.vault.adapter.exists('code/src/core/a.ts'))).toBe(true);
    await inspector.openCity();

    // Refused: a city leaf that shows no snapshot offers no import, and running it by id anyway opens neither Data &
    // scans nor its import dialog (the positive control below sees both when the body runs).
    await inspector.activateCity();
    expect(await inspector.snapshotId()).toBeNull();
    expect(await commandAvailable(browser, 'import-analysis-report')).toBe(false);
    await browser.executeObsidianCommand('codebase-inspector:import-analysis-report');
    await rendered(browser);
    expect(await inspector.screen(ROUTE_META.sources.id).isExisting()).toBe(false);
    expect(await inspector.root().$('.ci-connect-fallow__file').isExisting()).toBe(false);

    // Offered once the leaf shows a snapshot; the real recording is attached through the command's own dialog, on
    // Data & scans.
    await inspector.scanFolder('code');
    await inspector.activateCity();
    expect(await commandAvailable(browser, 'import-analysis-report')).toBe(true);
    await inspector.importReport(RECORDING);
    expect(await inspector.screen(ROUTE_META.sources.id).isExisting()).toBe(true);

    // Investigate lists exactly the recording's normalised findings (IN1), every page shown.
    const listed = await inspector.listedFindings();
    const expected = recordingFindingCount();
    await writeEvidence(directory, 'findings', { listed, expected });
    expect(listed).toBe(expected);
    // The recording's own import cycle is among them.
    expect(await inspector.root().$(`.ci-investigate-row[data-fingerprint$="#${cycleFinding().id}"]`).isExisting()).toBe(true);
  });
});
