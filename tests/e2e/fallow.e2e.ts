// WP-04.2 spec §5 rows 8, 9 and 15: the installed fallow run from the command palette's commands, by id, in the real
// host (the real child_process spawn inside Electron's renderer), and the Settings tab after Data & scans trusts it.
// NE7: the binary is FALLOW_BIN, else .fallow-bin/bin-path.txt; with neither the scenario fails, naming both.
// Scenario 8: run-fallow-analysis on the scanned relations project; Investigate then lists the findings the 3.27.0
// recording's normaliser gives that project, each with origin collected.
// Scenario 9 (NE8, NPF8, WP-04.2 E8): cancel-fallow-analysis is refused with no analysis; the window is proven first
// by an UNCANCELLED run on the same 10 000-file tree (the same kind of run as the one cancelled), and the cancel is
// sent only once its own checkCallback answers true and the system lists a fallow process.
// Scenario 15 (NE9): the tab, already rendered, follows the `analyzers` write that Trust and run made.
// NPF13: a refused command RESOLVES when run by id; a refusal is checkCallback(true) answering false plus no effect.
// NPF7: every executeObsidian (pluginData, commandAvailable, the fallow card) runs outside the settings window.
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect } from 'vitest';
import { FALLOW_TESTED_VERSIONS } from '../../src/application/analysis/fallow-invocation';
import {
  FALLOW_EXE_NONE, FALLOW_RUN_CANCELLED, FALLOW_RUN_PROBING, FALLOW_TRUST_VALUE, SETTINGS_FALLOW_EXECUTABLE_NAME,
} from '../../src/ui/audit-copy/fallow-run';
import { INVESTIGATE_ORIGIN_TEXT, INVESTIGATE_ROW_ORIGIN } from '../../src/ui/audit-copy/investigation';
import { ROUTE_META } from '../../src/ui/routes';
import { writeEvidence } from './diagnostics';
import { test } from './fixture';
import { closeSettings, commandAvailable, pluginData, rendered } from './host-probes';
import { fallowBinary, fallowProcessCount } from './inspector-fallow';
import type { InspectorPage } from './inspector';
import type { NativeBrowser } from './session';
import { copyProject, recordingFindingCount, writeSyntheticTree } from './workspace-files';

interface SavedProfile { profileId: string; name: string }
interface SavedAnalyzer { executablePath: string; trust: { version: string } | null }

/** NPF8: the tree for cancel-fallow-analysis (an uncancelled run took about 11 s), and the shortest uncancelled run
 *  that leaves a window to cancel in. */
const SYNTHETIC_FILES = 10_000;
const MIN_WINDOW_MS = 2_000;
/** A fallow run, from Trust and run or the command to its collected report. */
const RUN_TIMEOUT = { timeout: 120_000 };

const vaultHas = async (browser: NativeBrowser, path: string): Promise<boolean> =>
  Boolean(await browser.executeObsidian(({ app }, target) => app.vault.adapter.exists(target), path));

/** The one profile scan-codebase saved, and this device's analyzer records, read from data.json (main window). */
async function saved(browser: NativeBrowser): Promise<{ profile: SavedProfile; analyzers: Record<string, SavedAnalyzer> | undefined }> {
  const data = await pluginData(browser);
  const profiles = (data.profiles ?? []) as SavedProfile[];
  expect(profiles).toHaveLength(1);
  return { profile: profiles[0]!, analyzers: data.analyzers as Record<string, SavedAnalyzer> | undefined };
}

/** Data & scans, where the fallow card and its run panel are. */
async function openSources(inspector: InspectorPage): Promise<void> {
  await inspector.navigate(ROUTE_META.sources.title);
  await expect.poll(() => inspector.screen(ROUTE_META.sources.id).isExisting()).toBe(true);
}

describe('the installed fallow run by command id in the real Obsidian host (WP-04.2 §5 rows 8, 9, 15)', () => {
  test('run-fallow-analysis runs the installed fallow on the scanned codebase', async ({ native: { browser, page, inspector, directory } }) => {
    const binary = fallowBinary();
    copyProject(page.getVaultPath(), 'code');
    await expect.poll(() => vaultHas(browser, 'code/src/core/a.ts')).toBe(true);
    await inspector.openCity();
    await inspector.scanFolder('code');

    // Negative control first: the command is offered (a snapshot, no analysis), there is nothing to cancel, no
    // executable is stored, and Data & scans' fallow card has no report attached.
    await openSources(inspector);
    expect(await inspector.root().$('.ci-fallow-card__none').isExisting()).toBe(true);
    expect(await inspector.fallowFacts()).toBeNull();
    expect((await saved(browser)).analyzers).toBeUndefined();
    await inspector.activateCity();
    expect(await commandAvailable(browser, 'run-fallow-analysis')).toBe(true);
    expect(await commandAvailable(browser, 'cancel-fallow-analysis')).toBe(false);

    // The command: no executable is chosen yet, so it opens the installed route at its path; Check, then trust in the
    // review. The run is over once the card shows a collected report.
    await browser.executeObsidianCommand('codebase-inspector:run-fallow-analysis');
    await inspector.reviewFallow(binary);
    await inspector.trustAndRun();
    await expect.poll(() => inspector.fallowCollectedAt(), RUN_TIMEOUT).not.toBeNull();
    await expect.poll(() => commandAvailable(browser, 'cancel-fallow-analysis')).toBe(false);
    const { profile, analyzers } = await saved(browser);
    const version = analyzers?.[profile.profileId]?.trust?.version ?? null;
    const card = { banner: await inspector.fallowBanner(), collectedAt: await inspector.fallowCollectedAt() };

    // Investigate lists the findings the recording's normaliser gives this project, every page shown.
    const listed = await inspector.listedFindings();
    const expected = recordingFindingCount();
    await writeEvidence(directory, 'fallow-run', {
      binary, version, tested: FALLOW_TESTED_VERSIONS, ...card, listed, expected,
    });
    expect(version).not.toBeNull();
    expect(listed).toBe(expected);
    // Each listed finding came from this run: its evidence says origin collected.
    for (let i = 0; i < listed; i += 1) {
      const row = inspector.root().$$('.ci-investigate-row')[i]!;
      await row.click();
      await expect.poll(() => row.getAttribute('aria-current')).toBe('true');
      await expect.poll(async () => (await inspector.evidence()).rows[INVESTIGATE_ROW_ORIGIN]).toBe(INVESTIGATE_ORIGIN_TEXT.collected);
    }
  }, 300_000);

  test('cancel-fallow-analysis stops a running analysis and is refused when none runs', async ({ native: { browser, page, inspector, directory } }) => {
    const binary = fallowBinary();
    // No fallow runs on the system before this test, so a count of 0 after the cancel is about this run's child.
    const baseline = fallowProcessCount();
    expect(baseline).toBe(0);
    const tree = join(page.getVaultPath(), 'big');
    writeSyntheticTree(tree, SYNTHETIC_FILES);
    await expect.poll(() => vaultHas(browser, 'big/src/index.ts')).toBe(true);
    await inspector.openCity();
    let started = Date.now();
    await inspector.scanFolder('big');
    const scanMs = Date.now() - started;
    await openSources(inspector);

    // Refused: no analysis runs, so cancel is not offered (its sibling, answering the same check, is), and running it
    // by id anyway leaves the run panel without a banner and the card without a report.
    await inspector.activateCity();
    expect(await commandAvailable(browser, 'run-fallow-analysis')).toBe(true);
    expect(await commandAvailable(browser, 'cancel-fallow-analysis')).toBe(false);
    await browser.executeObsidianCommand('codebase-inspector:cancel-fallow-analysis');
    await rendered(browser);
    expect(await inspector.fallowBanner()).toBeNull();
    expect(await inspector.fallowFacts()).toBeNull();
    expect(await commandAvailable(browser, 'cancel-fallow-analysis')).toBe(false);

    // Positive control (NE8, WP-04.2 E8): an UNCANCELLED run on the same tree, timed from Trust and run to its
    // collected report. It also attaches the report the cancelled run below must leave in place.
    await browser.executeObsidianCommand('codebase-inspector:run-fallow-analysis');
    await inspector.reviewFallow(binary);
    started = Date.now();
    await inspector.trustAndRun();
    await expect.poll(() => inspector.fallowCollectedAt(), RUN_TIMEOUT).not.toBeNull();
    const controlMs = Date.now() - started;
    const control = { banner: await inspector.fallowBanner(), facts: await inspector.fallowFacts(), collectedAt: await inspector.fallowCollectedAt() };
    await writeEvidence(directory, 'mid-run-window', { files: SYNTHETIC_FILES, scanMs, controlMs, control });
    if (controlMs < MIN_WINDOW_MS) throw new Error('mid-run window too short');
    await expect.poll(() => commandAvailable(browser, 'cancel-fallow-analysis')).toBe(false);
    // A file nothing imports: a second run that completed would report it, so its report could not read as the control's.
    writeFileSync(join(tree, 'src', 'unreached.ts'), 'export const unreached = 1;\n');

    // The cancel: the executable is trusted now, so the command starts the run with no dialog. Sent only once cancel's
    // own checkCallback answers true, the run is past its version probe, and the system lists its fallow process
    // (the positive control for the process check below).
    await inspector.activateCity();
    await browser.executeObsidianCommand('codebase-inspector:run-fallow-analysis');
    await expect.poll(() => commandAvailable(browser, 'cancel-fallow-analysis')).toBe(true);
    await expect.poll(() => inspector.fallowBanner()).not.toBe(FALLOW_RUN_PROBING(true));
    await expect.poll(() => fallowProcessCount()).toBeGreaterThanOrEqual(1);
    const running = fallowProcessCount();
    expect(await commandAvailable(browser, 'cancel-fallow-analysis')).toBe(true);
    await browser.executeObsidianCommand('codebase-inspector:cancel-fallow-analysis');
    await expect.poll(() => inspector.fallowBanner(), { timeout: 30_000 }).toBe(FALLOW_RUN_CANCELLED);
    await expect.poll(() => fallowProcessCount(), { timeout: 30_000 }).toBe(0);
    await expect.poll(() => commandAvailable(browser, 'cancel-fallow-analysis')).toBe(false);
    const after = { facts: await inspector.fallowFacts(), collectedAt: await inspector.fallowCollectedAt() };
    await writeEvidence(directory, 'cancelled', { baseline, running, control, after });
    // No new collected report replaced the control's.
    expect(after).toEqual({ facts: control.facts, collectedAt: control.collectedAt });
  }, 300_000);

  test('the settings tab shows a fallow executable trusted in Data & scans', async ({ native: { browser, page, inspector, directory } }) => {
    const binary = fallowBinary();
    copyProject(page.getVaultPath(), 'code');
    await expect.poll(() => vaultHas(browser, 'code/src/core/a.ts')).toBe(true);
    await inspector.openCity();
    await inspector.scanFolder('code');
    const { profile, analyzers: before } = await saved(browser);
    expect(before).toBeUndefined();
    const description = async (): Promise<string> =>
      String(await inspector.settingsRow(SETTINGS_FALLOW_EXECUTABLE_NAME).$('.setting-item-description').getProperty('textContent')).trim();

    // Before the trust: the tab has rendered this codebase's page, which says no executable is chosen.
    await inspector.openCodebaseSettings(profile.name);
    await expect.poll(description).toBe(FALLOW_EXE_NONE);
    await closeSettings(browser);

    // Data & scans: Connect fallow → the installed route → Trust and run; the run is let finish.
    await inspector.connectFallow(binary);
    await inspector.trustAndRun();
    await expect.poll(() => inspector.fallowCollectedAt(), RUN_TIMEOUT).not.toBeNull();
    // Positive control: the trust wrote this codebase's executable and its trust to data.json.
    const record = (await saved(browser)).analyzers?.[profile.profileId];
    expect(record?.executablePath).toBe(binary);
    const version = record?.trust?.version ?? '';
    expect(version).toMatch(/^\d+\.\d+\.\d+$/u);
    const trust = FALLOW_TRUST_VALUE(version, FALLOW_TESTED_VERSIONS.includes(version));

    // No plugin reload: the page shows the bound path and its trust.
    await inspector.openCodebaseSettings(profile.name);
    await expect.poll(description).toContain(binary);
    const shown = await description();
    expect(shown.startsWith(binary)).toBe(true);
    expect(shown.endsWith(trust)).toBe(true);
    await closeSettings(browser);
    await writeEvidence(directory, 'settings-analyzer', { binary, record, shown });
  }, 300_000);
});
