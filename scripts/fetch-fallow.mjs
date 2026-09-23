// scripts/fetch-fallow.mjs — Part 7 Z40, for `npm run test:fallow` ONLY (never `npm run
// verify`, never a dependency). Puts the pinned fallow@3.27.0 and its platform package in
// the git-ignored .fallow-bin/, and writes the binary's path to .fallow-bin/bin-path.txt.
// FALLOW_BIN=<path> skips all of this and tests that binary instead. No shell: npm's own
// CLI runs under this Node, through npm_execpath.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const VERSION = '3.27.0';
const root = fileURLToPath(new URL('../', import.meta.url));
const dir = join(root, '.fallow-bin');
const fail = (message) => { console.error(`fetch-fallow: ${message}`); process.exit(1); };

function binaries() {
  const scope = join(dir, 'node_modules', '@fallow-cli');
  if (!existsSync(scope)) return [];
  return readdirSync(scope)
    .flatMap((pkg) => ['fallow', 'fallow.exe'].map((name) => join(scope, pkg, name)))
    .filter((path) => existsSync(path));
}

function installedVersion() {
  const pkg = join(dir, 'node_modules', 'fallow', 'package.json');
  return existsSync(pkg) ? JSON.parse(readFileSync(pkg, 'utf8')).version : null;
}

if (process.env.FALLOW_BIN) {
  console.log(`fetch-fallow: FALLOW_BIN=${process.env.FALLOW_BIN}; nothing fetched.`);
  process.exit(0);
}

// `npm run` exports the caller's npmrc `allow-scripts` as npm_config_allow_scripts, and npm 12
// rejects that env layer in a project-scoped install (EALLOWSCRIPTS). This install runs no
// scripts at all (--ignore-scripts), so the inherited allow-list is dropped, nothing else.
function installEnv() {
  return Object.fromEntries(Object.entries(process.env).filter(([key]) => key.toLowerCase() !== 'npm_config_allow_scripts'));
}

if (installedVersion() !== VERSION || binaries().length === 0) {
  const npmCli = process.env.npm_execpath;
  if (!npmCli) fail('run it through `npm run test:fallow` (npm_execpath is not set).');
  mkdirSync(dir, { recursive: true });
  const result = spawnSync(process.execPath, [
    npmCli, 'install', `fallow@${VERSION}`, '--prefix', dir, '--no-save', '--no-package-lock', '--ignore-scripts', '--no-audit', '--no-fund',
  ], { cwd: root, env: installEnv(), stdio: 'inherit' });
  if (result.status !== 0) fail(`test:fallow needs network access once to fetch fallow@${VERSION} (npm exited ${result.status}).`);
}

const found = binaries();
if (found.length !== 1) fail(`expected exactly one fallow binary under .fallow-bin/node_modules/@fallow-cli, found ${found.length}.`);
writeFileSync(join(dir, 'bin-path.txt'), `${found[0]}\n`);
console.log(`fetch-fallow: fallow@${VERSION} at ${found[0]}`);
