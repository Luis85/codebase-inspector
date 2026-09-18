// Build script. Its hardcoded '.obsidian' DEFAULT is acceptable here and takes an override.
// PLUGIN SOURCE MUST NEVER HARDCODE IT — use vault.configDir (spec 4.4).
import { cpSync, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
const vault = process.env.CODEBASE_INSPECTOR_TEST_VAULT;
const configDir = process.env.CODEBASE_INSPECTOR_TEST_VAULT_CONFIG_DIR || '.obsidian';
// Task 9 fix round 3, item 3 (fold): tests/unit/install-script.test.ts's own
// copy-and-verify test used to read the SAME repo-root dist/ that
// tests/host/build-output.test.ts's beforeAll rebuilds (vite.config.ts's
// emptyOutDir: true deletes then re-emits it) -- two vitest 'node'-project
// files running in parallel workers, so a copy landing inside that
// delete-then-write window silently omitted whatever file was not back yet.
// This override lets a test point the copy at its OWN private snapshot
// instead, decoupling the two entirely; production installs never set it, so
// they always copy the real dist/.
const distSource = process.env.CODEBASE_INSPECTOR_TEST_DIST_SOURCE || join(repoRoot, 'dist');
const die = (msg) => { console.error(`install-to-vault: ${msg}`); process.exit(1); };

if (!vault) die('CODEBASE_INSPECTOR_TEST_VAULT is unset. Copy .env.example to .env and set it.');

const vaultPath = resolve(vault);
if (!existsSync(join(vaultPath, configDir)) || !statSync(join(vaultPath, configDir)).isDirectory()) {
  die(`${vaultPath} is not a vault — no ${configDir}/ directory.`);
}

// Containment: path.relative sign check, never a string prefix test.
const rel = relative(repoRoot, vaultPath);
if (rel === '' || (!rel.startsWith('..') && !isAbsolute(rel))) {
  die('Refusing to install: the target resolves inside this repository.');
}

// The installed folder name must equal the manifest id, or onExternalSettingsChange never fires.
const manifest = JSON.parse(readFileSync(join(repoRoot, 'manifest.json'), 'utf8'));
if (manifest.id !== 'codebase-inspector') die(`manifest id is "${manifest.id}", expected "codebase-inspector".`);

const dest = join(vaultPath, configDir, 'plugins', manifest.id);
mkdirSync(dest, { recursive: true });
cpSync(distSource, dest, { recursive: true });
// The hot-reload plugin ignores folders lacking .git or .hotreload.
writeFileSync(join(dest, '.hotreload'), '');
// Task 9 fix round 4, item 2 (fold): `npm run install:vault` runs node with
// --env-file-if-exists=.env, and a real exported shell variable beats the file,
// so an override left set in a shell silently changes what ships. A bogus path
// fails loudly (cpSync ENOENT); an EXISTING wrong directory did not, because
// this line printed only the destination. Name the source whenever it is
// overridden, so a wrong install is visible in the output. Unset: unchanged.
if (process.env.CODEBASE_INSPECTOR_TEST_DIST_SOURCE) console.log(`install-to-vault: source OVERRIDDEN to ${distSource}`);
console.log(`install-to-vault: installed to ${dest}`);
