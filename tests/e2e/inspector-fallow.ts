// WP-04.2 NE7 (NP2): the fallow steps of the inspector page, spread into createInspectorPage, and the Node-side
// facts the fallow scenarios need: the binary (NP7) and the fallow processes the system is running.
// The flow is Data & scans' own (probe g): the Connect fallow dialog's installed route takes a path, Check shows the
// review of exactly what will run, and Trust and run starts it. IPF20: selectors, and the plugin's own words only
// through its copy constants.
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect } from 'vitest';
import { FALLOW_ROW_COLLECTED } from '../../src/ui/audit-copy/fallow-run';
import { ROUTE_META } from '../../src/ui/routes';
import { CITY_VIEW_TYPE, type NativeBrowser } from './session';

/** Written by `npm run test:fallow` (NE7). */
const BIN_PATH_FILE = resolve('.fallow-bin/bin-path.txt');
/** fallow's executable image name on this system (Windows only, IN50). */
const FALLOW_IMAGE = 'fallow.exe';

/** NE7: `FALLOW_BIN`, else `.fallow-bin/bin-path.txt`; with neither, the scenario fails naming both (never a skip). */
export function fallowBinary(): string {
  const fromEnv = process.env.FALLOW_BIN?.trim() ?? '';
  const fromFile = fromEnv === '' && existsSync(BIN_PATH_FILE) ? readFileSync(BIN_PATH_FILE, 'utf8').trim() : '';
  const binary = fromEnv === '' ? fromFile : fromEnv;
  if (binary === '') throw new Error(`no fallow binary: set FALLOW_BIN, or run npm run test:fallow to write ${BIN_PATH_FILE}`);
  if (!existsSync(binary)) throw new Error(`the fallow binary ${binary} (from ${fromEnv === '' ? BIN_PATH_FILE : 'FALLOW_BIN'}) does not exist`);
  return binary;
}

/** How many `fallow.exe` processes the system runs now, from `tasklist` (spawned directly, no shell). Counted as
 *  the CSV rows naming the image, so the localised "no tasks" line counts as none. */
export function fallowProcessCount(): number {
  const listed = spawnSync('tasklist', ['/FI', `IMAGENAME eq ${FALLOW_IMAGE}`, '/FO', 'CSV', '/NH'], { encoding: 'utf8', windowsHide: true });
  if (listed.error !== undefined || listed.status !== 0) throw new Error(`tasklist failed: ${String(listed.error ?? listed.stderr)}`);
  return listed.stdout.split(/\r?\n/u).filter((line) => line.toLowerCase().startsWith(`"${FALLOW_IMAGE}"`)).length;
}

export function createFallowSteps(
  browser: NativeBrowser, root: () => ReturnType<NativeBrowser['$']>, navigate: (title: string) => Promise<void>,
) {
  /** The installed route (the command or Use installed fallow… opened it): the path, Check, and its review. */
  const reviewFallow = async (binary: string): Promise<void> => {
    const path = root().$('.ci-fallow-installed__path');
    await expect.poll(() => path.isExisting()).toBe(true);
    await path.setValue(binary);
    await expect.poll(() => path.getValue()).toBe(binary);
    await root().$('.ci-fallow-installed__check').click();
    await expect.poll(() => root().$('.ci-fallow-installed__trust').isExisting()).toBe(true);
  };
  /** The fallow card's text read from the leaf's DOM (queried afresh: Vue replaces elements as the run moves on). */
  const cardText = (selector: string): Promise<string | null> => browser.executeObsidian(({ app }, type, css): string | null => {
    const el = app.workspace.getLeavesOfType(type)[0]?.view.containerEl.querySelector(css);
    return el?.textContent?.trim() ?? null;
  }, CITY_VIEW_TYPE, selector);
  return {
    reviewFallow,
    /** Data & scans → Connect fallow… → Use installed fallow… → the path → its review (the dialog stays open). */
    async connectFallow(binary: string): Promise<void> {
      await navigate(ROUTE_META.sources.title);
      const connect = root().$('.ci-fallow-card__import');
      await expect.poll(() => connect.isExisting()).toBe(true);
      await connect.click();
      const installed = root().$('.ci-connect-fallow__use-installed');
      await expect.poll(() => installed.isExisting()).toBe(true);
      await installed.click();
      await reviewFallow(binary);
    },
    /** The review's Trust and run; done once the dialog has closed, which it does only on a started run. */
    async trustAndRun(): Promise<void> {
      await root().$('.ci-fallow-installed__trust').click();
      await expect.poll(() => root().$('.ci-fallow-installed').isExisting(), { timeout: 30_000 }).toBe(false);
    },
    /** The run panel's banner text (FallowRunBanner.vue), or null when it shows none. */
    fallowBanner: (): Promise<string | null> => cardText('.ci-fallow-run__banner-text'),
    /** The fallow card's report facts as one text, or null when no report is attached. */
    fallowFacts: (): Promise<string | null> => cardText('.ci-fallow-card .ci-fallow-facts'),
    /** The time the card's report was collected (its Collected row), or null: no report, or an imported one. */
    fallowCollectedAt: (): Promise<string | null> => browser.executeObsidian(({ app }, type, label): string | null => {
      const terms = app.workspace.getLeavesOfType(type)[0]?.view.containerEl.querySelectorAll('.ci-fallow-card .ci-fallow-facts > dt') ?? [];
      const term = [...terms].find((dt) => dt.textContent?.trim() === label);
      return term?.nextElementSibling?.textContent?.trim() ?? null;
    }, CITY_VIEW_TYPE, FALLOW_ROW_COLLECTED),
  };
}
