import { spawnSync } from 'node:child_process';
import { appendFileSync } from 'node:fs';
import path from 'node:path';
import { runDirectory } from './diagnostics';

let failures = 0;

/** GRD1: one synchronous NDJSON line per session phase, so a worker that dies by __fastfail leaves its last phase on disk.
 *  Never throws into a test: a failed append is counted and reported in the next line. */
export function breadcrumb(phase: string, extra: Record<string, unknown> = {}): void {
  try {
    const memory = process.memoryUsage();
    appendFileSync(path.join(runDirectory(), 'breadcrumbs.ndjson'), `${JSON.stringify({
      at: new Date().toISOString(), pid: process.pid, phase, rss: memory.rss, heapUsed: memory.heapUsed,
      handles: process.getActiveResourcesInfo().length, breadcrumbFailures: failures, ...extra,
    })}\n`);
  } catch {
    failures += 1;
  }
}

/** Obsidian and chromedriver processes on the machine (one tasklist call); null where tasklist is unavailable. */
export function hostProcessCounts(): { obsidian: number; chromedriver: number } | null {
  if (process.platform !== 'win32') return null;
  const listed = spawnSync('tasklist', ['/FO', 'CSV', '/NH'], { encoding: 'utf8', timeout: 10_000, windowsHide: true });
  if (listed.status !== 0 || typeof listed.stdout !== 'string') return null;
  const names = listed.stdout.split(/\r?\n/u).map((line) => line.split('","')[0]?.replace(/^"/u, '').toLowerCase() ?? '');
  return { obsidian: names.filter((n) => n === 'obsidian.exe').length, chromedriver: names.filter((n) => n === 'chromedriver.exe').length };
}
