// Build script. Its hardcoded '.obsidian' DEFAULT is acceptable here and takes an override.
// PLUGIN SOURCE MUST NEVER HARDCODE IT — use vault.configDir (spec 4.4).
import { cpSync, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
const vault = process.env.CODEBASE_INSPECTOR_TEST_VAULT;
const configDir = process.env.CODEBASE_INSPECTOR_TEST_VAULT_CONFIG_DIR || '.obsidian';
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
cpSync(join(repoRoot, 'dist'), dest, { recursive: true });
// The hot-reload plugin ignores folders lacking .git or .hotreload.
writeFileSync(join(dest, '.hotreload'), '');
console.log(`install-to-vault: installed to ${dest}`);
