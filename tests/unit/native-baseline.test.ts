import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// IN49 (IP47, IPF3): the native suite's default Obsidian version must satisfy the plugin's minAppVersion.
// Both are read as text, so this fast-suite test never imports the WDIO-typed session module.
const manifest = JSON.parse(readFileSync(resolve('manifest.json'), 'utf8')) as { minAppVersion: string };
const session = readFileSync(resolve('tests/e2e/session.ts'), 'utf8');
const baseline = /export const NATIVE_BASELINE_VERSION = '([^']+)';/u.exec(session)?.[1];

function segments(version: string): number[] {
  expect(version).toMatch(/^\d+\.\d+\.\d+$/u);
  return version.split('.').map(Number);
}

function compare(left: number[], right: number[]): number {
  for (let index = 0; index < Math.max(left.length, right.length); index += 1) {
    const difference = (left[index] ?? 0) - (right[index] ?? 0);
    if (difference !== 0) return difference;
  }
  return 0;
}

describe('native baseline Obsidian version', () => {
  it('is at or above manifest.json minAppVersion, compared by numeric segments', () => {
    expect(baseline).toBeDefined();
    const actual = segments(baseline ?? '');
    const minimum = segments(manifest.minAppVersion);
    expect(compare(actual, minimum), `${baseline} < minAppVersion ${manifest.minAppVersion}`).toBeGreaterThanOrEqual(0);
  });
});
