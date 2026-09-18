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

describe('install-to-vault', () => {
  it('refuses to run when CODEBASE_INSPECTOR_TEST_VAULT is unset', () => {
    expect(() => run('')).toThrow(/CODEBASE_INSPECTOR_TEST_VAULT/);
  });

  it('refuses a target that is not a vault', () => {
    expect(() => run(mkdtempSync(join(tmpdir(), 'ci-notvault-')))).toThrow(/not a vault/i);
  });

  it('refuses a target that resolves inside this repository', () => {
    expect(() => run(fileURLToPath(new URL('../../', import.meta.url)))).toThrow(/inside this repository/i);
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
    const distSource = mkdtempSync(join(tmpdir(), 'ci-dist-'));
    for (const f of ['main.js', 'manifest.json', 'styles.css']) {
      writeFileSync(join(distSource, f), `fake ${f}`);
    }
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
