import path from 'node:path';
import { mkdir, writeFile } from 'node:fs/promises';
import type { NativeBrowser } from './session';

export async function caseDirectory(id: string, name: string): Promise<string> {
  const safe = `${id}-${name}`.replace(/[^a-z0-9_-]+/giu, '-').slice(0, 160);
  const directory = path.resolve('reports/native/cases', safe);
  await mkdir(directory, { recursive: true });
  return directory;
}

export async function writeEvidence(directory: string, name: string, value: unknown): Promise<void> {
  await writeFile(path.join(directory, `${name}.json`), `${JSON.stringify(value, (_key, item: unknown) =>
    item instanceof Error ? { name: item.name, message: item.message, stack: item.stack } : item, 2)}\n`);
}

/** Capture every case, including failures, before the application is disposed. */
export async function captureBrowser(browser: NativeBrowser, directory: string): Promise<void> {
  const errors: unknown[] = [];
  try { await browser.saveScreenshot(path.join(directory, 'screenshot.png')); }
  catch (error) { errors.push(error); }
  try { await writeFile(path.join(directory, 'page.html'), await browser.getPageSource()); }
  catch (error) { errors.push(error); }
  if (errors.length) await writeEvidence(directory, 'diagnostic-errors', errors);
}
