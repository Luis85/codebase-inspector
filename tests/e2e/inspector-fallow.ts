// WP-04.2 NE7 (NP2): the fallow steps of the inspector page, spread into createInspectorPage, and the Node-side
// facts the fallow scenarios need: the binary (NP7) and the fallow processes the Obsidian under test is running.
// The flow is Data & scans' own (probe g): the Connect fallow dialog's installed route takes a path, Check shows the
// review of exactly what will run, and Trust and run starts it. IPF20: selectors, and the plugin's own words only
// through its copy constants.
import { spawn, spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
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

/** How many `fallow.exe` processes the whole system runs now, from `tasklist` (spawned directly, no shell). Counted
 *  as the CSV rows naming the image, so the localised "no tasks" line counts as none. */
export function machineFallowCount(): number {
  const listed = spawnSync('tasklist', ['/FI', `IMAGENAME eq ${FALLOW_IMAGE}`, '/FO', 'CSV', '/NH'], { encoding: 'utf8', windowsHide: true });
  if (listed.error !== undefined || listed.status !== 0) throw new Error(`tasklist failed: ${String(listed.error ?? listed.stderr)}`);
  return listed.stdout.split(/\r?\n/u).filter((line) => line.toLowerCase().startsWith(`"${FALLOW_IMAGE}"`)).length;
}

/** The pid of the Obsidian renderer under test, the process the plugin's fallow runner spawns from. */
export const obsidianPid = (browser: NativeBrowser): Promise<number> => browser.executeObsidian(() => process.pid);

interface ProcessRow { pid: number; parent: number; created: bigint; name: string }

/** One `Win32_Process` snapshot of the system: pid, parent pid, creation time (FILETIME, 0 when unknown), image. */
function processTable(): ProcessRow[] {
  const script = 'Get-CimInstance Win32_Process | ForEach-Object { "$($_.ProcessId) $($_.ParentProcessId) '
    + '$(if ($_.CreationDate) { $_.CreationDate.ToFileTimeUtc() } else { 0 }) $($_.Name)" }';
  const listed = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], { encoding: 'utf8', timeout: 30_000, windowsHide: true });
  const timedOut = (listed.error as { code?: unknown } | undefined)?.code === 'ETIMEDOUT' || listed.signal !== null;
  if (timedOut) throw new Error(`powershell.exe Get-CimInstance Win32_Process failed: timed out after 30 s (${String(listed.error ?? listed.signal)})`);
  if (listed.error !== undefined || listed.status !== 0) throw new Error(`powershell.exe Get-CimInstance Win32_Process failed: ${String(listed.error ?? listed.stderr)}`);
  return listed.stdout.split(/\r?\n/u).flatMap((line) => {
    const row = /^(\d+) (\d+) (\d+) (.+)$/u.exec(line.trim());
    return row === null ? [] : [{ pid: Number(row[1]), parent: Number(row[2]), created: BigInt(row[3]!), name: row[4]!.toLowerCase() }];
  });
}

/** WP-04.2 Follow-up E6: how many `fallow.exe` processes descend from `root` (the Obsidian under test), walking
 *  parent pids down from it; another session's fallow is not counted. A child is taken only when created after its
 *  parent, so a process whose dead parent's pid was reused inside the tree stays out. */
export function fallowProcessCount(root: number): number {
  const table = processTable();
  const tree = new Map<number, bigint>();
  for (const row of table) if (row.pid === root) tree.set(row.pid, row.created);
  if (tree.size === 0) throw new Error(`the Obsidian process ${root} is not running`);
  for (let grew = true; grew;) {
    grew = false;
    for (const row of table) {
      const parentCreated = tree.get(row.parent);
      if (!tree.has(row.pid) && parentCreated !== undefined && row.created >= parentCreated) {
        tree.set(row.pid, row.created);
        grew = true;
      }
    }
  }
  return table.filter((row) => row.pid !== root && tree.has(row.pid) && row.name === FALLOW_IMAGE).length;
}

/** WP-04.2 Follow-up E6: a live process named `fallow.exe` that the test's Obsidian did not start, as another
 *  session's `fallow dupes` is. It is a copy of the system's PING.EXE pinging localhost, so it runs no fallow. */
export async function startForeignFallow(): Promise<{ pid: number; stop: () => Promise<void> }> {
  const dir = mkdtempSync(join(tmpdir(), 'ci-foreign-fallow-'));
  const exe = join(dir, FALLOW_IMAGE);
  try {
    copyFileSync(join(process.env.SystemRoot ?? 'C:\\Windows', 'System32', 'PING.EXE'), exe);
    // 330 pings, about 329 s: just over the 300 s test timeout, so a crashed worker's orphan dies on its own.
    const child = spawn(exe, ['-n', '330', '127.0.0.1'], { stdio: 'ignore', windowsHide: true });
    const exited = new Promise<void>((done) => { child.once('exit', () => done()); });
    await new Promise<void>((spawned, failed) => { child.once('spawn', spawned); child.once('error', failed); });
    return {
      pid: child.pid!,
      stop: async () => {
        child.kill();
        await exited;
        rmSync(dir, { recursive: true, force: true, maxRetries: 10 });
      },
    };
  } catch (error) {
    // The foreign spawn failed or threw: its temporary folder must not outlive it.
    rmSync(dir, { recursive: true, force: true, maxRetries: 10 });
    throw error;
  }
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
