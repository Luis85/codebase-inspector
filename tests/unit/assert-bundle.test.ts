// Breakage round, item 2: scripts/assert-bundle.mjs logged its `OK` line
// UNCONDITIONALLY, after fail() may already have run -- fail() sets
// `process.exitCode = 1` and RETURNS, so CI's exit status was right while the last line
// of the build log said OK. The `OK` line predates this branch's fix wave, but that wave
// added two new failure modes behind it (the dev fixture, and bundled Node built-ins),
// so the misleading output is now reachable for the guards this work introduced.
//
// The script resolves its target as `new URL('../dist/', import.meta.url)`, so it is
// exercised by copying it into a temp tree with a fabricated dist/ beside it -- the real
// script file, byte for byte, never a re-implementation of its logic here.
import { describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const script = fileURLToPath(new URL('../../scripts/assert-bundle.mjs', import.meta.url));

// The minimum a bundle needs to clear every OTHER guard in the script, so each case
// below turns exactly one of them red and nothing else.
// Part 7 Z38 (K23): a real bundle names node:child_process exactly once, in node-process-access.ts's window.require.
const CLEAN_MAIN = 'Object.defineProperty(exports, "__esModule", { value: true });\nexports.default = X;\nwindow.require("node:child_process");\n';

function runAgainst(mainJs: string): { status: number | null; stdout: string; stderr: string } {
  const root = mkdtempSync(join(tmpdir(), 'ci-assert-bundle-'));
  mkdirSync(join(root, 'scripts'));
  mkdirSync(join(root, 'dist'));
  copyFileSync(script, join(root, 'scripts', 'assert-bundle.mjs'));
  writeFileSync(join(root, 'dist', 'main.js'), mainJs);
  writeFileSync(join(root, 'dist', 'manifest.json'), '{}');
  writeFileSync(join(root, 'dist', 'styles.css'), '');
  const result = spawnSync('node', [join(root, 'scripts', 'assert-bundle.mjs')], { encoding: 'utf8' });
  return { status: result.status, stdout: result.stdout, stderr: result.stderr };
}

describe('assert-bundle', () => {
  it('says OK, and exits 0, for a bundle that clears every guard', () => {
    const { status, stdout, stderr } = runAgainst(CLEAN_MAIN);
    expect(stderr).toBe('');
    expect(stdout).toContain('assert-bundle: OK');
    expect(status).toBe(0);
  });

  it('never says OK after a failure, and says so in its LAST line', () => {
    // The dev fixture: one of the two failure modes this branch's fix wave added behind
    // the unconditional OK.
    const { status, stdout, stderr } = runAgainst(`${CLEAN_MAIN}import('../../tests/fixtures/dev-fixture');\n`);
    expect(stderr).toContain('contains the dev fixture');
    expect(stdout).not.toContain('OK');
    expect(`${stdout}${stderr}`.trimEnd().split('\n').at(-1)).toMatch(/assert-bundle: FAILED/);
    expect(status).toBe(1);
  });

  it('still reports EVERY reason, not just the first, before that failure line', () => {
    const { stdout, stderr } = runAgainst('exports.default = X;\nrequire("fs");\nnew Function("x");\n');
    expect(stderr).toContain('runtime compiler');
    expect(stderr).toContain('named-CommonJS shape');
    expect(stderr).toContain('bundles Node built-in(s): fs');
    expect(stdout).not.toContain('OK');
  });

  it('Part 7 Z38: refuses a bundle that names node:child_process other than once, in window.require', () => {
    const none = runAgainst('Object.defineProperty(exports, "__esModule", { value: true });\nexports.default = X;\n');
    expect(none.stderr).toContain('must name node:child_process exactly once');
    expect(none.status).toBe(1);
    const twice = runAgainst(`${CLEAN_MAIN}const s = "node:child_process";\n`);
    expect(twice.stderr).toContain('must name node:child_process exactly once');
    expect(twice.status).toBe(1);
  });

  it('Polish A5: refuses a bare child_process specifier, even through window.require', () => {
    const viaWindow = runAgainst(`${CLEAN_MAIN}window.require('child_process');\n`);
    expect(viaWindow.stderr).toContain("names the bare 'child_process' module 1 time(s)");
    expect(viaWindow.status).toBe(1);
    expect(runAgainst(CLEAN_MAIN).status).toBe(0);
  });
});
