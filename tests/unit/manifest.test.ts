import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// Typed so JSON.parse's result isn't `any` — an untyped fixture forced
// @typescript-eslint/no-unsafe-* off across every access below, which is a
// permanent type-safety reduction that isn't needed once the shape is known.
interface ManifestJson {
  id: string;
  name: string;
  version: string;
  minAppVersion: string;
  description: string;
  author: string;
  authorUrl: string;
  isDesktopOnly: boolean;
}

const manifest = JSON.parse(
  readFileSync(fileURLToPath(new URL('../../manifest.json', import.meta.url)), 'utf8'),
) as ManifestJson;
const ALLOWED = new Set(['id', 'name', 'version', 'minAppVersion', 'description',
                         'author', 'authorUrl', 'isDesktopOnly']);

describe('manifest.json', () => {
  it('uses the exact plugin id the install folder must match', () => {
    // A different folder name means onExternalSettingsChange never fires.
    expect(manifest.id).toBe('codebase-inspector');
  });

  it('declares a three-segment minAppVersion so semver.gt does not break', () => {
    expect(manifest.minAppVersion).toMatch(/^\d+\.\d+\.\d+$/);
    expect(manifest.minAppVersion).toBe('1.13.0');
  });

  it('is desktop only', () => {
    expect(manifest.isDesktopOnly).toBe(true);
  });

  it('has no non-schema keys, which the linter reports as disallowedKey', () => {
    expect(Object.keys(manifest).filter((k) => !ALLOWED.has(k))).toEqual([]);
  });

  it('omits fundingUrl', () => {
    expect(manifest).not.toHaveProperty('fundingUrl');
  });

  it('satisfies the machine-validated description rules', () => {
    const d: string = manifest.description;
    expect(d.length).toBeGreaterThanOrEqual(10);
    expect(d.length).toBeLessThanOrEqual(250);
    // charAt(), not d[0]: noUncheckedIndexedAccess (tsconfig.json) types a bracket
    // index as `string | undefined`, which does not typecheck against .toUpperCase().
    expect(d.charAt(0)).toBe(d.charAt(0).toUpperCase());
    expect(d.endsWith('.')).toBe(true);
    expect(d.toLowerCase()).not.toContain('obsidian');
    expect(d.toLowerCase()).not.toContain('plugin');
    expect(/\p{Extended_Pictographic}/u.test(d)).toBe(false);
  });
});
