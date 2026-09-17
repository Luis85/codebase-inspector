import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const script = fileURLToPath(new URL('../../scripts/install-to-vault.mjs', import.meta.url));
const run = (vault: string) =>
  execFileSync('node', [script], {
    env: { ...process.env, CODEBASE_INSPECTOR_TEST_VAULT: vault },
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

  it('copies dist and writes the .hotreload marker', () => {
    const vault = mkdtempSync(join(tmpdir(), 'ci-vault-'));
    mkdirSync(join(vault, '.obsidian'), { recursive: true });
    writeFileSync(join(vault, '.obsidian', 'app.json'), '{}');
    run(vault);
    const dest = join(vault, '.obsidian', 'plugins', 'codebase-inspector');
    for (const f of ['main.js', 'manifest.json', 'styles.css', '.hotreload']) {
      expect(existsSync(join(dest, f)), f).toBe(true);
    }
  });
});
