import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const script = fileURLToPath(new URL('../../scripts/install-to-vault.mjs', import.meta.url));
const run = (vault: string, extraEnv: Record<string, string> = {}) =>
  execFileSync('node', [script], {
    env: { ...process.env, CODEBASE_INSPECTOR_TEST_VAULT: vault, ...extraEnv },
    encoding: 'utf8', stdio: 'pipe',
  });
/** A private, throwaway "dist" (never the real one; see the copy test's note below). */
function fakeDist(): string {
  const dir = mkdtempSync(join(tmpdir(), 'ci-dist-'));
  for (const f of ['main.js', 'manifest.json', 'styles.css']) writeFileSync(join(dir, f), `fake ${f}`);
  return dir;
}

describe('install-to-vault', () => {
  it('refuses to run when CODEBASE_INSPECTOR_TEST_VAULT is unset', () => {
    expect(() => run('')).toThrow(/CODEBASE_INSPECTOR_TEST_VAULT/);
  });

  // Checked before anything is created, so it holds in a checkout with no .obsidian/
  // (a git worktree) as well as in one that has it.
  it('refuses a target that resolves inside this repository', () => {
    expect(() => run(fileURLToPath(new URL('../../', import.meta.url)))).toThrow(/inside this repository/i);
    const nested = fileURLToPath(new URL('../../.ci-not-a-vault/', import.meta.url));
    expect(() => run(nested)).toThrow(/inside this repository/i);
    expect(existsSync(nested), 'nothing is created inside the repository').toBe(false);
  });

  it('creates a missing vault folder, its config directory and the plugin folder, then installs', () => {
    const distSource = fakeDist();
    const vault = join(mkdtempSync(join(tmpdir(), 'ci-newvault-')), 'nested', 'vault');
    const out = run(vault, { CODEBASE_INSPECTOR_TEST_DIST_SOURCE: distSource });
    const dest = join(vault, '.obsidian', 'plugins', 'codebase-inspector');
    for (const f of ['main.js', 'manifest.json', 'styles.css', '.hotreload']) {
      expect(existsSync(join(dest, f)), f).toBe(true);
    }
    expect(out).toMatch(/created .*\.obsidian/i);
  });

  it('creates a custom config directory when it is missing', () => {
    const distSource = fakeDist();
    const vault = mkdtempSync(join(tmpdir(), 'ci-customdir-'));
    run(vault, { CODEBASE_INSPECTOR_TEST_DIST_SOURCE: distSource, CODEBASE_INSPECTOR_TEST_VAULT_CONFIG_DIR: '.my-config' });
    expect(existsSync(join(vault, '.my-config', 'plugins', 'codebase-inspector', 'main.js'))).toBe(true);
    expect(existsSync(join(vault, '.obsidian'))).toBe(false);
  });

  it('refuses a target, or a config directory, that exists as a file', () => {
    const parent = mkdtempSync(join(tmpdir(), 'ci-fileclash-'));
    const asFile = join(parent, 'vault.txt');
    writeFileSync(asFile, 'not a folder');
    expect(() => run(asFile, { CODEBASE_INSPECTOR_TEST_DIST_SOURCE: fakeDist() })).toThrow(/not a folder/i);
    writeFileSync(join(parent, '.obsidian'), 'not a folder');
    expect(() => run(parent, { CODEBASE_INSPECTOR_TEST_DIST_SOURCE: fakeDist() })).toThrow(/not a folder/i);
  });

  it('says to build first when there is nothing to copy', () => {
    const vault = mkdtempSync(join(tmpdir(), 'ci-nodist-'));
    const missing = join(mkdtempSync(join(tmpdir(), 'ci-nodist-src-')), 'dist');
    expect(() => run(vault, { CODEBASE_INSPECTOR_TEST_DIST_SOURCE: missing })).toThrow(/npm run build/);
    expect(existsSync(join(vault, '.obsidian')), 'nothing is created before the source is known to exist').toBe(false);
  });

  // Task 9 fix round 3, item 3 (fold): a real, 1-in-5 flake, verified independently
  // (not this task's own defect) -- this test used to `cpSync` from the SAME
  // repo-root dist/ that tests/host/build-output.test.ts's beforeAll rebuilds in a
  // parallel worker (vite.config.ts's emptyOutDir: true deletes then re-emits it),
  // so a copy landing inside that window silently omitted whatever file was not
  // back yet: `AssertionError: main.js: expected false to be true`. This is
  // purely a test for install-to-vault.mjs's OWN copy-and-marker behaviour, which
  // needs no relationship to the REAL build output at all -- so it now builds its
  // own private, throwaway "dist"-shaped directory and points the script's source
  // at that instead (CODEBASE_INSPECTOR_TEST_DIST_SOURCE, install-to-vault.mjs's
  // own new override), decoupling the two files entirely rather than serialising
  // them (which would slow every future run and hide the coupling, not remove it).
  it('copies dist and writes the .hotreload marker', () => {
    const distSource = fakeDist();
    const vault = mkdtempSync(join(tmpdir(), 'ci-vault-'));
    mkdirSync(join(vault, '.obsidian'), { recursive: true });
    writeFileSync(join(vault, '.obsidian', 'app.json'), '{}');
    run(vault, { CODEBASE_INSPECTOR_TEST_DIST_SOURCE: distSource });
    const dest = join(vault, '.obsidian', 'plugins', 'codebase-inspector');
    for (const f of ['main.js', 'manifest.json', 'styles.css', '.hotreload']) {
      expect(existsSync(join(dest, f)), f).toBe(true);
    }
  });
});
